require("../backend-env");

const fs = require("node:fs/promises");
const path = require("node:path");

const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "..", "database", "migrations");
const BASELINE_MIGRATION = "001_postgres_base.sql";

function isPostgresEnabled() {
  return String(process.env.NUTRITRACK_USE_POSTGRES || "").trim() === "1";
}

async function listIncrementalMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries
    .filter((entry) => entry.endsWith(".sql") && entry !== BASELINE_MIGRATION)
    .sort((left, right) => left.localeCompare(right));
}

async function main() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();

  if (!isPostgresEnabled()) {
    console.log("PostgreSQL migrations skipped: NUTRITRACK_USE_POSTGRES is not active.");
    return;
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL is required when PostgreSQL persistence is enabled.");
  }

  const migrationFiles = await listIncrementalMigrations();
  const pool = new Pool({ connectionString });

  try {
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
      const sql = await fs.readFile(migrationPath, "utf8");
      await pool.query(sql);
      console.log(`Applied PostgreSQL migration: ${migrationFile}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error?.message || error?.code || String(error || "unknown error");
  console.error("PostgreSQL migration failed:", message);
  process.exitCode = 1;
});
