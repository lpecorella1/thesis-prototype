let pgModule;

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeString(value) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeDate(value) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
}

function normalizeTimestamp(value) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
}

function getPgModule() {
  if (pgModule !== undefined) {
    return pgModule;
  }

  try {
    pgModule = require("pg");
  } catch (error) {
    pgModule = null;
  }

  return pgModule;
}

function getDatabaseConfig() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  const enabled = String(process.env.NUTRITRACK_USE_POSTGRES || "").trim() === "1";
  const demoUserEmail = String(process.env.NUTRITRACK_DEMO_USER_EMAIL || "demo@nutritrack.local").trim();
  const pg = getPgModule();

  return {
    connectionString,
    enabled,
    demoUserEmail,
    available: Boolean(enabled && connectionString && pg),
    pgInstalled: Boolean(pg),
  };
}

let sharedPool;

function getPool() {
  const config = getDatabaseConfig();

  if (!config.available) {
    return null;
  }

  if (!sharedPool) {
    sharedPool = new config.pg.Pool({
      connectionString: config.connectionString,
    });
  }

  return sharedPool;
}

function buildDatabaseStatus() {
  const config = getDatabaseConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      mode: "file_only",
      reason: "NUTRITRACK_USE_POSTGRES non attivo.",
      pgInstalled: config.pgInstalled,
    };
  }

  if (!config.connectionString) {
    return {
      enabled: false,
      mode: "file_only",
      reason: "DATABASE_URL non configurato.",
      pgInstalled: config.pgInstalled,
    };
  }

  if (!config.pgInstalled) {
    return {
      enabled: false,
      mode: "file_only",
      reason: "Pacchetto pg non installato.",
      pgInstalled: false,
    };
  }

  return {
    enabled: true,
    mode: "hybrid_mirror",
    reason: "",
    pgInstalled: true,
  };
}

async function withClient(callback) {
  const pool = getPool();

  if (!pool) {
    return null;
  }

  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

async function ensureDemoUser(client) {
  const { demoUserEmail } = getDatabaseConfig();
  const result = await client.query(
    `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [demoUserEmail, "prototype-local-only"]
  );

  return result.rows[0].id;
}

async function replaceUserProfile(client, userId, profileState = {}) {
  const personal = profileState.personal || {};
  const medical = profileState.medical || {};
  const goals = profileState.goals || {};

  await client.query(
    `
      INSERT INTO user_profiles (
        user_id,
        full_name,
        age,
        gender,
        height_cm,
        current_weight_kg,
        target_weight_kg,
        activity_level,
        diet_type,
        allergies,
        medications,
        medical_conditions,
        blood_type,
        daily_calories_goal,
        daily_protein_goal,
        daily_carbs_goal,
        daily_fats_goal,
        daily_water_goal
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        height_cm = EXCLUDED.height_cm,
        current_weight_kg = EXCLUDED.current_weight_kg,
        target_weight_kg = EXCLUDED.target_weight_kg,
        activity_level = EXCLUDED.activity_level,
        diet_type = EXCLUDED.diet_type,
        allergies = EXCLUDED.allergies,
        medications = EXCLUDED.medications,
        medical_conditions = EXCLUDED.medical_conditions,
        blood_type = EXCLUDED.blood_type,
        daily_calories_goal = EXCLUDED.daily_calories_goal,
        daily_protein_goal = EXCLUDED.daily_protein_goal,
        daily_carbs_goal = EXCLUDED.daily_carbs_goal,
        daily_fats_goal = EXCLUDED.daily_fats_goal,
        daily_water_goal = EXCLUDED.daily_water_goal,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      normalizeString(personal.fullName),
      normalizeNumber(personal.age),
      normalizeString(personal.gender),
      normalizeNumber(personal.heightCm),
      normalizeNumber(personal.currentWeightKg),
      normalizeNumber(personal.targetWeightKg),
      normalizeString(personal.activityLevel),
      normalizeString(personal.dietType),
      normalizeString(medical.allergies),
      normalizeString(medical.medications),
      normalizeString(medical.medicalConditions),
      normalizeString(medical.bloodType),
      normalizeNumber(goals.calories),
      normalizeNumber(goals.protein),
      normalizeNumber(goals.carbs),
      normalizeNumber(goals.fats),
      normalizeNumber(goals.water),
    ]
  );
}

async function replaceNutritionMeals(client, userId, meals = []) {
  await client.query("DELETE FROM nutrition_meals WHERE user_id = $1", [userId]);

  for (const meal of Array.isArray(meals) ? meals : []) {
    await client.query(
      `
        INSERT INTO nutrition_meals (
          user_id,
          meal_name,
          meal_type,
          consumed_at,
          calories,
          protein_g,
          carbs_g,
          fats_g,
          nutrition_source,
          source_note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        userId,
        normalizeString(meal.name) || "Pasto",
        normalizeString(meal.type),
        normalizeTimestamp(meal.timestamp || meal.consumedAt) || new Date().toISOString(),
        normalizeNumber(meal.calories) || 0,
        normalizeNumber(meal.protein) || 0,
        normalizeNumber(meal.carbs) || 0,
        normalizeNumber(meal.fats) || 0,
        normalizeString(meal.nutritionSourceLabel || meal.nutritionSource),
        normalizeString(meal.sourceNote),
      ]
    );
  }
}

async function replaceGroceryItems(client, userId, items = []) {
  await client.query("DELETE FROM grocery_items WHERE user_id = $1", [userId]);

  for (const item of Array.isArray(items) ? items : []) {
    await client.query(
      `
        INSERT INTO grocery_items (
          user_id,
          item_name,
          quantity_label,
          category,
          is_completed
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        normalizeString(item.name) || "Prodotto",
        normalizeString(item.quantity),
        normalizeString(item.category),
        normalizeBoolean(item.completed),
      ]
    );
  }
}

async function replacePantryItems(client, userId, items = []) {
  await client.query("DELETE FROM pantry_items WHERE user_id = $1", [userId]);

  for (const item of Array.isArray(items) ? items : []) {
    await client.query(
      `
        INSERT INTO pantry_items (
          user_id,
          item_name,
          quantity_label,
          category,
          expires_on
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        normalizeString(item.name) || "Prodotto",
        normalizeString(item.quantity),
        normalizeString(item.category),
        normalizeDate(item.expiresOn),
      ]
    );
  }
}

async function replaceProgressLogs(client, userId, dailyLogs = []) {
  await client.query("DELETE FROM progress_logs WHERE user_id = $1", [userId]);

  for (const log of Array.isArray(dailyLogs) ? dailyLogs : []) {
    const logDate = normalizeDate(log.date);

    if (!logDate) {
      continue;
    }

    await client.query(
      `
        INSERT INTO progress_logs (
          user_id,
          log_date,
          weight_kg,
          water_glasses,
          steps,
          burned_calories,
          note,
          source_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        userId,
        logDate,
        normalizeNumber(log.weightKg),
        normalizeNumber(log.waterGlasses),
        normalizeNumber(log.steps),
        normalizeNumber(log.burnedCalories),
        normalizeString(log.note),
        "manual",
      ]
    );
  }
}

async function mirrorNutriTrackStateToPostgres(state) {
  const databaseStatus = buildDatabaseStatus();

  if (!databaseStatus.enabled) {
    return databaseStatus;
  }

  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      const userId = await ensureDemoUser(client);
      await replaceUserProfile(client, userId, state.profile);
      await replaceNutritionMeals(client, userId, state.nutrition?.meals);
      await replaceGroceryItems(client, userId, state.grocery?.items);
      await replacePantryItems(client, userId, state.grocery?.pantry);
      await replaceProgressLogs(client, userId, state.progress?.dailyLogs);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return buildDatabaseStatus();
}

module.exports = {
  buildDatabaseStatus,
  mirrorNutriTrackStateToPostgres,
};
