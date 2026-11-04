import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type PackageName = "app" | "core" | "db" | "ui";
interface PackageManifest {
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}
const packageNames: PackageName[] = ["app", "core", "db", "ui"];
const allowed: Record<PackageName, readonly PackageName[]> = {
  app: ["core", "db", "ui"],
  core: [],
  db: ["core"],
  ui: [],
};
const ignored = new Set(["node_modules", ".next", "dist", "build"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(path) &&
          !path.endsWith(".d.ts") &&
          !path.endsWith("next-env.d.ts")
        ? [path]
        : [];
  });
}
function packageOf(root: string, path: string): PackageName | undefined {
  const parts = relative(resolve(root, "packages"), path).split(sep);
  return packageNames.find((name) => name === parts[0]);
}
function resolveFile(path: string): string | undefined {
  // Source imports may use their eventual .js extension under Node ESM.
  const base = /\.[cm]?js$/.test(path) ? path.replace(/\.[cm]?js$/, "") : path;
  return [
    path,
    base + ".ts",
    base + ".tsx",
    base + ".mts",
    base + ".js",
    resolve(path, "index.ts"),
    resolve(path, "index.tsx"),
  ].find((candidate) => existsSync(candidate) && extname(candidate) !== "");
}
function exportTarget(
  manifest: PackageManifest,
  subpath: string,
): string | undefined {
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    if (key === subpath) return value;
    if (key.includes("*")) {
      const wildcard = key.indexOf("*");
      const prefix = key.slice(0, wildcard);
      const suffix = key.slice(wildcard + 1);
      if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
        return value.replace(
          "*",
          subpath.slice(prefix.length, suffix ? -suffix.length : undefined),
        );
      }
    }
  }
  return undefined;
}

/** Check both the manifest graph and resolved source graph, including type imports. */
export function checkDependencies(root: string): string[] {
  const errors: string[] = [];
  const manifests = new Map<PackageName, PackageManifest>();
  const graph = new Map<string, string[]>();
  for (const name of packageNames) {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "packages", name, "package.json"), "utf8"),
    ) as PackageManifest;
    manifests.set(name, manifest);
    for (const dependency of Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    })) {
      if (
        name === "core" &&
        /^(?:next|react|react-dom|awilix|server-only|@mikro-orm)(?:\/|$)/.test(
          dependency,
        )
      )
        errors.push(`core: forbidden infrastructure dependency ${dependency}`);
      const target = packageNames.find(
        (entry) => dependency === `@devmentor/${entry}`,
      );
      if (target && !allowed[name].includes(target))
        errors.push(`${name}: forbidden manifest dependency ${dependency}`);
    }
  }
  for (const name of packageNames) {
    for (const file of sourceFiles(resolve(root, "packages", name))) {
      const edges: string[] = [];
      graph.set(file, edges);
      const parsed = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      function inspect(specifier: string): void {
        const location = relative(root, file);
        let target: string | undefined;
        if (
          name === "core" &&
          /^(?:next|react|react-dom|awilix|server-only|@mikro-orm)(?:\/|$)/.test(
            specifier,
          )
        )
          errors.push(`${location}: core infrastructure import ${specifier}`);
        if (
          name === "ui" &&
          /^(?:awilix|server-only|@mikro-orm)(?:\/|$)/.test(specifier)
        )
          errors.push(`${location}: UI server import ${specifier}`);
        if (
          (specifier.startsWith("@devmentor/") || specifier.startsWith("@/")) &&
          specifier.split("/").some((part) => part === ".." || part === ".")
        ) {
          errors.push(`${location}: package alias traversal ${specifier}`);
          return;
        }
        if (specifier.startsWith("@devmentor/")) {
          const targetName = packageNames.find(
            (entry) =>
              specifier === `@devmentor/${entry}` ||
              specifier.startsWith(`@devmentor/${entry}/`),
          );
          if (!targetName) {
            errors.push(`${location}: unknown internal package ${specifier}`);
            return;
          }
          const manifest = manifests.get(targetName);
          const subpath = specifier.slice(`@devmentor/${targetName}`.length);
          const exported =
            manifest && exportTarget(manifest, subpath ? `.${subpath}` : ".");
          if (!exported) {
            errors.push(`${location}: non-public package import ${specifier}`);
            return;
          }
          target = resolveFile(resolve(root, "packages", targetName, exported));
          if (!target)
            errors.push(`${location}: unresolved package export ${specifier}`);
        } else if (specifier.startsWith(".")) {
          target = resolveFile(resolve(dirname(file), specifier));
          if (!target)
            errors.push(`${location}: unresolved relative import ${specifier}`);
          if (target && packageOf(root, target) !== name)
            errors.push(
              `${location}: relative import crosses package boundary ${specifier}`,
            );
        } else if (specifier.startsWith("@/")) {
          target = resolveFile(
            resolve(root, "packages", name, specifier.slice(2)),
          );
          if (!target)
            errors.push(`${location}: unresolved local alias ${specifier}`);
          // Traversal segments were rejected above; @/ stays inside this package.
        }
        if (target) {
          const targetName = packageOf(root, target);
          if (
            targetName &&
            targetName !== name &&
            !allowed[name].includes(targetName)
          )
            errors.push(`${location}: forbidden ${name} -> ${targetName}`);
          edges.push(target);
        }
      }
      function visit(node: ts.Node): void {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          inspect(node.moduleSpecifier.text);
        if (
          ts.isImportTypeNode(node) &&
          ts.isLiteralTypeNode(node.argument) &&
          ts.isStringLiteral(node.argument.literal)
        )
          inspect(node.argument.literal.text);
        if (
          ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference) &&
          node.moduleReference.expression &&
          ts.isStringLiteral(node.moduleReference.expression)
        )
          inspect(node.moduleReference.expression.text);
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) &&
              node.expression.text === "require"))
        ) {
          const argument = node.arguments[0];
          if (argument && ts.isStringLiteralLike(argument))
            inspect(argument.text);
          else
            errors.push(
              `${relative(root, file)}: non-literal module import cannot be checked`,
            );
        }
        ts.forEachChild(node, visit);
      }
      visit(parsed);
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  function traverse(file: string): void {
    if (active.has(file)) {
      errors.push(`dependency cycle at ${relative(root, file)}`);
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const target of graph.get(file) ?? []) traverse(target);
    active.delete(file);
  }
  for (const file of graph.keys()) traverse(file);
  return errors;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkDependencies(process.cwd());
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log("Package boundaries, public exports and source cycles OK.");
}
