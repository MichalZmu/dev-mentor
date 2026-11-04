"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Envelope<T> {
  data: T;
  nextCursor?: string | null;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<Envelope<T>> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 204) return { data: undefined as T };
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = object(body) && object(body.error) ? body.error : null;
    throw new ApiError(
      error && typeof error.message === "string"
        ? error.message
        : "Nie udało się wykonać operacji. Spróbuj ponownie.",
      response.status,
      error && typeof error.code === "string" ? error.code : "REQUEST_FAILED",
    );
  }
  if (!object(body) || !("data" in body))
    throw new ApiError(
      "Serwer zwrócił nieprawidłową odpowiedź.",
      502,
      "INVALID_RESPONSE",
    );
  return body as unknown as Envelope<T>;
}
export function useResource<T>(
  path: string | null,
  scope = "",
  refreshInterval = 0,
): {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
  nextCursor: string | null;
  refreshError: string;
} {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    path: string | null;
    scope: string;
    version: number;
    refreshError: string;
    data: T | null;
    error: string;
    nextCursor: string | null;
  }>({
    path: null,
    scope: "",
    version: -1,
    refreshError: "",
    data: null,
    error: "",
    nextCursor: null,
  });
  useEffect(() => {
    if (path === null) return;
    const resourcePath = path;
    const abort = new AbortController();
    let timer: number | undefined;
    let loaded = false;
    let pending = false;
    function schedule(): void {
      window.clearTimeout(timer);
      if (
        refreshInterval > 0 &&
        loaded &&
        !pending &&
        !abort.signal.aborted &&
        document.visibilityState !== "hidden"
      )
        timer = window.setTimeout(() => void load(true), refreshInterval);
    }
    async function load(background: boolean): Promise<void> {
      pending = true;
      try {
        const result = await request<T>(resourcePath, { signal: abort.signal });
        if (!abort.signal.aborted) {
          loaded = true;
          setState({
            path: resourcePath,
            scope,
            version,
            data: result.data,
            error: "",
            refreshError: "",
            nextCursor: result.nextCursor ?? null,
          });
        }
      } catch (error: unknown) {
        if (!abort.signal.aborted) {
          const message =
            error instanceof Error ? error.message : "Błąd połączenia.";
          if (background)
            // A transient refresh failure must not discard readable history or its cursor.
            setState((current) => ({ ...current, refreshError: message }));
          else
            setState({
              path: resourcePath,
              scope,
              version,
              data: null,
              error: message,
              refreshError: "",
              nextCursor: null,
            });
        }
      } finally {
        pending = false;
        schedule();
      }
    }
    if (refreshInterval > 0)
      document.addEventListener("visibilitychange", schedule);
    void load(false);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [path, scope, version, refreshInterval]);
  const current = state.path === path && state.scope === scope;
  return {
    data: current ? state.data : null,
    loading: path !== null && (!current || state.version !== version),
    error: current ? state.error : "",
    reload: useCallback(() => setVersion((value) => value + 1), []),
    nextCursor: current ? state.nextCursor : null,
    refreshError: current ? state.refreshError : "",
  };
}
export interface PaginatedResource<T> {
  data: T[] | null;
  loading: boolean;
  error: string;
  nextCursor: string | null;
  pageNumber: number;
  hasPrevious: boolean;
  nextPage: () => void;
  previousPage: () => void;
  reload: () => void;
  retry: () => void;
}

/** A cursor belongs to one resource/query and one authenticated owner. */
export function usePaginatedResource<T>(
  path: string | null,
  owner = "",
): PaginatedResource<T> {
  const identity = `${owner}\u0000${path ?? ""}`;
  const [pagination, setPagination] = useState<{
    identity: string;
    cursors: string[];
  }>({ identity, cursors: [] });
  // Reset in the same render as a resource change, before requesting its page.
  if (pagination.identity !== identity) {
    setPagination({ identity, cursors: [] });
  }
  const cursors = pagination.identity === identity ? pagination.cursors : [];
  const cursor = cursors.at(-1);
  let pagePath = path;
  if (path !== null) {
    const separator = path.indexOf("?");
    const pathname = separator < 0 ? path : path.slice(0, separator);
    const query = new URLSearchParams(
      separator < 0 ? "" : path.slice(separator + 1),
    );
    query.delete("cursor");
    if (cursor !== undefined) query.set("cursor", cursor);
    pagePath = `${pathname}${query.size ? `?${query.toString()}` : ""}`;
  }
  const resource = useResource<T[]>(pagePath, owner);
  const reloadResource = resource.reload;
  const reload = useCallback(() => {
    setPagination({ identity, cursors: [] });
    reloadResource();
  }, [identity, reloadResource]);
  useEffect(() => {
    window.addEventListener("devmentor-auth-change", reload);
    return () => window.removeEventListener("devmentor-auth-change", reload);
  }, [reload]);
  const nextCursor =
    resource.loading || resource.error ? null : resource.nextCursor;
  function nextPage(): void {
    if (!nextCursor || nextCursor === cursor) return;
    setPagination((current) => ({
      identity,
      cursors: [
        ...(current.identity === identity ? current.cursors : []),
        nextCursor,
      ],
    }));
  }
  function previousPage(): void {
    if (resource.loading || cursors.length === 0) return;
    setPagination((current) => ({
      identity,
      cursors:
        current.identity === identity ? current.cursors.slice(0, -1) : [],
    }));
  }
  return {
    ...resource,
    nextCursor,
    pageNumber: cursors.length + 1,
    hasPrevious: cursors.length > 0,
    nextPage,
    previousPage,
    reload,
    retry: resource.reload,
  };
}

export function useAction(): {
  busy: boolean;
  error: string;
  notice: string;
  run: (action: () => Promise<void>, success?: string) => Promise<void>;
  mutate: <T>(path: string, body: unknown, method?: string) => Promise<T>;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const keys = useRef(new Map<string, string>());
  async function mutate<T>(
    path: string,
    body: unknown,
    method = "POST",
  ): Promise<T> {
    const json = JSON.stringify(body);
    const fingerprint = `${method}:${path}:${json}`;
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    return (
      await request<T>(path, {
        method,
        body: json,
        headers: { "Idempotency-Key": key },
      })
    ).data;
  }
  async function run(
    action: () => Promise<void>,
    success = "Zmiany zapisane.",
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Operacja nie powiodła się.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, notice, run, mutate };
}
export function money(value: string, currency = "PLN"): string {
  try {
    const amount = BigInt(value);
    const whole = amount / 100n;
    const cents = (amount % 100n).toString().padStart(2, "0");
    return `${whole.toLocaleString("pl-PL")},${cents} ${currency}`;
  } catch {
    return `— ${currency}`;
  }
}
export function dateTime(value: string, timezone = "Europe/Warsaw"): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return value;
  }
}
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
export function priceMinor(value: string): string {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value))
    throw new Error("Podaj poprawną kwotę w PLN.");
  const [whole = "0", fraction = ""] = value.replace(",", ".").split(".");
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
}
