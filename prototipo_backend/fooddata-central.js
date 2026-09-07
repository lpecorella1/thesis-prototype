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

  return foods.map((food) => normalizeFoodDataCentralFood(food, normalizedQuery)).filter(Boolean);
}

async function buildFoodDataCentralReferences(queries = [], options = {}) {
  if (!isFoodDataCentralConfigured()) {
    return [];
  }

  const uniqueQueries = [...new Set(queries.map(normalizeFoodDataCentralQuery).filter(Boolean))].slice(0, options.maxQueries || 8);
  const references = [];

  for (const query of uniqueQueries) {
    try {
      const [bestMatch] = await searchFoodDataCentralFoods(query, { limit: options.limitPerQuery || 3 });

      if (bestMatch) {
        references.push(bestMatch);
      }
    } catch (error) {
      console.warn("[FoodDataCentral] Lookup fallito.", {
        query,
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
