const DEFAULT_BASE_URL = process.env.NUTRITRACK_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_BASE_PATH =
  process.env.NUTRITRACK_BASE_PATH === undefined ? "/nutritrack" : process.env.NUTRITRACK_BASE_PATH;

function normalizeBasePath(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue === "/") {
    return "";
  }

  return `/${rawValue.replace(/^\/+|\/+$/g, "")}`;
}

function buildApiUrl(path) {
  return `${DEFAULT_BASE_URL}${normalizeBasePath(DEFAULT_BASE_PATH)}${path}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${payload.error || text}`);
  }

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const databaseStatusPayload = await fetchJson(buildApiUrl("/api/database/status"));
  const statePayload = await fetchJson(buildApiUrl("/api/nutritrack/state"));

  const database = databaseStatusPayload.database || {};
  const storage = statePayload.storage || {};

  assert(database.enabled === true, "Database status is not enabled.");
  assert(database.mode === "postgres_primary", `Unexpected database mode: ${database.mode || "missing"}.`);
  assert(storage.primarySource === "postgres_primary", `Unexpected storage primarySource: ${storage.primarySource || "missing"}.`);
  assert(storage.postgresStructuredStateComplete === true, "Structured Postgres state is not complete.");
  assert(
    Array.isArray(storage.postgresPrimarySections) &&
      ["profile", "nutrition", "grocery", "progress", "recipes", "datasets"].every((section) =>
        storage.postgresPrimarySections.includes(section)
      ),
    "Postgres primary sections are incomplete."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: DEFAULT_BASE_URL,
        basePath: normalizeBasePath(DEFAULT_BASE_PATH) || "/",
        databaseMode: database.mode,
        primarySource: storage.primarySource,
        postgresPrimarySections: storage.postgresPrimarySections,
        postgresStructuredStateComplete: storage.postgresStructuredStateComplete,
        legacyFileAvailable: storage.legacyFileAvailable,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseUrl: DEFAULT_BASE_URL,
        basePath: normalizeBasePath(DEFAULT_BASE_PATH) || "/",
        error: error.message,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
