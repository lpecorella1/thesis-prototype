function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getObjectiveLabel(value) {
  const labels = {
    "weight-loss": "Perdere peso",
    "weight-maintenance": "Mantenere il peso",
    "weight-gain": "Aumentare di peso",
    "eat-better": "Mangiare meglio",
    "muscle-gain": "Aumentare la massa muscolare",
    "energy-wellbeing": "Avere piu energia e benessere",
    "health-support": "Supportare una specifica esigenza di salute",
    "meal-regularity": "Mangiare con piu regolarita",
    "meal-quality": "Migliorare la qualita dei pasti",
    satiety: "Sentirmi piu sazio/a",
    "hunger-management": "Ridurre fame nervosa o abbuffate",
    "training-support": "Supportare allenamento e recupero",
    digestion: "Migliorare digestione e benessere intestinale",
  };

  return labels[String(value || "").trim()] || "";
}

function getHealthFocusLabel(value) {
  const labels = {
    glycemia: "Glicemia",
    cholesterol: "Colesterolo",
    "blood-pressure": "Pressione",
    digestion: "Digestione",
    intolerances: "Intolleranze o sensibilita",
    other: "Altro",
  };

  return labels[String(value || "").trim()] || "";
}

function buildGoalSummary(goals = {}) {
  const primaryObjectiveLabel = getObjectiveLabel(goals.primaryObjective);
  const secondaryObjectiveLabel = getObjectiveLabel(goals.secondaryObjective);
  const healthFocusLabel = getHealthFocusLabel(goals.healthFocus);
  const chunks = [];

  if (primaryObjectiveLabel) {
    chunks.push(`Obiettivo principale: ${primaryObjectiveLabel}`);
  }

  if (secondaryObjectiveLabel) {
    chunks.push(`Obiettivo secondario: ${secondaryObjectiveLabel}`);
  }

  if (healthFocusLabel) {
    chunks.push(`Focus salute: ${healthFocusLabel}`);
  }

  return chunks.join(". ");
}

function getDaysUntilIsoDate(dateKey) {
  if (!dateKey) {
    return null;
  }

  const targetDate = new Date(`${dateKey}T12:00:00`);

  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((targetDate.getTime() - today.getTime()) / 86_400_000);
}

function buildPantryPriority(daysUntilExpiry) {
  if (daysUntilExpiry == null) {
    return "normal";
  }

  if (daysUntilExpiry < 0) {
    return "expired";
  }

  if (daysUntilExpiry <= 2) {
    return "urgent";
  }

  if (daysUntilExpiry <= 5) {
    return "soon";
  }

  return "normal";
}

function normalizeInventoryItem(item, source) {
  if (!item || !item.name) {
    return null;
  }

  const daysUntilExpiry = getDaysUntilIsoDate(item.expiryDate);

  return {
    id: String(item.id || `${source}:${normalizeText(item.name)}`),
    source,
    name: String(item.name).trim(),
    normalizedName: normalizeText(item.name),
    quantity: String(item.quantity || "").trim(),
    category: String(item.category || "").trim(),
    expiryDate: item.expiryDate || "",
    daysUntilExpiry,
    priority: buildPantryPriority(daysUntilExpiry),
    barcode: String(item.barcode || "").trim(),
    checked: Boolean(item.checked),
  };
}

function sortInventoryItems(items = []) {
  return items.slice().sort((firstItem, secondItem) => {
    const firstRank = firstItem.daysUntilExpiry == null ? Number.POSITIVE_INFINITY : firstItem.daysUntilExpiry;
    const secondRank = secondItem.daysUntilExpiry == null ? Number.POSITIVE_INFINITY : secondItem.daysUntilExpiry;

    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    return firstItem.name.localeCompare(secondItem.name, "it");
  });
}

function normalizeRecentMeal(meal) {
  if (!meal || !meal.name) {
    return null;
  }

  return {
    id: String(meal.id || ""),
    name: String(meal.name).trim(),
    normalizedName: normalizeText(meal.name),
    date: String(meal.date || "").trim(),
    time: String(meal.time || "").trim(),
    source: String(meal.source || "").trim(),
    calories: toFiniteNumber(meal.calories, 0),
    protein: toFiniteNumber(meal.protein, 0),
    carbs: toFiniteNumber(meal.carbs, 0),
    fats: toFiniteNumber(meal.fats, 0),
    barcode: String(meal.barcode || "").trim(),
    brand: String(meal.brand || "").trim(),
  };
}

function sortRecentMeals(meals = []) {
  return meals.slice().sort((firstMeal, secondMeal) => {
    const firstKey = `${firstMeal.date || ""}T${firstMeal.time || "00:00"}`;
    const secondKey = `${secondMeal.date || ""}T${secondMeal.time || "00:00"}`;
    return secondKey.localeCompare(firstKey);
  });
}

function buildOpenFoodFactsRagRecord(product, sourceConfig = {}) {
  if (!product || !product.barcode) {
    return null;
  }

  const nutrition = {
    calories: toFiniteNumber(product.calories, null),
    protein: toFiniteNumber(product.protein, null),
    carbs: toFiniteNumber(product.carbs, null),
    fats: toFiniteNumber(product.fats, null),
    sugar: toFiniteNumber(product.sugar, null),
    fiber: toFiniteNumber(product.fiber, null),
  };

  const chunks = [
    `Barcode ${product.barcode}`,
    `Prodotto ${product.name || "Prodotto senza nome"}`,
    product.brand ? `Brand ${product.brand}` : "",
    product.category ? `Categoria ${product.category}` : "",
    product.quantity ? `Quantita ${product.quantity}` : "",
    product.serving ? `Porzione di riferimento ${product.serving}` : "",
    nutrition.calories !== null ? `Calorie ${nutrition.calories} kcal` : "",
    nutrition.protein !== null ? `Proteine ${nutrition.protein} g` : "",
    nutrition.carbs !== null ? `Carboidrati ${nutrition.carbs} g` : "",
    nutrition.fats !== null ? `Grassi ${nutrition.fats} g` : "",
    nutrition.sugar !== null ? `Zuccheri ${nutrition.sugar} g` : "",
    nutrition.fiber !== null ? `Fibre ${nutrition.fiber} g` : "",
    product.nutriscoreGrade ? `Nutri-Score ${String(product.nutriscoreGrade).toUpperCase()}` : "",
  ].filter(Boolean);

  return {
    id: `openfoodfacts:${product.barcode}`,
    barcode: String(product.barcode),
    title: String(product.name || "Prodotto senza nome").trim(),
    brand: String(product.brand || "").trim(),
    category: String(product.category || "").trim(),
    quantity: String(product.quantity || "").trim(),
    serving: String(product.serving || "").trim(),
    nutrition,
    nutriscore: {
      grade: product.nutriscoreGrade ? String(product.nutriscoreGrade).toLowerCase() : null,
      score: toFiniteNumber(product.nutriscoreScore, null),
    },
    source: {
      provider: "OpenFoodFacts",
      acquisition: product.retrievalSource === "dataset" ? "dataset-backed-catalog" : "live-api",
      officialDatasetPage: sourceConfig.officialDatasetPage || "",
      officialProjectPage: sourceConfig.officialProjectPage || "",
      license: sourceConfig.license || "",
      intendedPipeline: sourceConfig.retrievalStrategy || "",
    },
    text: chunks.join(". "),
  };
}

function mergePreferredArray(primaryItems = [], fallbackItems = []) {
  if (Array.isArray(primaryItems) && primaryItems.length > 0) {
    return primaryItems;
  }

  return Array.isArray(fallbackItems) ? fallbackItems : [];
}

function buildRecipesAssistantContext({ state, legacyContext = {}, overrides = {} } = {}) {
  const safeState = state && typeof state === "object" ? state : {};
  const profile = safeState.profile && typeof safeState.profile === "object" ? safeState.profile : {};
  const grocery = safeState.grocery && typeof safeState.grocery === "object" ? safeState.grocery : {};
  const nutrition = safeState.nutrition && typeof safeState.nutrition === "object" ? safeState.nutrition : {};
  const recipes = safeState.recipes && typeof safeState.recipes === "object" ? safeState.recipes : {};
  const datasets = safeState.datasets && typeof safeState.datasets === "object" ? safeState.datasets : {};

  const normalizedPantry = sortInventoryItems(
    mergePreferredArray(
      Array.isArray(grocery.pantry) ? grocery.pantry.map((item) => normalizeInventoryItem(item, "pantry")).filter(Boolean) : [],
      Array.isArray(legacyContext.pantry)
        ? legacyContext.pantry.map((item) => normalizeInventoryItem(item, "pantry")).filter(Boolean)
        : []
    )
  ).slice(0, 24);

  const normalizedGroceryItems = sortInventoryItems(
    Array.isArray(grocery.items) ? grocery.items.map((item) => normalizeInventoryItem(item, "grocery")).filter(Boolean) : []
  ).slice(0, 40);

  const normalizedRecentMeals = sortRecentMeals(
    Array.isArray(nutrition.meals) ? nutrition.meals.map(normalizeRecentMeal).filter(Boolean) : []
  ).slice(0, 12);

  const recentRecipes = mergePreferredArray(
    Array.isArray(recipes.history)
      ? recipes.history
          .map((entry) => ({
            id: String(entry.id || ""),
            title: String(entry.title || "").trim(),
            generatedAt: String(entry.generatedAt || "").trim(),
            signature: String(entry.signature || entry.id || "").trim(),
            ingredients: Array.isArray(recipes.generatedRecipesById?.[entry.id]?.ingredients)
              ? recipes.generatedRecipesById[entry.id].ingredients.map((item) => String(item || "").trim()).filter(Boolean)
              : [],
          }))
          .filter((entry) => entry.title)
      : [],
    Array.isArray(legacyContext.recentRecipes)
      ? legacyContext.recentRecipes
          .map((entry) => ({
            id: String(entry.id || ""),
            title: String(entry.title || "").trim(),
            generatedAt: String(entry.generatedAt || "").trim(),
            signature: String(entry.signature || entry.id || "").trim(),
            ingredients: Array.isArray(entry.ingredients)
              ? entry.ingredients.map((item) => String(item || "").trim()).filter(Boolean)
              : [],
          }))
          .filter((entry) => entry.title)
      : []
  ).slice(0, 8);

  const openFoodFactsSource =
    datasets.openFoodFacts && datasets.openFoodFacts.source && typeof datasets.openFoodFacts.source === "object"
      ? datasets.openFoodFacts.source
      : {};
  const openFoodFactsProducts = Object.values(datasets.openFoodFacts?.productsByBarcode || {})
    .map((product) => buildOpenFoodFactsRagRecord(product, openFoodFactsSource))
    .filter(Boolean)
    .slice(0, 24);

  const resolvedGoals =
    profile.goals && typeof profile.goals === "object"
      ? profile.goals
      : nutrition.goals && typeof nutrition.goals === "object"
      ? nutrition.goals
      : legacyContext.profile || {};

  const currentRecipe =
    overrides.currentRecipe ||
    recipes.currentRecipe ||
    legacyContext.currentRecipe ||
    null;

  const generator = {
    ...(recipes.generator && typeof recipes.generator === "object" ? cloneJson(recipes.generator) : {}),
    ...(legacyContext.generator && typeof legacyContext.generator === "object" ? cloneJson(legacyContext.generator) : {}),
    ...(overrides.generator && typeof overrides.generator === "object" ? cloneJson(overrides.generator) : {}),
  };
  const goalSummary = buildGoalSummary(resolvedGoals);

  return {
    source: {
      stateBacked: Boolean(state && typeof state === "object"),
      pantrySource:
        Array.isArray(grocery.pantry) && grocery.pantry.length > 0
          ? "nutritrack-state"
          : Array.isArray(legacyContext.pantry) && legacyContext.pantry.length > 0
          ? "legacy-client-context"
          : "empty",
    },
    pantry: normalizedPantry,
    groceryItems: normalizedGroceryItems,
    recentMeals: normalizedRecentMeals,
    recentRecipes,
    profile: {
      primaryObjective: String(resolvedGoals.primaryObjective || "").trim(),
      primaryObjectiveLabel: getObjectiveLabel(resolvedGoals.primaryObjective),
      secondaryObjective: String(resolvedGoals.secondaryObjective || "").trim(),
      secondaryObjectiveLabel: getObjectiveLabel(resolvedGoals.secondaryObjective),
      healthFocus: String(resolvedGoals.healthFocus || "").trim(),
      healthFocusLabel: getHealthFocusLabel(resolvedGoals.healthFocus),
      goalSummary,
      calories: toFiniteNumber(resolvedGoals.calories, 2000),
      protein: toFiniteNumber(resolvedGoals.protein, 150),
      carbs: toFiniteNumber(resolvedGoals.carbs, 250),
      fats: toFiniteNumber(resolvedGoals.fats, 65),
      dietType: String(profile.personal?.dietType || generator.dietType || legacyContext.profile?.dietType || "").trim(),
      activityLevel: String(profile.personal?.activityLevel || legacyContext.profile?.activityLevel || "").trim(),
      allergies: String(profile.medical?.allergies || "").trim(),
      medicalConditions: String(profile.medical?.medicalConditions || "").trim(),
      dietaryPreferences: String(profile.medical?.dietaryPreferences || "").trim(),
    },
    generator,
    currentRecipe: currentRecipe
      ? {
          title: String(currentRecipe.title || "").trim(),
          calories: toFiniteNumber(currentRecipe.calories, null),
          protein: toFiniteNumber(currentRecipe.protein, null),
          carbs: toFiniteNumber(currentRecipe.carbs, null),
          fats: toFiniteNumber(currentRecipe.fats, null),
          ingredients: Array.isArray(currentRecipe.ingredients)
            ? currentRecipe.ingredients.map((item) => String(item || "").trim()).filter(Boolean)
            : [],
        }
      : null,
    openFoodFactsKnowledge: {
      provider: "OpenFoodFacts",
      records: openFoodFactsProducts,
    },
    constraints: {
      avoidRecentlyUsedIngredients: true,
      preferPantry: true,
    },
  };
}

module.exports = {
  buildRecipesAssistantContext,
};
