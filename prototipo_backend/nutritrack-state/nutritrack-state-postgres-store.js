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

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatDateKeyLocal(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function normalizeDbNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

function formatTimeKeyLocal(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function resolveMealConsumedAt(meal = {}) {
  const directTimestamp = normalizeTimestamp(meal.timestamp || meal.consumedAt);

  if (directTimestamp) {
    return directTimestamp;
  }

  const mealDate = normalizeDate(meal.date);
  const mealTime = normalizeString(meal.time);

  if (mealDate && mealTime) {
    return `${mealDate}T${mealTime}:00`;
  }

  if (mealDate) {
    return `${mealDate}T12:00:00`;
  }

  return new Date().toISOString();
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
  const localUserEmail = String(
    process.env.NUTRITRACK_LOCAL_USER_EMAIL ||
      process.env.NUTRITRACK_DEMO_USER_EMAIL ||
      "app-local@nutritrack.local"
  ).trim();
  const pg = getPgModule();

  return {
    connectionString,
    enabled,
    localUserEmail,
    pg,
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
    mode: "hybrid_read_through",
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

async function ensureLocalAppUser(client) {
  const { localUserEmail } = getDatabaseConfig();
  const result = await client.query(
    `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
    [localUserEmail, "local-app-bootstrap-account"]
  );

  return result.rows[0].id;
}

async function getLocalAppUserId(client) {
  const { localUserEmail } = getDatabaseConfig();
  const result = await client.query(
    `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [localUserEmail]
  );

  return result.rows[0]?.id || null;
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
        resolveMealConsumedAt(meal),
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
          is_completed,
          barcode,
          source,
          nutriscore_grade
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        userId,
        normalizeString(item.name) || "Prodotto",
        normalizeString(item.quantity),
        normalizeString(item.category),
        normalizeBoolean(item.completed),
        normalizeString(item.barcode),
        normalizeString(item.source),
        normalizeString(item.nutriscoreGrade),
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
          expires_on,
          barcode,
          source,
          nutriscore_grade
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        userId,
        normalizeString(item.name) || "Prodotto",
        normalizeString(item.quantity),
        normalizeString(item.category),
        normalizeDate(item.expiresOn || item.expiryDate),
        normalizeString(item.barcode),
        normalizeString(item.source),
        normalizeString(item.nutriscoreGrade),
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
          intake_calories,
          protein_g,
          steps,
          burned_calories,
          note,
          source_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        userId,
        logDate,
        normalizeNumber(log.weightKg),
        normalizeNumber(log.waterGlasses),
        normalizeNumber(log.calories),
        normalizeNumber(log.protein),
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
      const userId = await ensureLocalAppUser(client);
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

async function readUserProfile(client, userId) {
  const result = await client.query(
    `
      SELECT
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
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    personal: {
      fullName: row.full_name || "",
      age: normalizeDbNumber(row.age),
      gender: row.gender || "",
      heightCm: normalizeDbNumber(row.height_cm),
      currentWeightKg: normalizeDbNumber(row.current_weight_kg),
      targetWeightKg: normalizeDbNumber(row.target_weight_kg),
      activityLevel: row.activity_level || "",
      dietType: row.diet_type || "",
    },
    medical: {
      allergies: row.allergies || "",
      medications: row.medications || "",
      medicalConditions: row.medical_conditions || "",
      bloodType: row.blood_type || "",
    },
    goals: {
      calories: normalizeDbNumber(row.daily_calories_goal),
      protein: normalizeDbNumber(row.daily_protein_goal),
      carbs: normalizeDbNumber(row.daily_carbs_goal),
      fats: normalizeDbNumber(row.daily_fats_goal),
      water: normalizeDbNumber(row.daily_water_goal),
    },
  };
}

async function readNutritionMeals(client, userId) {
  const result = await client.query(
    `
      SELECT
        id,
        meal_name,
        meal_type,
        consumed_at,
        calories,
        protein_g,
        carbs_g,
        fats_g,
        nutrition_source,
        source_note
      FROM nutrition_meals
      WHERE user_id = $1
      ORDER BY consumed_at ASC, id ASC
    `,
    [userId]
  );

  return {
    meals: result.rows.map((row) => ({
      id: String(row.id),
      name: row.meal_name || "Pasto",
      type: row.meal_type || "",
      date: formatDateKeyLocal(row.consumed_at),
      time: formatTimeKeyLocal(row.consumed_at),
      timestamp: row.consumed_at instanceof Date ? row.consumed_at.toISOString() : String(row.consumed_at || ""),
      calories: normalizeNumber(row.calories) || 0,
      protein: normalizeNumber(row.protein_g) || 0,
      carbs: normalizeNumber(row.carbs_g) || 0,
      fats: normalizeNumber(row.fats_g) || 0,
      nutritionSource: row.nutrition_source || "",
      nutritionSourceLabel: row.nutrition_source || "",
      sourceNote: row.source_note || "",
    })),
  };
}

async function readGroceryItems(client, userId) {
  const result = await client.query(
    `
      SELECT
        id,
        item_name,
        quantity_label,
        category,
        is_completed,
        barcode,
        source,
        nutriscore_grade
      FROM grocery_items
      WHERE user_id = $1
      ORDER BY id ASC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: row.item_name || "Prodotto",
    quantity: row.quantity_label || "",
    category: row.category || "",
    completed: Boolean(row.is_completed),
    expiryDate: "",
    barcode: row.barcode || "",
    source: row.source || "manual",
    nutriscoreGrade: row.nutriscore_grade || "",
  }));
}

async function readPantryItems(client, userId) {
  const result = await client.query(
    `
      SELECT
        id,
        item_name,
        quantity_label,
        category,
        expires_on,
        barcode,
        source,
        nutriscore_grade
      FROM pantry_items
      WHERE user_id = $1
      ORDER BY item_name ASC, id ASC
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: row.item_name || "Prodotto",
    quantity: row.quantity_label || "",
    category: row.category || "",
    expiryDate: formatDateKeyLocal(row.expires_on) || "",
    barcode: row.barcode || "",
    source: row.source || "manual",
    nutriscoreGrade: row.nutriscore_grade || "",
  }));
}

async function readProgressLogs(client, userId) {
  const result = await client.query(
    `
      SELECT
        log_date,
        weight_kg,
        water_glasses,
        intake_calories,
        protein_g
      FROM progress_logs
      WHERE user_id = $1
      ORDER BY log_date ASC
    `,
    [userId]
  );

  return {
    dailyLogs: result.rows.map((row) => ({
      date: formatDateKeyLocal(row.log_date),
      weightKg: normalizeDbNumber(row.weight_kg),
      waterGlasses: normalizeDbNumber(row.water_glasses),
      calories: normalizeDbNumber(row.intake_calories),
      protein: normalizeDbNumber(row.protein_g),
    })),
  };
}

async function readNutriTrackStateFromPostgres() {
  const databaseStatus = buildDatabaseStatus();

  if (!databaseStatus.enabled) {
    return null;
  }

  return withClient(async (client) => {
    const userId = await getLocalAppUserId(client);

    if (!userId) {
      return null;
    }

    const profile = await readUserProfile(client, userId);
    const nutrition = await readNutritionMeals(client, userId);
    const groceryItems = await readGroceryItems(client, userId);
    const pantryItems = await readPantryItems(client, userId);
    const progress = await readProgressLogs(client, userId);

    return {
      profile,
      nutrition,
      grocery: {
        items: groceryItems,
        pantry: pantryItems,
      },
      progress,
    };
  });
}

module.exports = {
  buildDatabaseStatus,
  mirrorNutriTrackStateToPostgres,
  readNutriTrackStateFromPostgres,
};
