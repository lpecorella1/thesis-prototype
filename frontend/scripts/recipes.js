// Recipe lookup and local state helpers.
function getRecipeById(recipeId) {
  if (!recipeId) {
    return null;
  }

  const libraryRecipe = recipeLibrary.find((recipe) => recipe.id === recipeId);

  if (libraryRecipe) {
    return libraryRecipe;
  }

  if (appState.recipes?.generatedRecipesById?.[recipeId]) {
    return appState.recipes.generatedRecipesById[recipeId];
  }

  if (appState.recipes?.currentRecipe?.id === recipeId) {
    return appState.recipes.currentRecipe;
  }

  return null;
}

function slugifyRecipeValue(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureGeneratedRecipeStore() {
  if (!appState.recipes.generatedRecipesById || typeof appState.recipes.generatedRecipesById !== "object") {
    appState.recipes.generatedRecipesById = {};
  }
}

function registerRecipe(recipe) {
  if (!recipe?.id) {
    return recipe;
  }

  ensureGeneratedRecipeStore();
  appState.recipes.generatedRecipesById[recipe.id] = structuredClone(recipe);
  return recipe;
}

function getRecipeDietLabel(value) {
  const labels = {
    balanced: "Bilanciata",
    "high-protein": "High protein",
    vegetarian: "Vegetariana",
    vegan: "Vegana",
  };

  return labels[value] || value;
}

function getRecipeMealLabel(value) {
  const labels = {
    breakfast: "Colazione",
    lunch: "Pranzo",
    dinner: "Cena",
    snack: "Snack",
  };

  return labels[value] || value;
}

function setRecipeFeedback(message) {
  const feedback = document.querySelector("[data-recipe-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

// Recipe generation catalog and prompt parsing helpers.
function buildIngredientLine(component) {
  return `${component.amount} ${component.name}`;
}

function sumRecipeNutrition(components) {
  return components.reduce(
    (totals, component) => ({
      calories: totals.calories + component.calories,
      protein: totals.protein + component.protein,
      carbs: totals.carbs + component.carbs,
      fats: totals.fats + component.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

function getRecentRecipeSignatures(limit = 10) {
  return appState.recipes.history.slice(0, limit).map((entry) => entry.signature).filter(Boolean);
}

function getPromptTokens(prompt) {
  return String(prompt || "")
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .filter((token) => token.length >= 3);
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9àèéìòù]+/g, " ")
    .trim();
}

function getComparableTokens(value, options = {}) {
  const includeGenericTokens = options.includeGenericTokens === true;
  const tokens = normalizeComparableText(value)
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !RECIPE_TOKEN_STOPWORDS.has(token));

  const filteredTokens = includeGenericTokens
    ? tokens
    : tokens.filter((token) => !RECIPE_GENERIC_TOKENS.has(token));

  return filteredTokens.length > 0 ? filteredTokens : tokens;
}

// Local recipe generation catalog used by the deterministic generator.
function buildRecipeComponentCatalog() {
  const proteins = {
    chicken: { name: "pollo grigliato", amount: "160 g di", calories: 260, protein: 34, carbs: 0, fats: 11, diets: ["balanced", "high-protein"], tags: ["pollo", "proteico", "grigliato"] },
    salmon: { name: "salmone al forno", amount: "150 g di", calories: 310, protein: 30, carbs: 0, fats: 20, diets: ["balanced", "high-protein"], tags: ["salmone", "pesce", "omega"] },
    turkey: { name: "fesa di tacchino", amount: "160 g di", calories: 220, protein: 36, carbs: 0, fats: 6, diets: ["balanced", "high-protein"], tags: ["tacchino", "lean"] },
    tofu: { name: "tofu croccante", amount: "180 g di", calories: 250, protein: 22, carbs: 8, fats: 15, diets: ["balanced", "vegetarian", "vegan"], tags: ["tofu", "vegano"] },
    tempeh: { name: "tempeh saltato", amount: "150 g di", calories: 290, protein: 27, carbs: 16, fats: 14, diets: ["balanced", "vegetarian", "vegan", "high-protein"], tags: ["tempeh", "vegano", "fermentato"] },
    eggs: { name: "uova strapazzate", amount: "3", calories: 230, protein: 21, carbs: 2, fats: 15, diets: ["balanced", "vegetarian", "high-protein"], tags: ["uova", "colazione", "proteico"] },
    yogurt: { name: "yogurt greco", amount: "170 g di", calories: 110, protein: 18, carbs: 5, fats: 2, diets: ["balanced", "vegetarian", "high-protein"], tags: ["yogurt", "cremoso"] },
    hummus: { name: "hummus", amount: "90 g di", calories: 210, protein: 7, carbs: 17, fats: 12, diets: ["balanced", "vegetarian", "vegan"], tags: ["hummus", "ceci"] },
    beans: { name: "ceci speziati", amount: "170 g di", calories: 260, protein: 13, carbs: 34, fats: 8, diets: ["balanced", "vegetarian", "vegan"], tags: ["ceci", "legumi"] },
  };

  const carbs = {
    oats: { name: "fiocchi d'avena", amount: "55 g di", calories: 214, protein: 7, carbs: 36, fats: 4, mealTypes: ["breakfast", "snack"], tags: ["avena", "colazione"] },
    granola: { name: "granola croccante", amount: "35 g di", calories: 158, protein: 4, carbs: 24, fats: 5, mealTypes: ["breakfast", "snack"], tags: ["granola", "croccante"] },
    toast: { name: "pane integrale tostato", amount: "2 fette di", calories: 170, protein: 8, carbs: 28, fats: 3, mealTypes: ["breakfast", "snack"], tags: ["toast", "pane"] },
    rice: { name: "riso integrale", amount: "150 g di", calories: 220, protein: 5, carbs: 46, fats: 2, mealTypes: ["lunch", "dinner"], tags: ["riso", "bowl"] },
    quinoa: { name: "quinoa", amount: "150 g di", calories: 225, protein: 8, carbs: 39, fats: 4, mealTypes: ["lunch", "dinner"], tags: ["quinoa", "gluten free"] },
    pasta: { name: "pasta integrale", amount: "85 g di", calories: 298, protein: 11, carbs: 56, fats: 3, mealTypes: ["lunch", "dinner"], tags: ["pasta", "comfort"] },
    potatoes: { name: "patate arrosto", amount: "220 g di", calories: 210, protein: 5, carbs: 40, fats: 4, mealTypes: ["lunch", "dinner"], tags: ["patate", "forno"] },
    wrap: { name: "wrap integrale", amount: "1", calories: 190, protein: 7, carbs: 31, fats: 5, mealTypes: ["lunch", "dinner"], tags: ["wrap", "piadina"] },
    fruit: { name: "frutta fresca", amount: "120 g di", calories: 72, protein: 1, carbs: 18, fats: 0, mealTypes: ["breakfast", "snack"], tags: ["frutta", "dolce"] },
  };

  const vegetables = {
    berries: { name: "frutti rossi", amount: "90 g di", calories: 40, protein: 1, carbs: 9, fats: 0, tags: ["frutti", "berries"] },
    apple: { name: "mela e cannella", amount: "1 porzione di", calories: 78, protein: 0, carbs: 20, fats: 0, tags: ["mela", "cannella"] },
    banana: { name: "banana a rondelle", amount: "1", calories: 96, protein: 1, carbs: 23, fats: 0, tags: ["banana"] },
    spinachTomato: { name: "spinaci e pomodorini", amount: "120 g di", calories: 38, protein: 3, carbs: 6, fats: 0, tags: ["spinaci", "pomodorini"] },
    mediterranean: { name: "verdure mediterranee", amount: "180 g di", calories: 72, protein: 3, carbs: 13, fats: 2, tags: ["zucchine", "peperoni", "pomodorini"] },
    broccoliCarrot: { name: "broccoli e carote", amount: "180 g di", calories: 84, protein: 5, carbs: 15, fats: 1, tags: ["broccoli", "carote"] },
    mushrooms: { name: "funghi e zucchine", amount: "170 g di", calories: 58, protein: 4, carbs: 9, fats: 1, tags: ["funghi", "zucchine"] },
    cucumberTomato: { name: "cetriolo e pomodoro", amount: "160 g di", calories: 42, protein: 2, carbs: 8, fats: 0, tags: ["cetriolo", "pomodoro"] },
  };

  const extras = {
    chia: { name: "semi di chia", amount: "10 g di", calories: 49, protein: 2, carbs: 4, fats: 3, tags: ["chia", "fibre"] },
    nuts: { name: "noci tritate", amount: "12 g di", calories: 78, protein: 2, carbs: 2, fats: 7, tags: ["noci", "crunch"] },
    avocado: { name: "avocado", amount: "70 g di", calories: 112, protein: 1, carbs: 6, fats: 10, tags: ["avocado", "healthy fats"] },
    feta: { name: "feta", amount: "35 g di", calories: 93, protein: 5, carbs: 1, fats: 7, tags: ["feta", "mediterraneo"] },
    parmesan: { name: "parmigiano", amount: "15 g di", calories: 58, protein: 5, carbs: 0, fats: 4, tags: ["parmigiano"] },
    tahini: { name: "salsa tahina e limone", amount: "18 g di", calories: 95, protein: 3, carbs: 3, fats: 8, tags: ["tahina", "limone"] },
    pesto: { name: "pesto leggero", amount: "20 g di", calories: 86, protein: 2, carbs: 2, fats: 8, tags: ["pesto"] },
    yogurtSauce: { name: "salsa yogurt e senape", amount: "35 g di", calories: 42, protein: 4, carbs: 2, fats: 1, tags: ["yogurt", "senape"] },
  };

  return { proteins, carbs, vegetables, extras };
}

function getRecipeFormatTemplates(mealType) {
  const templates = {
    breakfast: [
      { id: "bowl", title: "{proteinLabel} Bowl con {vegLabel}", description: "Colazione cremosa e bilanciata, pronta in pochi minuti.", duration: 8, servings: 1, difficulty: "Facile" },
      { id: "overnight", title: "Overnight {carbLabel} con {vegLabel}", description: "Preparazione da fare in anticipo per una mattina piu semplice.", duration: 10, servings: 1, difficulty: "Facile" },
      { id: "toast", title: "Toast di {proteinLabel} con {vegLabel}", description: "Colazione salata ad alto potere saziante.", duration: 10, servings: 1, difficulty: "Facile" },
      { id: "scramble", title: "{proteinLabel} con {carbLabel} e {vegLabel}", description: "Piatto proteico veloce, ottimo anche per brunch.", duration: 12, servings: 1, difficulty: "Facile" },
    ],
    snack: [
      { id: "cup", title: "Cup di {proteinLabel} con {vegLabel}", description: "Snack rapido con buon equilibrio tra proteine e carboidrati.", duration: 6, servings: 1, difficulty: "Facile" },
      { id: "toast-snack", title: "Toast snack con {proteinLabel} e {vegLabel}", description: "Spuntino piu sostanzioso ma ancora semplice da preparare.", duration: 7, servings: 1, difficulty: "Facile" },
      { id: "box", title: "Snack box con {proteinLabel} e {vegLabel}", description: "Idea pratica da portare fuori casa o in ufficio.", duration: 5, servings: 1, difficulty: "Facile" },
    ],
    lunch: [
      { id: "bowl", title: "{proteinLabel} Bowl con {carbLabel} e {vegLabel}", description: "Piatto unico completo, adatto a pausa pranzo e meal prep.", duration: 24, servings: 2, difficulty: "Facile" },
      { id: "wrap", title: "Wrap di {proteinLabel} con {vegLabel}", description: "Pranzo veloce e portabile, con buon bilanciamento dei macro.", duration: 18, servings: 1, difficulty: "Facile" },
      { id: "pasta", title: "{carbLabel} con {proteinLabel} e {vegLabel}", description: "Versione smart di un comfort food, piu centrata sugli obiettivi nutrizionali.", duration: 26, servings: 2, difficulty: "Media" },
      { id: "salad", title: "Insalata completa di {proteinLabel} e {vegLabel}", description: "Pranzo fresco, leggero ma con una quota proteica credibile.", duration: 16, servings: 1, difficulty: "Facile" },
    ],
    dinner: [
      { id: "plate", title: "{proteinLabel} con {carbLabel} e {vegLabel}", description: "Cena completa e gestibile anche in settimana.", duration: 28, servings: 2, difficulty: "Facile" },
      { id: "stirfry", title: "Stir-fry di {proteinLabel} con {vegLabel}", description: "Cena rapida in padella con sapori netti e buon volume.", duration: 20, servings: 2, difficulty: "Facile" },
      { id: "traybake", title: "Teglia di {proteinLabel} e {vegLabel}", description: "Versione da forno con poca gestione e ottima resa per meal prep.", duration: 32, servings: 2, difficulty: "Facile" },
      { id: "bowl", title: "Power bowl di {proteinLabel} con {carbLabel}", description: "Cena energizzante pensata per recupero e sazieta'.", duration: 25, servings: 2, difficulty: "Media" },
    ],
  };

  return templates[mealType] || templates.dinner;
}

function getRecipeIngredientVocabulary() {
  const catalog = buildRecipeComponentCatalog();
  const values = [
    ...Object.values(catalog.proteins),
    ...Object.values(catalog.carbs),
    ...Object.values(catalog.vegetables),
    ...Object.values(catalog.extras),
  ];

  return [...new Set(values.flatMap((item) => getComparableTokens([item.name, ...(item.tags || [])].join(" "))))];
}

// Prompt parsing and constraint extraction for generator requests.
function extractMaxDurationFromPrompt(prompt) {
  const match = String(prompt || "").match(/(\d+)\s*(?:min|mins|minuti|minute)\b/i);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseRecipePromptConstraints(prompt) {
  const normalizedPrompt = normalizeComparableText(prompt);
  const ingredientVocabulary = getRecipeIngredientVocabulary();
  const requestedIngredientTerms = ingredientVocabulary.filter((term) => normalizedPrompt.includes(term));

  return {
    normalizedPrompt,
    wantsPantry: /(dispensa|frigo|pantry|ingredienti gia|ingredienti già|quello che ho|quello che c e|quello che c'è)/i.test(prompt),
    strictPantry: /(usa|utilizza|solo|quello che ho|che ho in dispensa|che ho in frigo|ingredienti gia|ingredienti già)/i.test(prompt),
    maxDuration: extractMaxDurationFromPrompt(prompt),
    excludeLactose: /(senza lattosio|lactose free)/i.test(prompt),
    excludeGluten: /(senza glutine|gluten free)/i.test(prompt),
    preferHighProtein: /(high protein|proteic|proteica|proteico|ricco di proteine)/i.test(prompt),
    requestedIngredientTerms,
  };
}

function getRecipeSearchText(recipe) {
  return normalizeComparableText([
    recipe.title,
    recipe.description,
    ...(recipe.ingredients || []),
    ...(recipe.instructions || []),
  ].join(" "));
}

function textContainsComparableToken(text, token) {
  return getComparableTokens(text, { includeGenericTokens: true }).some(
    (candidate) => candidate === token || candidate.includes(token) || token.includes(candidate)
  );
}

// Candidate scoring and recommendation selection for generated recipes.
function getRecipeConstraintViolations(recipe, constraints, pantryMatches) {
  const violations = [];
  const recipeText = getRecipeSearchText(recipe);
  const maxDuration = Number(recipe.duration) || 0;

  if (constraints.maxDuration && maxDuration > constraints.maxDuration) {
    violations.push("max-duration");
  }

  if (constraints.excludeLactose && /yogurt|feta|parmigiano|latte/.test(recipeText)) {
    violations.push("exclude-lactose");
  }

  if (constraints.excludeGluten && /pasta|pane|toast|wrap|granola|avena/.test(recipeText)) {
    violations.push("exclude-gluten");
  }

  if (constraints.preferHighProtein) {
    const proteinTarget = recipe.mealTypes?.includes("snack") || recipe.mealTypes?.includes("breakfast") ? 18 : 25;

    if ((Number(recipe.protein) || 0) < proteinTarget) {
      violations.push("high-protein");
    }
  }

  if (constraints.requestedIngredientTerms.some((term) => !textContainsComparableToken(recipeText, term))) {
    violations.push("ingredient-term");
  }

  if (constraints.strictPantry && appState.grocery.pantry.length > 0 && pantryMatches.length === 0) {
    violations.push("pantry");
  }

  return violations;
}

function getRecipeCriteriaNote(violations, constraints) {
  if (violations.length === 0) {
    return "";
  }

  if (violations.includes("pantry") && constraints.wantsPantry) {
    return "Nessun match diretto con la dispensa.";
  }

  if (violations.includes("ingredient-term")) {
    return "Non ho trovato una ricetta che includa tutti gli ingredienti richiesti, quindi ho scelto l'alternativa più coerente.";
  }

  if (violations.includes("max-duration")) {
    return "Non ho trovato una ricetta dentro il tempo richiesto, quindi ho scelto l'opzione più vicina.";
  }

  if (violations.includes("exclude-lactose") || violations.includes("exclude-gluten")) {
    return "Non ho trovato una ricetta che rispetti completamente tutte le esclusioni richieste.";
  }

  if (violations.includes("high-protein")) {
    return "Non ho trovato una ricetta high-protein, quindi ho scelto il compromesso più vicino.";
  }

  return "";
}

function getRecipeComponentSets(filters) {
  const catalog = buildRecipeComponentCatalog();
  const mealType = filters.mealType;
  const dietType = filters.dietType;
  const prompt = String(filters.prompt || "").toLowerCase();

  const proteins = Object.values(catalog.proteins).filter((item) => item.diets.includes(dietType) && (!prompt.includes("senza lattosio") || !/yogurt/.test(item.name)));
  const carbs = Object.values(catalog.carbs).filter((item) => item.mealTypes.includes(mealType));
  const vegetables = Object.values(catalog.vegetables);
  const extras = Object.values(catalog.extras).filter((item) => {
    if (dietType === "vegan") {
      return !/feta|parmigiano|yogurt/.test(item.name);
    }

    return true;
  });

  return { proteins, carbs, vegetables, extras };
}

function buildRecipeInstructions(mealType, template, parts) {
  const intro = {
    breakfast: `Prepara ${parts.carb.name} e tieni pronta la base proteica.`,
    snack: `Sistema ${parts.protein.name} e ${parts.vegetable.name} in una bowl o lunch box.`,
    lunch: `Cuoci ${parts.carb.name} e prepara ${parts.protein.name} come componente principale.`,
    dinner: `Prepara ${parts.protein.name} e porta a cottura ${parts.carb.name} o l'accompagnamento scelto.`,
  };

  const finishingVerb = template.id === "traybake" ? "Completa la teglia" : "Completa il piatto";

  return [
    intro[mealType] || intro.dinner,
    `Aggiungi ${parts.vegetable.name} e condisci con ${parts.extra.name}.`,
    `${finishingVerb} regolando sale, spezie ed eventuale succo di limone secondo gusto.`,
    mealType === "breakfast" || mealType === "snack"
      ? "Servi subito oppure conserva in frigo se vuoi prepararlo in anticipo."
      : "Impiatta e tieni da parte una porzione extra se vuoi usarla per meal prep.",
  ];
}

function buildGeneratedRecipeCandidate(filters, template, parts) {
  const nutrition = sumRecipeNutrition([parts.protein, parts.carb, parts.vegetable, parts.extra]);
  const title = template.title
    .replace("{proteinLabel}", parts.protein.name)
    .replace("{carbLabel}", parts.carb.name)
    .replace("{vegLabel}", parts.vegetable.name);
  const signature = slugifyRecipeValue(`${filters.mealType}-${filters.dietType}-${template.id}-${parts.protein.name}-${parts.carb.name}-${parts.vegetable.name}-${parts.extra.name}`);
  const recipe = {
    id: `recipe-${signature}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: template.description,
    calories: roundMacroValue(nutrition.calories),
    protein: roundMacroValue(nutrition.protein),
    carbs: roundMacroValue(nutrition.carbs),
    fats: roundMacroValue(nutrition.fats),
    duration: template.duration,
    servings: template.servings,
    difficulty: template.difficulty,
    dietTypes: [filters.dietType],
    mealTypes: [filters.mealType],
    ingredients: [
      buildIngredientLine(parts.protein),
      buildIngredientLine(parts.carb),
      buildIngredientLine(parts.vegetable),
      buildIngredientLine(parts.extra),
      "Sale, pepe e spezie a piacere",
    ],
    instructions: buildRecipeInstructions(filters.mealType, template, parts),
    generatedAt: new Date().toISOString(),
    prompt: String(filters.prompt || "").trim(),
    mode: "generated-local",
    signature,
  };

  return recipe;
}

function buildGeneratedRecipeCandidates(filters) {
  const templates = getRecipeFormatTemplates(filters.mealType);
  const { proteins, carbs, vegetables, extras } = getRecipeComponentSets(filters);
  const candidates = [];

  templates.forEach((template, templateIndex) => {
    proteins.forEach((protein, proteinIndex) => {
      carbs.forEach((carb, carbIndex) => {
        vegetables.forEach((vegetable, vegetableIndex) => {
          const extra = extras[(templateIndex + proteinIndex + carbIndex + vegetableIndex) % extras.length];

          if (!extra) {
            return;
          }

          candidates.push(buildGeneratedRecipeCandidate(filters, template, { protein, carb, vegetable, extra }));
        });
      });
    });
  });

  return candidates;
}

function recipeMatchesPrompt(recipe, prompt) {
  if (!prompt) {
    return true;
  }

  const searchableText = [
    recipe.title,
    recipe.description,
    ...recipe.ingredients,
    ...recipe.instructions,
  ]
    .join(" ")
    .toLowerCase();

  const promptTokens = prompt
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .filter((token) => token.length >= 3);

  if (promptTokens.length === 0) {
    return true;
  }

  return promptTokens.some((token) => searchableText.includes(token));
}

function buildRecipeRecommendation(filters) {
  const targetCalories = Number(filters.caloriesTarget) || 500;
  const prompt = String(filters.prompt || "").trim();
  const pantryNames = appState.grocery.pantry.map((item) => item.name.toLowerCase());
  const recentSignatures = getRecentRecipeSignatures();
  const constraints = parseRecipePromptConstraints(prompt);
  const promptTokens = getPromptTokens(prompt);
  const candidatePool = [
    ...buildGeneratedRecipeCandidates(filters),
    ...recipeLibrary
      .filter((recipe) => recipe.dietTypes.includes(filters.dietType))
      .filter((recipe) => recipe.mealTypes.includes(filters.mealType))
      .map((recipe) => ({
        ...recipe,
        generatedAt: new Date().toISOString(),
        prompt,
        mode: "seed-library",
        signature: recipe.id,
      })),
  ];
  const rankedRecipes = candidatePool
    .map((recipe) => {
      const pantryMatches = getPantryMatchesForRecipe(recipe);
      const violations = getRecipeConstraintViolations(recipe, constraints, pantryMatches);
      const calorieDelta = Math.abs(recipe.calories - targetCalories);
      const pantryBonus = pantryMatches.length * (constraints.wantsPantry ? 70 : 28);
      const requestedBonus = constraints.wantsPantry && pantryMatches.length > 0 ? 120 : 0;
      const promptBonus = promptTokens.length > 0 ? Math.min(promptTokens.filter((token) => recipeMatchesPrompt(recipe, token)).length * 18, 72) : 0;
      const noveltyPenalty = recentSignatures.includes(recipe.signature) ? 180 : 0;
      const violationPenalty = violations.length * 320;

      return {
        recipe,
        pantryMatches,
        violations,
        score: calorieDelta + noveltyPenalty + violationPenalty - pantryBonus - requestedBonus - promptBonus,
      };
    })
    .sort((firstItem, secondItem) => firstItem.score - secondItem.score);

  if (rankedRecipes.length === 0) {
    const emergencyRecipe = {
      ...recipeLibrary[0],
      generatedAt: new Date().toISOString(),
      prompt,
      mode: "seed-library",
      signature: recipeLibrary[0].id,
    };

    registerRecipe(emergencyRecipe);
    return emergencyRecipe;
  }

  const topCandidates = rankedRecipes.slice(0, Math.min(6, rankedRecipes.length));
  const selectableCandidates = topCandidates.length > 0 ? topCandidates : rankedRecipes;
  const selectionWindow = selectableCandidates.filter((entry) => entry.score <= selectableCandidates[0].score + 90);
  const fallbackRecipe = selectionWindow[Math.floor(Math.random() * selectionWindow.length)] || rankedRecipes[0];
  const selectedRecipe = fallbackRecipe.recipe;
  const pantryMatches = fallbackRecipe.pantryMatches;
  const criteriaNote = getRecipeCriteriaNote(fallbackRecipe.violations, constraints);
  const pantryNote =
    pantryMatches.length > 0
      ? `Hai già in dispensa: ${pantryMatches.join(", ")}.`
      : pantryNames.length > 0
      ? "Nessun match diretto con la dispensa."
      : "Aggiungi ingredienti alla Shopping List o alla dispensa per suggerimenti ancora più mirati.";

  const recipe = {
    ...selectedRecipe,
    prompt,
    generatedAt: new Date().toISOString(),
    pantryMatches,
    pantryNote,
    criteriaNote,
    personalNote: `Suggerita per ${getRecipeMealLabel(filters.mealType).toLowerCase()} ${getRecipeDietLabel(filters.dietType).toLowerCase()} intorno a ${targetCalories} kcal, con priorita a varieta e coerenza nutrizionale.`,
  };

  registerRecipe(recipe);
  return recipe;
}

function saveRecipeToHistory(recipe) {
  registerRecipe(recipe);
  appState.recipes.history = [
    {
      id: recipe.id,
      title: recipe.title,
      generatedAt: recipe.generatedAt,
      signature: recipe.signature || recipe.id,
    },
    ...appState.recipes.history.filter(
      (entry) => entry.id !== recipe.id && entry.signature !== (recipe.signature || recipe.id)
    ),
  ].slice(0, 6);
}

// Local fallback replies and lightweight markdown rendering for recipe chat.
function buildRecipeAssistantReply(message) {
  const prompt = message.toLowerCase();
  const pantryNames = appState.grocery.pantry.map((item) => item.name);

  if (prompt.includes("meal prep")) {
    return `Per il meal prep ti conviene puntare su 2 basi riutilizzabili: ${pantryNames.includes("Riso integrale") ? "riso integrale" : "un cereale"} e una proteina già cotta. Prepara 3 bowl variando condimenti e verdure, così riduci il tempo nei giorni feriali.`;
  }

  if (prompt.includes("colazione")) {
    return "Una buona colazione semplice e bilanciata può partire da overnight oats, yogurt bowl proteica oppure toast salato con uova e verdure, in base al tempo che hai.";
  }

  if (prompt.includes("cena")) {
    return `Per una cena veloce puoi partire da ${pantryNames.includes("Petto di pollo") ? "petto di pollo e verdure" : "una bowl proteica"} e tenerti tra 500 e 650 kcal. Se vuoi posso anche strutturarla in ingredienti, passaggi e macro stimati.`;
  }

  if (prompt.includes("veg") || prompt.includes("vegan") || prompt.includes("vegetar")) {
    return "Per richieste vegetali possiamo orientarci su tofu, tempeh, ceci o bowl con quinoa, variando salsa e verdure per non ripetere sempre la stessa ricetta.";
  }

  if (prompt.includes("dispensa") || prompt.includes("ingredient")) {
    return pantryNames.length > 0
      ? `In questo momento la dispensa contiene: ${pantryNames.join(", ")}. Posso usarli per proporti una ricetta realistica, con sostituzioni e passaggi essenziali.`
      : "Dispensa vuota.";
  }

  return "Posso aiutarti con idee di ricette, meal prep, sostituzioni ingredienti e adattamenti in base a calorie target, tipo di dieta e alimenti gia presenti.";
}

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}

function renderMarkdownBlock(block) {
  const trimmed = block.trim();

  if (!trimmed) {
    return "";
  }

  if (/^---+$/.test(trimmed)) {
    return "<hr />";
  }

  if (/^(\-|\*)\s+/m.test(trimmed) && trimmed.split("\n").every((line) => /^(\-|\*)\s+/.test(line.trim()))) {
    const items = trimmed
      .split("\n")
      .map((line) => line.trim().replace(/^(\-|\*)\s+/, ""))
      .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  if (/^\d+\.\s+/m.test(trimmed) && trimmed.split("\n").every((line) => /^\d+\.\s+/.test(line.trim()))) {
    const items = trimmed
      .split("\n")
      .map((line) => line.trim().replace(/^\d+\.\s+/, ""))
      .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  }

  return `<p>${trimmed.split("\n").map((line) => formatInlineMarkdown(line)).join("<br />")}</p>`;
}

function renderChatMarkdown(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .map((block) => renderMarkdownBlock(block))
    .filter(Boolean)
    .join("");
}

// Recipe chat context and transport helpers.
function getRecipeChatOpenFoodFactsKnowledge() {
  ensureOpenFoodFactsState();

  // I record RAG inviati al backend rappresentano solo prodotti già acquisiti
  // dall'app tramite scan/lookup OpenFoodFacts. In questo modo il modello usa
  // il dataset come knowledge base locale, senza sostituire i nutrienti
  // strutturati che restano gestiti dal flusso deterministico del prodotto.
  return Object.values(appState.datasets.openFoodFacts.productsByBarcode || {})
    .slice(0, 24)
    .map((product) => buildOpenFoodFactsRagRecord(product));
}

function buildRecipeChatContext() {
  return {
    pantry: appState.grocery.pantry.slice(0, 12).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      category: item.category,
    })),
    profile: {
      calories: appState.profile.goals.calories,
      protein: appState.profile.goals.protein,
      carbs: appState.profile.goals.carbs,
      fats: appState.profile.goals.fats,
      dietType: appState.profile.personal.dietType,
      activityLevel: appState.profile.personal.activityLevel,
    },
    generator: appState.recipes.generator,
    currentRecipe: appState.recipes.currentRecipe
      ? {
          title: appState.recipes.currentRecipe.title,
          calories: appState.recipes.currentRecipe.calories,
          protein: appState.recipes.currentRecipe.protein,
          carbs: appState.recipes.currentRecipe.carbs,
          fats: appState.recipes.currentRecipe.fats,
          ingredients: appState.recipes.currentRecipe.ingredients,
        }
      : null,
    openFoodFactsKnowledge: {
      provider: "OpenFoodFacts",
      records: getRecipeChatOpenFoodFactsKnowledge(),
    },
  };
}

async function getRecipeAssistantResponse(message) {
  const history = appState.recipes.chatMessages.slice(-8).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
        context: buildRecipeChatContext(),
      }),
      signal: controller.signal,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Backend non raggiungibile.");
    }

    if (!payload.reply) {
      throw new Error("Risposta del backend non valida.");
    }

    return payload.reply;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La risposta ha impiegato troppo tempo.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Recipe rendering helpers.
function renderRecipeResult() {
  const container = document.querySelector("[data-recipe-result]");
  const recipe = appState.recipes.currentRecipe;

  if (!container) {
    return;
  }

  if (!recipe) {
    container.innerHTML = `
      <article class="empty-state">
        <h3>Nessuna ricetta generata</h3>
        <p>Imposta i criteri qui accanto e genera una proposta basata sui tuoi vincoli reali.</p>
      </article>
    `;
    return;
  }

  const isSaved = appState.recipes.savedRecipeIds.includes(recipe.id);

  container.innerHTML = `
    <div class="result-head">
      <div>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p>${escapeHtml(recipe.description)}</p>
        <div class="inline-meta">
          <span>${recipe.duration} min</span>
          <span>${recipe.servings} porzioni</span>
          <span>${escapeHtml(recipe.difficulty)}</span>
          <span>${escapeHtml(getRecipeMealLabel(appState.recipes.generator.mealType))}</span>
        </div>
      </div>
      <div class="calorie-badge">
        <strong>${recipe.calories}</strong>
        <span>calorie</span>
      </div>
    </div>
    <div class="recipe-actions-row">
      <button class="primary-btn primary-btn-blue" type="button" data-save-current-recipe>${isSaved ? "Rimuovi dai salvati" : "Salva ricetta"}</button>
      <button class="recipe-secondary-btn" type="button" data-apply-current-recipe-to-nutrition>Usa nella dieta</button>
    </div>
    <div class="macro-pill-row">
      <span>Proteine ${recipe.protein}g</span>
      <span>Carboidrati ${recipe.carbs}g</span>
      <span>Grassi ${recipe.fats}g</span>
      <span>Generata ${escapeHtml(formatDateTime(recipe.generatedAt))}</span>
    </div>
    ${
      recipe.pantryNote || recipe.criteriaNote
        ? `
      <div class="lookup-chip-row">
        ${recipe.pantryNote ? `<span class="lookup-chip">${escapeHtml(recipe.pantryNote)}</span>` : ""}
        ${recipe.criteriaNote ? `<span class="lookup-chip">${escapeHtml(recipe.criteriaNote)}</span>` : ""}
      </div>
    `
        : ""
    }
    <div class="two-col-copy">
      <div>
        <h4>Ingredienti</h4>
        <ul>
          ${recipe.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}
        </ul>
      </div>
      <div>
        <h4>Istruzioni</h4>
        <ol>
          ${recipe.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </div>
    </div>
  `;
}

function renderRecipeHistory() {
  const container = document.querySelector("[data-recipe-history]");

  if (!container) {
    return;
  }

  if (appState.recipes.history.length === 0) {
    container.innerHTML = `<p class="recipe-side-empty">Nessuna generazione ancora.</p>`;
    return;
  }

  container.innerHTML = appState.recipes.history
    .map(
      (entry) => `
        <button class="recipe-history-item" type="button" data-recipe-history-id="${entry.id}">
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${escapeHtml(formatDateTime(entry.generatedAt))}</span>
        </button>
      `
    )
    .join("");
}

function renderSavedRecipes() {
  const container = document.querySelector("[data-saved-recipes]");

  if (!container) {
    return;
  }

  if (appState.recipes.savedRecipeIds.length === 0) {
    container.innerHTML = `<p class="recipe-side-empty">Salva le ricette migliori per ritrovarle qui.</p>`;
    return;
  }

  container.innerHTML = appState.recipes.savedRecipeIds
    .map((recipeId) => getRecipeById(recipeId))
    .filter(Boolean)
    .map(
      (recipe) => `
        <button class="recipe-saved-item" type="button" data-recipe-saved-id="${recipe.id}">
          <strong>${escapeHtml(recipe.title)}</strong>
          <span>${recipe.calories} kcal</span>
        </button>
      `
    )
    .join("");
}

function renderRecipeChat() {
  const container = document.querySelector("[data-recipe-chat-messages]");

  if (!container) {
    return;
  }

  const messagesMarkup = appState.recipes.chatMessages
    .map(
      (message) => `
        <article class="message-card ${message.role === "user" ? "message-card-user" : ""}">
          <div class="message-markdown">${message.role === "assistant" ? renderChatMarkdown(message.content) : `<p>${escapeHtml(message.content)}</p>`}</div>
          <time datetime="${escapeHtml(message.createdAt)}">${escapeHtml(formatDateTime(message.createdAt))}</time>
        </article>
      `
    )
    .join("");
  const typingMarkup = recipeChatRuntime.isWaiting
    ? `
      <article class="message-card message-card-typing" aria-live="polite">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p>Sto scrivendo...</p>
      </article>
    `
    : "";

  container.innerHTML = `${messagesMarkup}${typingMarkup}`;
  container.scrollTop = container.scrollHeight;
}

function renderRecipes() {
  const form = document.querySelector("[data-recipe-generator-form]");

  if (form) {
    form.elements.dietType.value = appState.recipes.generator.dietType;
    form.elements.caloriesTarget.value = appState.recipes.generator.caloriesTarget;
    form.elements.mealType.value = appState.recipes.generator.mealType;
    form.elements.prompt.value = appState.recipes.generator.prompt;
  }

  renderRecipeResult();
  renderRecipeHistory();
  renderSavedRecipes();
  renderRecipeChat();
}

// Recipe to nutrition and pantry integration helpers.
function getSuggestedMealTime(mealType) {
  const defaults = {
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "20:00",
    snack: "16:30",
  };

  return defaults[mealType] || "";
}

function parseQuantityLabel(quantityLabel) {
  const raw = String(quantityLabel || "").trim();
  const match = raw.match(/(\d+(?:[.,]\d+)?)(?:\s*([a-zA-Zà-ÿ]+))?/);

  if (!match) {
    return null;
  }

  const value = normalizeNumber(match[1]);
  const unit = String(match[2] || "").toLowerCase();

  if (value == null) {
    return null;
  }

  return {
    raw,
    value,
    unit,
  };
}

function findMatchingRecipeIngredient(recipe, pantryItem) {
  if (!recipe || !pantryItem) {
    return null;
  }

  const pantryName = normalizeComparableText(pantryItem.name);
  const pantryTokens = getComparableTokens(pantryItem.name);

  return recipe.ingredients.find((ingredient) => {
    const normalizedIngredient = normalizeComparableText(ingredient);
    const ingredientTokens = getComparableTokens(ingredient);
    const hasTokenOverlap = pantryTokens.some((pantryToken) =>
      ingredientTokens.some(
        (ingredientToken) =>
          ingredientToken === pantryToken || ingredientToken.includes(pantryToken) || pantryToken.includes(ingredientToken)
      )
    );

    return pantryName && (normalizedIngredient.includes(pantryName) || hasTokenOverlap);
  }) || null;
}

function getRecipePantryMatches(recipe) {
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    return [];
  }

  return appState.grocery.pantry.reduce((matches, pantryItem) => {
    const ingredientLine = findMatchingRecipeIngredient(recipe, pantryItem);

    if (ingredientLine) {
      matches.push({
        pantryItem,
        ingredientLine,
      });
    }

    return matches;
  }, []);
}

function getPantryMatchesForRecipe(recipe) {
  return getRecipePantryMatches(recipe).map(({ pantryItem }) => pantryItem.name);
}

function decreasePantryItemQuantity(pantryItem, ingredientLine) {
  const pantryQuantity = parseQuantityLabel(pantryItem.quantity);
  const ingredientQuantity = parseQuantityLabel(ingredientLine);

  if (!pantryQuantity) {
    return {
      consumed: true,
      nextQuantity: "",
      removed: true,
      reason: "used-up",
    };
  }

  if (!ingredientQuantity) {
    const nextValue = pantryQuantity.value - 1;

    if (nextValue <= 0) {
      return {
        consumed: pantryQuantity.value,
        nextQuantity: "",
        removed: true,
        reason: "used-up",
      };
    }

    return {
      consumed: 1,
      nextQuantity: formatPantryQuantity(nextValue, pantryQuantity.unit, pantryItem.quantity),
      removed: false,
      reason: "count-decrement",
    };
  }

  const pantryBase = convertQuantityToBaseUnit(pantryQuantity.value, pantryQuantity.unit);
  const ingredientBase = convertQuantityToBaseUnit(ingredientQuantity.value, ingredientQuantity.unit);

  if (pantryBase.unit && ingredientBase.unit && pantryBase.unit === ingredientBase.unit) {
    const nextValue = pantryBase.value - ingredientBase.value;

    if (nextValue <= 0) {
      return {
        consumed: ingredientBase.value,
        nextQuantity: "",
        removed: true,
        reason: "unit-consumed",
      };
    }

    return {
      consumed: ingredientBase.value,
      nextQuantity: formatPantryQuantity(nextValue, pantryBase.unit, pantryItem.quantity),
      removed: false,
      reason: "unit-consumed",
    };
  }

  const fallbackValue = pantryQuantity.value - 1;

  if (fallbackValue <= 0) {
    return {
      consumed: pantryQuantity.value,
      nextQuantity: "",
      removed: true,
      reason: "fallback-decrement",
    };
  }

  return {
    consumed: 1,
    nextQuantity: formatPantryQuantity(fallbackValue, pantryQuantity.unit, pantryItem.quantity),
    removed: false,
    reason: "fallback-decrement",
  };
}

function inferRecipeMealType(recipe) {
  return appState.recipes.generator.mealType || recipe?.mealTypes?.[0] || "lunch";
}

function createNutritionMealFromRecipe(recipe, mealType = inferRecipeMealType(recipe)) {
  if (!recipe) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: recipe.title,
    date: getTodayDateKey(),
    time: getSuggestedMealTime(mealType),
    calories: roundMacroValue(recipe.calories ?? 0),
    protein: roundMacroValue(recipe.protein ?? 0),
    carbs: roundMacroValue(recipe.carbs ?? 0),
    fats: roundMacroValue(recipe.fats ?? 0),
    barcode: "",
    source: "recipes",
    brand: "",
    nutriscoreGrade: "",
    nutritionSource: "imported",
    nutritionSourceLabel: RECIPE_NUTRITION_SOURCE_LABEL,
  };
}

function createRecipeNutritionDraft(recipe) {
  if (!recipe) {
    return null;
  }

  return createImportedNutritionDraft(recipe, RECIPE_NUTRITION_SOURCE_LABEL);
}

function addRecipeToNutritionLog(recipe, mealType = inferRecipeMealType(recipe)) {
  const meal = createNutritionMealFromRecipe(recipe, mealType);

  if (!meal) {
    return null;
  }

  appState.nutrition.meals.push(meal);
  captureProgressSnapshotForDate(getMealDateKey(meal));
  return meal;
}

function consumePantryForRecipe(recipe) {
  if (!recipe) {
    return [];
  }

  const updates = [];
  const matchedPantryItems = getRecipePantryMatches(recipe);

  matchedPantryItems.forEach(({ pantryItem, ingredientLine }) => {
    const result = decreasePantryItemQuantity(pantryItem, ingredientLine);
    const pantryIndex = appState.grocery.pantry.findIndex((item) => item.id === pantryItem.id);

    if (pantryIndex === -1) {
      return;
    }

    if (result.removed) {
      appState.grocery.pantry.splice(pantryIndex, 1);
    } else {
      appState.grocery.pantry[pantryIndex] = {
        ...appState.grocery.pantry[pantryIndex],
        quantity: result.nextQuantity,
      };
    }

    updates.push({
      pantryItemName: pantryItem.name,
      ingredientLine,
      removed: result.removed,
      nextQuantity: result.nextQuantity,
    });
  });

  return updates;
}

function getRecipeChatAction(message) {
  const normalizedMessage = normalizeComparableText(message);
  const addToNutritionIntent =
    /(aggiung|inserisc|salva|porta)/.test(normalizedMessage) &&
    /(nutrition|giornata|diario|pasti)/.test(normalizedMessage) &&
    /(ricett|propost|corrente|quest|past)/.test(normalizedMessage);

  if (addToNutritionIntent) {
    return { type: "add-current-recipe-to-nutrition" };
  }

  return null;
}

function executeRecipeChatAction(action) {
  if (!action) {
    return null;
  }

  if (action.type === "add-current-recipe-to-nutrition") {
    const recipe = appState.recipes.currentRecipe;

    if (!recipe) {
      return {
        success: false,
        message: "Non ho una ricetta attiva da usare.\n\nGenerane o aprine una nella sezione Alimenti e poi chiedimi di aggiungerla alla Dieta.",
      };
    }

    const mealType = inferRecipeMealType(recipe);
    const addedMeal = addRecipeToNutritionLog(recipe, mealType);
    const pantryUpdates = consumePantryForRecipe(recipe);
    saveState();
    switchToTab("nutrition");
    renderNutrition();
    renderGrocery();
    setFeedback(`Ho aggiunto ${addedMeal.name} ai pasti di oggi dall'area Alimenti.`);

    const pantrySummary =
      pantryUpdates.length > 0
        ? pantryUpdates
            .map((entry) => `- **${entry.pantryItemName}** -> ${entry.removed ? "esaurito" : `restano ${entry.nextQuantity}`}`)
            .join("\n")
        : "- Nessun ingrediente della ricetta era presente in dispensa con un match diretto.";

    return {
      success: true,
      message:
        `Ho aggiunto **${addedMeal.name}** ai pasti di oggi in **Dieta**.\n\n` +
        `- Orario impostato: ${formatMealTime(addedMeal.time)}\n` +
        `- Calorie: **${addedMeal.calories} kcal**\n` +
        `- Proteine: **${addedMeal.protein} g**\n\n` +
        `---\n\n` +
        `**Aggiornamento dispensa**\n${pantrySummary}`,
    };
  }

  return null;
}

function applyRecipeToNutrition(recipe, mealType) {
  const form = document.querySelector("[data-nutrition-form]");

  if (!form || !recipe) {
    return;
  }

  clearNutritionDraft();
  openFoodFactsRuntime.nutritionDraft = createRecipeNutritionDraft(recipe);
  form.reset();
  form.elements.name.value = recipe.title;
  form.elements.time.value = getSuggestedMealTime(mealType);
  switchToTab("nutrition");
  setFeedback("Ricetta importata dall'area Alimenti. I valori nutrizionali verranno inseriti automaticamente.");
}

// Shared UI state helpers for reopening recipes and updating chat state.
function setCurrentRecipeWithContext(recipe, pantryFallbackNote, personalFallbackNote) {
  if (!recipe) {
    return false;
  }

  const pantryMatches = getPantryMatchesForRecipe(recipe);
  appState.recipes.currentRecipe = {
    ...recipe,
    pantryMatches,
    pantryNote: pantryMatches.length ? `Hai già in dispensa: ${pantryMatches.join(", ")}.` : pantryFallbackNote,
    personalNote: recipe.personalNote || personalFallbackNote,
  };

  return true;
}

function restoreRecipeFromCollection(recipeId, pantryFallbackNote, personalFallbackNote, successMessage) {
  const recipe = getRecipeById(recipeId);

  if (!setCurrentRecipeWithContext(recipe, pantryFallbackNote, personalFallbackNote)) {
    return;
  }

  saveState();
  renderRecipes();
  setRecipeFeedback(successMessage);
}

function appendRecipeChatMessage(role, content) {
  appState.recipes.chatMessages.push({
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  });
}

function setRecipeChatPendingState(chatForm, isWaiting) {
  const messageField = chatForm.elements.message;
  const submitButton = chatForm.querySelector('button[type="submit"]');

  recipeChatRuntime.isWaiting = isWaiting;
  messageField.disabled = isWaiting;

  if (submitButton) {
    submitButton.disabled = isWaiting;
  }

  renderRecipeChat();
}

// Event binding for the generator form and current recipe actions.
function setupRecipeGeneratorForm(generatorForm) {
  generatorForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextFilters = {
      dietType: generatorForm.elements.dietType.value,
      caloriesTarget: generatorForm.elements.caloriesTarget.value,
      mealType: generatorForm.elements.mealType.value,
      prompt: String(generatorForm.elements.prompt.value || "").trim(),
    };

    appState.recipes.generator = nextFilters;
    appState.recipes.currentRecipe = buildRecipeRecommendation(nextFilters);
    saveRecipeToHistory(appState.recipes.currentRecipe);
    saveState();
    renderRecipes();
    setRecipeFeedback("Ricetta generata correttamente.");
  });
}

function setupRecipeResultActions(recipeResult) {
  recipeResult.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save-current-recipe]");
    const applyButton = event.target.closest("[data-apply-current-recipe-to-nutrition]");

    if (applyButton && appState.recipes.currentRecipe) {
      applyRecipeToNutrition(appState.recipes.currentRecipe, appState.recipes.generator.mealType);
      return;
    }

    if (!saveButton || !appState.recipes.currentRecipe) {
      return;
    }

    const recipeId = appState.recipes.currentRecipe.id;
    const isSaved = appState.recipes.savedRecipeIds.includes(recipeId);

    appState.recipes.savedRecipeIds = isSaved
      ? appState.recipes.savedRecipeIds.filter((id) => id !== recipeId)
      : [recipeId, ...appState.recipes.savedRecipeIds];

    saveState();
    renderRecipes();
    setRecipeFeedback(isSaved ? "Ricetta rimossa dai salvati." : "Ricetta salvata.");
  });
}

// Event binding for reopening recipes from history and saved collections.
function setupRecipeHistoryActions(recipeHistory) {
  recipeHistory.addEventListener("click", (event) => {
    const button = event.target.closest("[data-recipe-history-id]");

    if (!button) {
      return;
    }

    restoreRecipeFromCollection(
      button.dataset.recipeHistoryId,
      "Ricetta riaperta dallo storico recente.",
      "Ricetta recuperata dallo storico delle generazioni.",
      "Ricetta ricaricata dallo storico."
    );
  });
}

function setupSavedRecipeActions(savedRecipes) {
  savedRecipes.addEventListener("click", (event) => {
    const button = event.target.closest("[data-recipe-saved-id]");

    if (!button) {
      return;
    }

    restoreRecipeFromCollection(
      button.dataset.recipeSavedId,
      "Ricetta aperta dai preferiti.",
      "Ricetta recuperata dall'elenco salvati.",
      "Ricetta aperta dai salvati."
    );
  });
}

// Event binding and async flow management for the recipe assistant chat.
async function handleRecipeChatSubmit(chatForm) {
  const message = String(chatForm.elements.message.value || "").trim();

  if (!message) {
    return;
  }

  appendRecipeChatMessage("user", message);

  const requestedAction = getRecipeChatAction(message);

  if (requestedAction) {
    const actionResult = executeRecipeChatAction(requestedAction);

    if (actionResult?.message) {
      appendRecipeChatMessage("assistant", actionResult.message);
    }

    saveState();
    renderRecipeChat();
    chatForm.reset();
    return;
  }

  saveState();
  renderRecipeChat();
  chatForm.elements.message.value = "";
  setRecipeChatPendingState(chatForm, true);

  try {
    const assistantReply = await getRecipeAssistantResponse(message);
    appendRecipeChatMessage("assistant", assistantReply);
    saveState();
    renderRecipeChat();
    chatForm.reset();
  } catch (error) {
    const fallbackReply = buildRecipeAssistantReply(message);

    appendRecipeChatMessage("assistant", fallbackReply);
    saveState();
    renderRecipeChat();
  } finally {
    setRecipeChatPendingState(chatForm, false);
  }
}

function setupRecipeChat(chatForm, chatResetButton) {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleRecipeChatSubmit(chatForm);
  });

  chatResetButton?.addEventListener("click", () => {
    appState.recipes.chatMessages = getDefaultRecipeChatMessages();
    saveState();
    renderRecipeChat();
  });
}

// Recipes section wiring.
function setupRecipesSection() {
  const generatorForm = document.querySelector("[data-recipe-generator-form]");
  const recipeResult = document.querySelector("[data-recipe-result]");
  const recipeHistory = document.querySelector("[data-recipe-history]");
  const savedRecipes = document.querySelector("[data-saved-recipes]");
  const chatForm = document.querySelector("[data-recipe-chat-form]");
  const chatResetButton = document.querySelector("[data-recipe-chat-reset]");

  if (!generatorForm || !recipeResult || !recipeHistory || !savedRecipes || !chatForm) {
    return;
  }

  setupRecipeGeneratorForm(generatorForm);
  setupRecipeResultActions(recipeResult);
  setupRecipeHistoryActions(recipeHistory);
  setupSavedRecipeActions(savedRecipes);
  setupRecipeChat(chatForm, chatResetButton);
  renderRecipes();
}

setupRecipesSection();
