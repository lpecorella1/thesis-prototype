require("../backend-env");

const { Pool } = require("pg");

const DEFAULT_BASE_URL = process.env.NUTRITRACK_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_BASE_PATH =
  process.env.NUTRITRACK_BASE_PATH === undefined ? "/nutritrack" : process.env.NUTRITRACK_BASE_PATH;
const EXPECTED_TABLES = [
  "users",
  "user_sessions",
  "user_profiles",
  "nutrition_meals",
  "grocery_items",
  "pantry_items",
  "progress_logs",
  "recipes",
];
const EXPECTED_COLUMNS = [
  ["nutrition_meals", "app_meal_id"],
  ["nutrition_meals", "entry_mode"],
  ["nutrition_meals", "entry_method"],
  ["user_profiles", "medical_lab_metrics"],
  ["user_profiles", "include_burned_calories_in_goal"],
  ["progress_logs", "physical_activities"],
  ["recipes", "app_recipe_id"],
  ["recipes", "recipe_payload"],
];
const EXPECTED_INDEXES = [
  "idx_nutrition_meals_user_app_meal_id",
  "idx_recipes_app_recipe_id",
];

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
    const error = new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${payload.error || text}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readOptionalStatePayload() {
  try {
    return {
      payload: await fetchJson(buildApiUrl("/api/nutritrack/state")),
      status: "available",
    };
  } catch (error) {
    if (error.statusCode === 401) {
      return {
        payload: null,
        status: "requires_authentication",
      };
    }

    throw error;
  }
}

function getConnectionString() {
  return String(process.env.DATABASE_URL || "").trim();
}

async function verifyPostgresSchema() {
  const connectionString = getConnectionString();

  assert(connectionString, "DATABASE_URL is required for Postgres verification.");

  const pool = new Pool({ connectionString });

  try {
    const tableResult = await pool.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `
    );
    const tableNames = new Set(tableResult.rows.map((row) => row.table_name));

    for (const tableName of EXPECTED_TABLES) {
      assert(tableNames.has(tableName), `Expected Postgres table missing: ${tableName}.`);
    }

    const columnResult = await pool.query(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `
    );
    const columnsByTable = columnResult.rows.reduce((accumulator, row) => {
      if (!accumulator.has(row.table_name)) {
        accumulator.set(row.table_name, new Set());
      }

      accumulator.get(row.table_name).add(row.column_name);
      return accumulator;
    }, new Map());

    for (const [tableName, columnName] of EXPECTED_COLUMNS) {
      assert(
        columnsByTable.get(tableName)?.has(columnName),
        `Expected Postgres column missing: ${tableName}.${columnName}.`
      );
    }

    const indexResult = await pool.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
      `
    );
    const indexNames = new Set(indexResult.rows.map((row) => row.indexname));

    for (const indexName of EXPECTED_INDEXES) {
      assert(indexNames.has(indexName), `Expected Postgres index missing: ${indexName}.`);
    }

    return {
      tables: EXPECTED_TABLES,
      columns: EXPECTED_COLUMNS.map(([tableName, columnName]) => `${tableName}.${columnName}`),
      indexes: EXPECTED_INDEXES,
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  const databaseStatusPayload = await fetchJson(buildApiUrl("/api/database/status"));
  const stateCheck = await readOptionalStatePayload();
  const schema = await verifyPostgresSchema();

  const database = databaseStatusPayload.database || {};
  const runtime = databaseStatusPayload.runtime || {};
  const storage = stateCheck.payload?.storage || null;

  assert(database.enabled === true, "Database status is not enabled.");
  assert(database.mode === "postgres_primary", `Unexpected database mode: ${database.mode || "missing"}.`);

  if (storage) {
    assert(storage.primarySource === "postgres_primary", `Unexpected storage primarySource: ${storage.primarySource || "missing"}.`);
    assert(storage.postgresStructuredStateComplete === true, "Structured Postgres state is not complete.");
    assert(
      Array.isArray(storage.postgresPrimarySections) &&
        ["profile", "nutrition", "grocery", "progress", "recipes", "datasets"].every((section) =>
          storage.postgresPrimarySections.includes(section)
        ),
      "Postgres primary sections are incomplete."
    );
  } else {
    assert(
      runtime.requiresAuthenticatedUser === true,
      "State endpoint is unavailable, but runtime does not report authenticated-user mode."
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: DEFAULT_BASE_URL,
        basePath: normalizeBasePath(DEFAULT_BASE_PATH) || "/",
        databaseMode: database.mode,
        stateEndpoint: stateCheck.status,
        primarySource: storage?.primarySource || "requires_authenticated_user",
        postgresPrimarySections: storage?.postgresPrimarySections || [],
        postgresStructuredStateComplete: storage?.postgresStructuredStateComplete ?? null,
        legacyFileAvailable: storage?.legacyFileAvailable ?? null,
        verifiedSchema: schema,
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
