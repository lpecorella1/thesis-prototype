let pgModule;
const tableColumnsPromises = new Map();

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

function normalizeJsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? cloneJson(value) : cloneJson(fallback);
}

function normalizeJsonArray(value, fallback = []) {
  return Array.isArray(value) ? cloneJson(value) : cloneJson(fallback);
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

function parseJsonArrayText(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch (error) {
    return String(value)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function serializeJsonArrayText(value) {
  return JSON.stringify(
    Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []
  );
}

async function getTableColumns(client, tableName) {
  const normalizedTableName = String(tableName || "").trim();

  if (!normalizedTableName) {
    return new Set();
  }

  if (!tableColumnsPromises.has(normalizedTableName)) {
    tableColumnsPromises.set(
      normalizedTableName,
      client
      .query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
        `,
        [normalizedTableName]
      )
      .then((result) => new Set(result.rows.map((row) => String(row.column_name || "").trim()).filter(Boolean)))
      .catch((error) => {
        tableColumnsPromises.delete(normalizedTableName);
        throw error;
      })
    );
  }

  return tableColumnsPromises.get(normalizedTableName);
}

async function getUserProfilesColumns(client) {
  return getTableColumns(client, "user_profiles");
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

function resolveRecipeSourceType(recipe = {}) {
  if (recipe.mode === "ai-generated") {
    return "assistant";
  }

  return "manual";
}

function normalizeUserEntryMode(value) {
  const normalizedValue = String(value || "").trim();
  const supportedModes = new Set(["manual", "ai_assisted", "external_lookup", "imported", "system_generated"]);

  return supportedModes.has(normalizedValue) ? normalizedValue : null;
}

function inferUserEntryMode(entry = {}) {
  const explicitMode = normalizeUserEntryMode(entry.entryMode || entry.entry_mode || entry.inputMode);

  if (explicitMode) {
    return explicitMode;
  }

  const source = String(entry.source || entry.nutritionSource || entry.nutritionSourceLabel || "").toLowerCase();

  if (source.includes("ai") || source.includes("analysis") || source.includes("meal-description") || source.includes("stima")) {
    return "ai_assisted";
  }

  if (source.includes("openfoodfacts") || source.includes("barcode")) {
    return "external_lookup";
  }

  if (source.includes("recipes")) {
    return "system_generated";
  }

  if (source.includes("import")) {
    return "imported";
  }

  return "manual";
}

function inferUserEntryMethod(entry = {}, fallback = "manual-form") {
  const explicitMethod = normalizeString(entry.entryMethod || entry.entry_method || entry.inputMethod);

  if (explicitMethod) {
    return explicitMethod;
  }

  const source = String(entry.source || entry.nutritionSource || entry.nutritionSourceLabel || "").toLowerCase();

  if (source.includes("openfoodfacts")) {
    return "barcode-openfoodfacts";
  }

  if (source.includes("ai-image")) {
    return "ai-image-import";
  }

  if (source.includes("ai-generated")) {
    return "ai-generated-list";
  }

  if (source.includes("meal-description") || source.includes("analysis") || source.includes("stima")) {
    return "ai-meal-description-analysis";
  }

  if (source.includes("recipes")) {
    return "recipe-application";
  }

  return fallback;
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
    mode: "postgres_primary",
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

async function resolveUserIdForContext(client, userContext, { createIfMissing = false } = {}) {
  if (userContext?.type === "authenticated_user") {
    const normalizedUserId = Number(userContext.userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Authenticated user context non valido: userId mancante.");
    }

    return normalizedUserId;
  }

  if (userContext?.type === "local_implicit" || !userContext) {
    return createIfMissing ? ensureLocalAppUser(client) : getLocalAppUserId(client);
  }

  throw new Error(`User context non supportato: ${userContext.type || "unknown"}.`);
}

async function replaceUserProfile(client, userId, profileState = {}) {
  const personal = profileState.personal || {};
  const medical = profileState.medical || {};
  const goals = profileState.goals || {};
  const availableColumns = await getUserProfilesColumns(client);
  const profileEntries = [
    ["full_name", normalizeString(personal.fullName)],
    ["age", normalizeNumber(personal.age)],
    ["gender", normalizeString(personal.gender)],
    ["height_cm", normalizeNumber(personal.heightCm)],
    ["current_weight_kg", normalizeNumber(personal.currentWeightKg)],
    ["target_weight_kg", normalizeNumber(personal.targetWeightKg)],
    ["activity_level", normalizeString(personal.activityLevel)],
    ["diet_type", normalizeString(personal.dietType)],
    ["allergies", normalizeString(medical.allergies)],
    ["medications", normalizeString(medical.medications)],
    ["medical_conditions", normalizeString(medical.medicalConditions)],
    ["dietary_preferences", normalizeString(medical.dietaryPreferences)],
    ["medical_lab_metrics", JSON.stringify(normalizeJsonArray(medical.labMetrics))],
    ["primary_objective", normalizeString(goals.primaryObjective)],
    ["secondary_objective", normalizeString(goals.secondaryObjective)],
    ["health_focus", normalizeString(goals.healthFocus)],
    ["daily_calories_goal", normalizeNumber(goals.calories)],
    ["daily_protein_goal", normalizeNumber(goals.protein)],
    ["daily_carbs_goal", normalizeNumber(goals.carbs)],
    ["daily_fats_goal", normalizeNumber(goals.fats)],
    ["daily_water_goal", normalizeNumber(goals.water)],
  ].filter(([columnName]) => availableColumns.has(columnName));

  const insertColumns = ["user_id", ...profileEntries.map(([columnName]) => columnName)];
  const insertPlaceholders = insertColumns.map((_, index) => `$${index + 1}`);
  const updateAssignments = profileEntries.map(([columnName]) => `${columnName} = EXCLUDED.${columnName}`);
  const queryValues = [userId, ...profileEntries.map(([, value]) => value)];

  await client.query(
    `
      INSERT INTO user_profiles (
        ${insertColumns.join(",\n        ")}
      )
      VALUES (${insertPlaceholders.join(", ")})
      ON CONFLICT (user_id)
      DO UPDATE SET
        ${updateAssignments.join(",\n        ")},
        updated_at = CURRENT_TIMESTAMP
    `,
    queryValues
  );
}

async function replaceNutritionMeals(client, userId, meals = []) {
  const availableColumns = await getTableColumns(client, "nutrition_meals");
  await client.query("DELETE FROM nutrition_meals WHERE user_id = $1", [userId]);

  for (const meal of Array.isArray(meals) ? meals : []) {
    const mealEntries = [
      ["user_id", userId],
      ["meal_name", normalizeString(meal.name) || "Pasto"],
      ["meal_type", normalizeString(meal.type)],
      ["consumed_at", resolveMealConsumedAt(meal)],
      ["calories", normalizeNumber(meal.calories) || 0],
      ["protein_g", normalizeNumber(meal.protein) || 0],
      ["carbs_g", normalizeNumber(meal.carbs) || 0],
      ["fats_g", normalizeNumber(meal.fats) || 0],
      ["nutrition_source", normalizeString(meal.nutritionSourceLabel || meal.nutritionSource)],
      ["source_note", normalizeString(meal.sourceNote)],
    ];

    if (availableColumns.has("entry_mode")) {
      mealEntries.push(["entry_mode", inferUserEntryMode(meal)]);
    }

    if (availableColumns.has("entry_method")) {
      mealEntries.push(["entry_method", inferUserEntryMethod(meal, "manual-meal-form")]);
    }

    await client.query(
      `
        INSERT INTO nutrition_meals (
          ${mealEntries.map(([columnName]) => columnName).join(",\n          ")}
        )
        VALUES (${mealEntries.map((_, index) => `$${index + 1}`).join(", ")})
      `,
      mealEntries.map(([, value]) => value)
    );
  }
}

async function replaceGroceryItems(client, userId, items = []) {
  const availableColumns = await getTableColumns(client, "grocery_items");
  await client.query("DELETE FROM grocery_items WHERE user_id = $1", [userId]);

  for (const item of Array.isArray(items) ? items : []) {
    const itemEntries = [
      ["user_id", userId],
      ["item_name", normalizeString(item.name) || "Prodotto"],
      ["quantity_label", normalizeString(item.quantity)],
      ["category", normalizeString(item.category)],
      ["is_completed", normalizeBoolean(item.completed)],
      ["barcode", normalizeString(item.barcode)],
      ["source", normalizeString(item.source)],
      ["nutriscore_grade", normalizeString(item.nutriscoreGrade)],
    ];

    if (availableColumns.has("entry_mode")) {
      itemEntries.push(["entry_mode", inferUserEntryMode(item)]);
    }

    if (availableColumns.has("entry_method")) {
      itemEntries.push(["entry_method", inferUserEntryMethod(item, "manual-grocery-form")]);
    }

    await client.query(
      `
        INSERT INTO grocery_items (
          ${itemEntries.map(([columnName]) => columnName).join(",\n          ")}
        )
        VALUES (${itemEntries.map((_, index) => `$${index + 1}`).join(", ")})
      `,
      itemEntries.map(([, value]) => value)
    );
  }
}

async function replacePantryItems(client, userId, items = []) {
  const availableColumns = await getTableColumns(client, "pantry_items");
  await client.query("DELETE FROM pantry_items WHERE user_id = $1", [userId]);

  for (const item of Array.isArray(items) ? items : []) {
    const itemEntries = [
      ["user_id", userId],
      ["item_name", normalizeString(item.name) || "Prodotto"],
      ["quantity_label", normalizeString(item.quantity)],
      ["category", normalizeString(item.category)],
      ["expires_on", normalizeDate(item.expiresOn || item.expiryDate)],
      ["barcode", normalizeString(item.barcode)],
      ["source", normalizeString(item.source)],
      ["nutriscore_grade", normalizeString(item.nutriscoreGrade)],
    ];

    if (availableColumns.has("entry_mode")) {
      itemEntries.push(["entry_mode", inferUserEntryMode(item)]);
    }

    if (availableColumns.has("entry_method")) {
      itemEntries.push(["entry_method", inferUserEntryMethod(item, "manual-pantry-form")]);
    }

    await client.query(
      `
        INSERT INTO pantry_items (
          ${itemEntries.map(([columnName]) => columnName).join(",\n          ")}
        )
        VALUES (${itemEntries.map((_, index) => `$${index + 1}`).join(", ")})
      `,
      itemEntries.map(([, value]) => value)
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

async function replaceRecipesState(client, userId, recipesState = {}) {
  await client.query("DELETE FROM saved_recipes WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM recipes WHERE created_by_user_id = $1", [userId]);

  const generatedRecipesById =
    recipesState.generatedRecipesById && typeof recipesState.generatedRecipesById === "object"
      ? recipesState.generatedRecipesById
      : {};
  const savedRecipeIds = Array.isArray(recipesState.savedRecipeIds) ? recipesState.savedRecipeIds : [];

  for (const recipe of Object.values(generatedRecipesById)) {
    if (!recipe || typeof recipe !== "object" || !recipe.id) {
      continue;
    }

    const result = await client.query(
      `
        INSERT INTO recipes (
          created_by_user_id,
          app_recipe_id,
          title,
          description,
          calories,
          protein_g,
          carbs_g,
          fats_g,
          duration_minutes,
          servings,
          difficulty_level,
          diet_type,
          meal_type,
          ingredients_text,
          instructions_text,
          recipe_source_type,
          generated_at,
          signature,
          recipe_payload
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb
        )
        ON CONFLICT (created_by_user_id, app_recipe_id) WHERE app_recipe_id IS NOT NULL
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          calories = EXCLUDED.calories,
          protein_g = EXCLUDED.protein_g,
          carbs_g = EXCLUDED.carbs_g,
          fats_g = EXCLUDED.fats_g,
          duration_minutes = EXCLUDED.duration_minutes,
          servings = EXCLUDED.servings,
          difficulty_level = EXCLUDED.difficulty_level,
          diet_type = EXCLUDED.diet_type,
          meal_type = EXCLUDED.meal_type,
          ingredients_text = EXCLUDED.ingredients_text,
          instructions_text = EXCLUDED.instructions_text,
          recipe_source_type = EXCLUDED.recipe_source_type,
          generated_at = EXCLUDED.generated_at,
          signature = EXCLUDED.signature,
          recipe_payload = EXCLUDED.recipe_payload,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `,
      [
        userId,
        normalizeString(recipe.id),
        normalizeString(recipe.title) || "Ricetta",
        normalizeString(recipe.description),
        normalizeNumber(recipe.calories),
        normalizeNumber(recipe.protein),
        normalizeNumber(recipe.carbs),
        normalizeNumber(recipe.fats),
        normalizeNumber(recipe.duration),
        normalizeNumber(recipe.servings),
        normalizeString(recipe.difficulty),
        normalizeString(Array.isArray(recipe.dietTypes) ? recipe.dietTypes[0] : recipe.dietTypes),
        normalizeString(Array.isArray(recipe.mealTypes) ? recipe.mealTypes[0] : recipe.mealTypes),
        serializeJsonArrayText(recipe.ingredients),
        serializeJsonArrayText(recipe.instructions),
        resolveRecipeSourceType(recipe),
        normalizeTimestamp(recipe.generatedAt),
        normalizeString(recipe.signature),
        JSON.stringify(cloneJson(recipe) || {}),
      ]
    );

    if (savedRecipeIds.includes(recipe.id)) {
      await client.query(
        `
          INSERT INTO saved_recipes (user_id, recipe_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, recipe_id) DO NOTHING
        `,
        [userId, result.rows[0].id]
      );
    }
  }
}

async function replaceOpenFoodFactsCache(client, productsByBarcode = {}) {
  const products = productsByBarcode && typeof productsByBarcode === "object" ? Object.values(productsByBarcode) : [];

  await client.query("DELETE FROM openfoodfacts_products_cache");

  for (const product of products) {
    if (!product || typeof product !== "object" || !product.barcode) {
      continue;
    }

    await client.query(
      `
        INSERT INTO openfoodfacts_products_cache (
          barcode,
          product_name,
          brand,
          category,
          quantity_label,
          serving_label,
          nutriscore_grade,
          nutriments,
          source_payload,
          fetched_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (barcode)
        DO UPDATE SET
          product_name = EXCLUDED.product_name,
          brand = EXCLUDED.brand,
          category = EXCLUDED.category,
          quantity_label = EXCLUDED.quantity_label,
          serving_label = EXCLUDED.serving_label,
          nutriscore_grade = EXCLUDED.nutriscore_grade,
          nutriments = EXCLUDED.nutriments,
          source_payload = EXCLUDED.source_payload,
          fetched_at = CURRENT_TIMESTAMP
      `,
      [
        normalizeString(product.barcode),
        normalizeString(product.name),
        normalizeString(product.brand),
        normalizeString(product.category),
        normalizeString(product.quantity),
        normalizeString(product.serving),
        normalizeString(product.nutriscoreGrade),
        JSON.stringify({
          calories: normalizeNumber(product.calories),
          protein: normalizeNumber(product.protein),
          carbs: normalizeNumber(product.carbs),
          fats: normalizeNumber(product.fats),
          sugar: normalizeNumber(product.sugar),
          fiber: normalizeNumber(product.fiber),
          nutriscoreScore: normalizeNumber(product.nutriscoreScore),
        }),
        JSON.stringify(cloneJson(product) || {}),
      ]
    );
  }
}

async function mirrorNutriTrackStateToPostgres(state, userContext) {
  const databaseStatus = buildDatabaseStatus();

  if (!databaseStatus.enabled) {
    return databaseStatus;
  }

  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      const userId = await resolveUserIdForContext(client, userContext, { createIfMissing: true });
      await replaceUserProfile(client, userId, state.profile);
      await replaceNutritionMeals(client, userId, state.nutrition?.meals);
      await replaceGroceryItems(client, userId, state.grocery?.items);
      await replacePantryItems(client, userId, state.grocery?.pantry);
      await replaceProgressLogs(client, userId, state.progress?.dailyLogs);
      await replaceRecipesState(client, userId, state.recipes);
      await replaceOpenFoodFactsCache(client, state.datasets?.openFoodFacts?.productsByBarcode);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return buildDatabaseStatus();
}

async function readUserProfile(client, userId) {
  const availableColumns = await getUserProfilesColumns(client);
  const selectColumns = [
    "full_name",
    "age",
    "gender",
    "height_cm",
    "current_weight_kg",
    "target_weight_kg",
    "activity_level",
    "diet_type",
    "allergies",
    "medications",
    "medical_conditions",
    "dietary_preferences",
    "medical_lab_metrics",
    "primary_objective",
    "secondary_objective",
    "health_focus",
    "daily_calories_goal",
    "daily_protein_goal",
    "daily_carbs_goal",
    "daily_fats_goal",
    "daily_water_goal",
  ]
    .filter((columnName) => availableColumns.has(columnName))
    .map((columnName) => `COALESCE(${columnName}, NULL) AS ${columnName}`);

  const result = await client.query(
    `
      SELECT
        ${selectColumns.join(",\n        ")}
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
      dietaryPreferences: row.dietary_preferences || "",
      labMetrics: normalizeJsonArray(row.medical_lab_metrics),
    },
    goals: {
      primaryObjective: row.primary_objective || "",
      secondaryObjective: row.secondary_objective || "",
      healthFocus: row.health_focus || "",
      calories: normalizeDbNumber(row.daily_calories_goal),
      protein: normalizeDbNumber(row.daily_protein_goal),
      carbs: normalizeDbNumber(row.daily_carbs_goal),
      fats: normalizeDbNumber(row.daily_fats_goal),
      water: normalizeDbNumber(row.daily_water_goal),
    },
  };
}

async function readNutritionMeals(client, userId) {
  const availableColumns = await getTableColumns(client, "nutrition_meals");
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
        source_note,
        ${availableColumns.has("entry_mode") ? "entry_mode" : "NULL"} AS entry_mode,
        ${availableColumns.has("entry_method") ? "entry_method" : "NULL"} AS entry_method
      FROM nutrition_meals
      WHERE user_id = $1
      ORDER BY consumed_at ASC, id ASC
    `,
    [userId]
  );

  const userProfile = await readUserProfile(client, userId);

  return {
    goals: {
      calories: normalizeDbNumber(userProfile?.goals?.calories),
      protein: normalizeDbNumber(userProfile?.goals?.protein),
      carbs: normalizeDbNumber(userProfile?.goals?.carbs),
      fats: normalizeDbNumber(userProfile?.goals?.fats),
    },
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
      entryMode: row.entry_mode || inferUserEntryMode({ nutritionSource: row.nutrition_source }),
      entryMethod: row.entry_method || inferUserEntryMethod({ nutritionSource: row.nutrition_source }, "manual-meal-form"),
    })),
  };
}

async function readGroceryItems(client, userId) {
  const availableColumns = await getTableColumns(client, "grocery_items");
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
        nutriscore_grade,
        ${availableColumns.has("entry_mode") ? "entry_mode" : "NULL"} AS entry_mode,
        ${availableColumns.has("entry_method") ? "entry_method" : "NULL"} AS entry_method
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
    entryMode: row.entry_mode || inferUserEntryMode({ source: row.source }),
    entryMethod: row.entry_method || inferUserEntryMethod({ source: row.source }, "manual-grocery-form"),
  }));
}

async function readPantryItems(client, userId) {
  const availableColumns = await getTableColumns(client, "pantry_items");
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
        nutriscore_grade,
        ${availableColumns.has("entry_mode") ? "entry_mode" : "NULL"} AS entry_mode,
        ${availableColumns.has("entry_method") ? "entry_method" : "NULL"} AS entry_method
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
    entryMode: row.entry_mode || inferUserEntryMode({ source: row.source }),
    entryMethod: row.entry_method || inferUserEntryMethod({ source: row.source }, "manual-pantry-form"),
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

async function readRecipesState(client, userId) {
  const recipesResult = await client.query(
    `
      SELECT
        id,
        app_recipe_id,
        title,
        description,
        calories,
        protein_g,
        carbs_g,
        fats_g,
        duration_minutes,
        servings,
        difficulty_level,
        diet_type,
        meal_type,
        ingredients_text,
        instructions_text,
        recipe_source_type,
        generated_at,
        signature,
        recipe_payload
      FROM recipes
      WHERE created_by_user_id = $1
      ORDER BY COALESCE(generated_at, created_at) DESC, id DESC
    `,
    [userId]
  );

  const savedRecipesResult = await client.query(
    `
      SELECT r.app_recipe_id
      FROM saved_recipes sr
      JOIN recipes r ON r.id = sr.recipe_id
      WHERE sr.user_id = $1
      ORDER BY sr.saved_at DESC, sr.id DESC
    `,
    [userId]
  );

  const generatedRecipes = recipesResult.rows.map((row) => {
    const payload = normalizeJsonObject(row.recipe_payload);
    const appRecipeId = row.app_recipe_id || payload.id || `recipe-db-${row.id}`;

    return {
      ...payload,
      id: appRecipeId,
      title: row.title || payload.title || "Ricetta",
      description: row.description || payload.description || "",
      calories: normalizeDbNumber(row.calories) ?? payload.calories ?? 0,
      protein: normalizeDbNumber(row.protein_g) ?? payload.protein ?? 0,
      carbs: normalizeDbNumber(row.carbs_g) ?? payload.carbs ?? 0,
      fats: normalizeDbNumber(row.fats_g) ?? payload.fats ?? 0,
      duration: normalizeDbNumber(row.duration_minutes) ?? payload.duration ?? 0,
      servings: normalizeDbNumber(row.servings) ?? payload.servings ?? 1,
      difficulty: row.difficulty_level || payload.difficulty || "Facile",
      dietTypes: payload.dietTypes || (row.diet_type ? [row.diet_type] : []),
      mealTypes: payload.mealTypes || (row.meal_type ? [row.meal_type] : []),
      ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : parseJsonArrayText(row.ingredients_text),
      instructions: Array.isArray(payload.instructions) ? payload.instructions : parseJsonArrayText(row.instructions_text),
      generatedAt:
        payload.generatedAt ||
        (row.generated_at instanceof Date ? row.generated_at.toISOString() : normalizeTimestamp(row.generated_at)) ||
        "",
      signature: row.signature || payload.signature || appRecipeId,
    };
  });

  const generatedRecipesById = Object.fromEntries(generatedRecipes.map((recipe) => [recipe.id, recipe]));

  return {
    history: generatedRecipes.slice(0, 6).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      generatedAt: recipe.generatedAt,
      signature: recipe.signature || recipe.id,
    })),
    savedRecipeIds: savedRecipesResult.rows
      .map((row) => String(row.app_recipe_id || "").trim())
      .filter(Boolean),
    generatedRecipesById,
  };
}

async function readOpenFoodFactsCache(client) {
  const result = await client.query(
    `
      SELECT
        barcode,
        product_name,
        brand,
        category,
        quantity_label,
        serving_label,
        nutriscore_grade,
        nutriments,
        source_payload
      FROM openfoodfacts_products_cache
      ORDER BY fetched_at DESC
      LIMIT 200
    `
  );

  const productsByBarcode = Object.fromEntries(
    result.rows
      .map((row) => {
        const payload = normalizeJsonObject(row.source_payload);
        const nutriments = normalizeJsonObject(row.nutriments);
        const barcode = String(row.barcode || payload.barcode || "").trim();

        if (!barcode) {
          return null;
        }

        return [
          barcode,
          {
            ...payload,
            source: payload.source || "openfoodfacts",
            retrievalSource: payload.retrievalSource || "cache",
            barcode,
            name: payload.name || row.product_name || "Prodotto senza nome",
            brand: payload.brand || row.brand || "OpenFoodFacts",
            category: payload.category || row.category || "",
            quantity: payload.quantity || row.quantity_label || "",
            serving: payload.serving || row.serving_label || "100 g",
            calories: payload.calories ?? normalizeDbNumber(nutriments.calories),
            protein: payload.protein ?? normalizeDbNumber(nutriments.protein),
            carbs: payload.carbs ?? normalizeDbNumber(nutriments.carbs),
            fats: payload.fats ?? normalizeDbNumber(nutriments.fats),
            sugar: payload.sugar ?? normalizeDbNumber(nutriments.sugar),
            fiber: payload.fiber ?? normalizeDbNumber(nutriments.fiber),
            nutriscoreGrade: payload.nutriscoreGrade || row.nutriscore_grade || "",
            nutriscoreScore: payload.nutriscoreScore ?? normalizeDbNumber(nutriments.nutriscoreScore),
          },
        ];
      })
      .filter(Boolean)
  );

  return {
    openFoodFacts: {
      productsByBarcode,
    },
  };
}

async function readNutriTrackStateFromPostgres(userContext) {
  const databaseStatus = buildDatabaseStatus();

  if (!databaseStatus.enabled) {
    return null;
  }

  return withClient(async (client) => {
    const userId = await resolveUserIdForContext(client, userContext, { createIfMissing: false });

    if (!userId) {
      return null;
    }

    const profile = await readUserProfile(client, userId);
    const nutrition = await readNutritionMeals(client, userId);
    const groceryItems = await readGroceryItems(client, userId);
    const pantryItems = await readPantryItems(client, userId);
    const progress = await readProgressLogs(client, userId);
    const recipes = await readRecipesState(client, userId);
    const datasets = (await readOpenFoodFactsCache(client)) || {};

    return {
      profile,
      nutrition,
      grocery: {
        items: groceryItems,
        pantry: pantryItems,
      },
      progress,
      recipes,
      datasets,
    };
  });
}

module.exports = {
  buildDatabaseStatus,
  mirrorNutriTrackStateToPostgres,
  readNutriTrackStateFromPostgres,
};
