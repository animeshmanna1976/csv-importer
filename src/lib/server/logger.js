import fs from "node:fs";
import path from "node:path";

/**
 * Minimal structured logger. Emits single-line JSON to stdout (so it works in
 * any hosting platform's log drain) and, when LOG_TO_FILE=true, also appends to
 * logs/import-YYYY-MM-DD.log at the project root.
 *
 * Deliberately dependency-free — the assignment is small enough that a real
 * logging library would be overkill.
 */
const LOG_TO_FILE = process.env.LOG_TO_FILE === "true";
const LOG_DIR = path.join(process.cwd(), "logs");

let fileReady = false;
function ensureLogDir() {
  if (fileReady) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fileReady = true;
  } catch {
    // If we can't create the dir (read-only FS), silently fall back to stdout.
  }
}

export function log(level, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const line = JSON.stringify(entry);

  // stdout is always on.
  if (level === "error") console.error(line);
  else console.log(line);

  if (LOG_TO_FILE) {
    ensureLogDir();
    if (fileReady) {
      const day = entry.ts.slice(0, 10);
      try {
        fs.appendFileSync(path.join(LOG_DIR, `import-${day}.log`), line + "\n");
      } catch {
        // Ignore file write failures — stdout already has the entry.
      }
    }
  }
}

export const logger = {
  info: (event, data) => log("info", event, data),
  warn: (event, data) => log("warn", event, data),
  error: (event, data) => log("error", event, data),
};
