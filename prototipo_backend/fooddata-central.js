const FOODDATA_CENTRAL_API_URL = "https://api.nal.usda.gov/fdc/v1";
const DEFAULT_SEARCH_LIMIT = 5;

const MACRO_NUTRIENTS = Object.freeze({
  calories: {
    ids: new Set([1008]),
    names: ["energy"],
  },
  protein: {
    ids: new Set([1003]),
    names: ["protein"],
  },
  carbs: {
    ids: new Set([1005]),
    names: ["carbohydrate"],
  },
  fats: {
    ids: new Set([1004]),
    names: ["total lipid", "fat"],
  },
});

const ITALIAN_FOOD_QUERY_MAP = Object.freeze([
  [/petto\s+di\s+pollo|pollo/i, "chicken breast"],
  [/tacchino/i, "turkey"],
  [/uov[oa]|uova/i, "egg"],
  [/pasta/i, "pasta"],
  [/riso/i, "rice"],
  [/lenticchie?/i, "lentils"],
  [/ceci/i, "chickpeas"],
  [/fagioli/i, "beans"],
  [/zucchine?/i, "zucchini"],
  [/pomodor[oi]/i, "tomato"],
  [/insalata/i, "lettuce"],
  [/mela/i, "apple"],
  [/banana/i, "banana"],
  [/latte/i, "milk"],
  [/yogurt/i, "yogurt"],
  [/olio/i, "olive oil"],
  [/pane/i, "bread"],
  [/patat[ae]/i, "potato"],
  [/tonno/i, "tuna"],
  [/salmone/i, "salmon"],
  [/formaggio/i, "cheese"],
]);

const RAW_FOOD_PATTERNS = Object.freeze([
  /\braw\b/i,
  /\buncooked\b/i,
  /\bunprepared\b/i,
  /\bcrudo\b/i,
  /\bcruda\b/i,
  /\bcrudi\b/i,
  /\bcrude\b/i,
]);

const PREPARED_FOOD_PATTERNS = Object.freeze([
  /\bcooked\b/i,
  /\bprepared\b/i,
  /\bboiled\b/i,
  /\bsteamed\b/i,
  /\bgrilled\b/i,
  /\bfried\b/i,
  /\broasted\b/i,
  /\bbaked\b/i,
  /\bcotto\b/i,
  /\bcotta\b/i,
  /\bcotti\b/i,
  /\bcotte\b/i,
  /\blesso\b/i,
  /\blessa\b/i,
  /\bbollito\b/i,
  /\bbollita\b/i,
  /\bvapore\b/i,
  /\bgrigliato\b/i,
  /\bgrigliata\b/i,
  /\bfritto\b/i,
  /\bfritta\b/i,
  /\barrosto\b/i,
  /\bforno\b/i,
]);

const DATA_TYPE_PRIORITY = Object.freeze({
  Foundation: 8,
  "SR Legacy": 6,
  "Survey (FNDDS)": 2,
  Branded: -4,
});

function getFoodDataCentralApiKey() {
  return String(process.env.FOODDATA_CENTRAL_API_KEY || process.env.FDC_API_KEY || "").trim();
}

function isFoodDataCentralConfigured() {
  return Boolean(getFoodDataCentralApiKey());
}

function normalizeFoodDataCentralQuery(value) {
  const rawValue = String(value || "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|gr|grammi|kg|ml|l|porzioni?|pezzi?|cucchiai?|cucchiaini?)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!rawValue) {
    return "";
  }

  const mappedEntry = ITALIAN_FOOD_QUERY_MAP.find(([pattern]) => pattern.test(rawValue));
  return mappedEntry ? mappedEntry[1] : rawValue;
}

function hasPatternMatch(value, patterns) {
  return patterns.some((pattern) => pattern.test(String(value || "")));
}

function getFoodPreparationPreference(value) {
  const rawValue = String(value || "");

  if (hasPatternMatch(rawValue, RAW_FOOD_PATTERNS)) {
    return "raw";
  }

  if (hasPatternMatch(rawValue, PREPARED_FOOD_PATTERNS)) {
    return "prepared";
  }

  return "raw";
}

function toOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNutrientAmount(foodNutrients = [], macroConfig) {
  const directMatch = foodNutrients.find((entry) => macroConfig.ids.has(Number(entry?.nutrientId)));

  if (directMatch) {
    return toOptionalNumber(directMatch.value);
  }

  const nameMatch = foodNutrients.find((entry) => {
    const name = String(entry?.nutrientName || entry?.name || "").toLowerCase();
    return macroConfig.names.some((candidate) => name.includes(candidate));
  });

  return nameMatch ? toOptionalNumber(nameMatch.value) : null;
}

function normalizeFoodDataCentralFood(food, query) {
  if (!food || !food.fdcId) {
    return null;
  }

  const foodNutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const nutrients = {
    calories: readNutrientAmount(foodNutrients, MACRO_NUTRIENTS.calories),
    protein: readNutrientAmount(foodNutrients, MACRO_NUTRIENTS.protein),
    carbs: readNutrientAmount(foodNutrients, MACRO_NUTRIENTS.carbs),
    fats: readNutrientAmount(foodNutrients, MACRO_NUTRIENTS.fats),
  };

  if (Object.values(nutrients).every((value) => value == null)) {
    return null;
  }

  return {
    provider: "FoodData Central",
    source: "fooddata-central",
    query,
    fdcId: food.fdcId,
    description: String(food.description || "").trim(),
    dataType: String(food.dataType || "").trim(),
    brandOwner: String(food.brandOwner || "").trim(),
    brandName: String(food.brandName || "").trim(),
    servingSize: toOptionalNumber(food.servingSize),
    servingSizeUnit: String(food.servingSizeUnit || "").trim(),
    nutrientsPer100g: nutrients,
  };
}

function scoreFoodDataCentralFood(food, options = {}) {
  const description = String(food?.description || "");
  const dataType = String(food?.dataType || "");
  let score = DATA_TYPE_PRIORITY[dataType] ?? 0;

  if (options.preparationPreference === "raw") {
    if (hasPatternMatch(description, RAW_FOOD_PATTERNS)) {
      score += 30;
    }

    if (hasPatternMatch(description, PREPARED_FOOD_PATTERNS)) {
      score -= 24;
    }
  }

  if (options.preparationPreference === "prepared") {
    if (hasPatternMatch(description, PREPARED_FOOD_PATTERNS)) {
      score += 18;
    }

    if (hasPatternMatch(description, RAW_FOOD_PATTERNS)) {
      score -= 12;
    }
  }

  return score;
}

function sortFoodDataCentralFoods(foods = [], options = {}) {
  return foods
    .map((food, index) => ({
      food,
      index,
      score: scoreFoodDataCentralFood(food, options),
    }))
    .sort((firstFood, secondFood) => secondFood.score - firstFood.score || firstFood.index - secondFood.index)
    .map((entry) => entry.food);
}

async function searchFoodDataCentralFoods(query, options = {}) {
  const normalizedQuery = normalizeFoodDataCentralQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const apiKey = getFoodDataCentralApiKey();

  if (!apiKey) {
    return [];
  }

  const pageSize = Math.max(1, Math.min(Number(options.limit) || DEFAULT_SEARCH_LIMIT, 25));
  const url = new URL(`${FOODDATA_CENTRAL_API_URL}/foods/search`);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: normalizedQuery,
      pageSize,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"],
    }),
  });

  if (response.status === 429) {
    const error = new Error("FoodData Central rate limit raggiunto.");
    error.statusCode = 429;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`FoodData Central API non raggiungibile (${response.status}).`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  const foods = Array.isArray(payload.foods) ? payload.foods : [];
  const sortedFoods = sortFoodDataCentralFoods(foods, {
    preparationPreference: options.preparationPreference || getFoodPreparationPreference(query),
  });

  return sortedFoods.map((food) => normalizeFoodDataCentralFood(food, normalizedQuery)).filter(Boolean);
}

async function buildFoodDataCentralReferences(queries = [], options = {}) {
  if (!isFoodDataCentralConfigured()) {
    return [];
  }

  const uniqueQueries = [];

  for (const rawQuery of queries) {
    const normalizedQuery = normalizeFoodDataCentralQuery(rawQuery);

    if (!normalizedQuery || uniqueQueries.some((entry) => entry.normalizedQuery === normalizedQuery)) {
      continue;
    }

    uniqueQueries.push({
      rawQuery,
      normalizedQuery,
      preparationPreference: getFoodPreparationPreference(rawQuery),
    });

    if (uniqueQueries.length >= (options.maxQueries || 8)) {
      break;
    }
  }

  const references = [];

  for (const query of uniqueQueries) {
    try {
      const [bestMatch] = await searchFoodDataCentralFoods(query.rawQuery, {
        limit: options.limitPerQuery || 3,
        preparationPreference: query.preparationPreference,
      });

      if (bestMatch) {
        references.push(bestMatch);
      }
    } catch (error) {
      console.warn("[FoodDataCentral] Lookup fallito.", {
        query: query.normalizedQuery,
        message: error.message,
      });
    }
  }

  return references;
}

module.exports = {
  buildFoodDataCentralReferences,
  isFoodDataCentralConfigured,
  normalizeFoodDataCentralQuery,
  searchFoodDataCentralFoods,
};
