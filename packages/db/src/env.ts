import { config } from "dotenv";
import { resolve } from "node:path";

// CLI entry points load the same root .env as next.config.ts.
// Keep filesystem environment loading out of the app's bundled db modules.
config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
