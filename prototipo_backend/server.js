require("./backend-env");

const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAzureChatCompletion } = require("./azure-openai");
const { fetchOpenFoodFactsProduct, sanitizeBarcode } = require("./openfoodfacts");
const {
  getNutriTrackDatabaseStatus,
  getNutriTrackState,
  getNutriTrackStateSnapshot,
  saveNutriTrackState,
} = require("./nutritrack-state/nutritrack-state-repository");
const { buildRecipesAssistantContext } = require("./recipes-assistant-context");
const {
  authenticateUser,
  buildAuthCookie,
  buildClearedAuthCookie,
  createUserAccount,
  createUserSession,
  readAuthenticatedSessionFromRequest,
  revokeUserSessionByToken,
} = require("./auth");
const { resolveRequestUserContext } = require("./request-user-context");
const { getRuntimeConfig } = require("./runtime-config");
const {
  buildPublicScaleState,
  connectScale,
  disconnectScale,
  getScaleProvider,
  getScaleProviderId,
  readScaleConnection,
  syncScale,
  updateScalePermissions,
} = require("./scale");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const HTTPS_ENABLED = process.env.HTTPS === "1";
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || path.join(__dirname, "certs", "local-key.pem");
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || path.join(__dirname, "certs", "local-cert.pem");
const repositoryRoot = path.resolve(__dirname, "..");
const frontendRoot = path.join(repositoryRoot, "frontend");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const DEVICE_DEFAULTS = Object.freeze({
  showPermissionsPanel: false,
  integrations: {
    scale: {
      providerMode: "mock",
      connected: false,
      lastSyncAt: "",
      permissions: {
        weight: true,
        bmi: true,
        bodyFat: true,
      },
      latestData: {},
    },
  },
});

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  console.log("[Server] Invio risposta JSON.", {
    statusCode,
    keys: payload && typeof payload === "object" ? Object.keys(payload) : []
  });
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeDeviceIntegration(baseIntegration, savedIntegration = {}) {
  const normalizedIntegration = {
    ...cloneJson(baseIntegration),
    ...(savedIntegration && typeof savedIntegration === "object" ? cloneJson(savedIntegration) : {}),
  };

  normalizedIntegration.connected = Boolean(normalizedIntegration.connected);
  normalizedIntegration.lastSyncAt = normalizedIntegration.lastSyncAt || "";
  normalizedIntegration.providerMode = normalizedIntegration.providerMode || baseIntegration.providerMode || "unknown";
  normalizedIntegration.latestData =
    normalizedIntegration.latestData && typeof normalizedIntegration.latestData === "object"
      ? normalizedIntegration.latestData
      : {};

  if (baseIntegration.permissions && typeof baseIntegration.permissions === "object") {
    normalizedIntegration.permissions = Object.fromEntries(
      Object.keys(baseIntegration.permissions).map((permissionKey) => [
        permissionKey,
        savedIntegration?.permissions && permissionKey in savedIntegration.permissions
          ? Boolean(savedIntegration.permissions[permissionKey])
          : Boolean(baseIntegration.permissions[permissionKey]),
      ])
    );
  }

  return normalizedIntegration;
}

function buildDevicesStatePayload(savedDevicesState = {}) {
  const defaultDevicesState = cloneJson(DEVICE_DEFAULTS);
  const safeSavedDevicesState = savedDevicesState && typeof savedDevicesState === "object" ? savedDevicesState : {};
  const savedIntegrations =
    safeSavedDevicesState.integrations && typeof safeSavedDevicesState.integrations === "object"
      ? safeSavedDevicesState.integrations
      : {};

  const devicesState = {
    ...defaultDevicesState,
    showPermissionsPanel: false,
    integrations: {
      scale: normalizeDeviceIntegration(defaultDevicesState.integrations.scale, savedIntegrations.scale),
    },
  };

  return devicesState;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, fileContent) => {
    if (error) {
      sendJson(response, 404, { error: "File non trovato." });
      return;
    }

    console.log("[Server] Invio file statico.", { filePath });
    response.writeHead(200, { "Content-Type": contentType });
    response.end(fileContent);
  });
}

function resolveStaticPath(urlPath) {
  const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
  const resolvedPath = path.resolve(frontendRoot, `.${normalizedPath}`);

  if (!resolvedPath.startsWith(frontendRoot)) {
    return null;
  }

  return resolvedPath;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;

      if (rawBody.length > 1_000_000) {
        reject(new Error("Body troppo grande."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error("JSON non valido."));
      }
    });

    request.on("error", reject);
  });
}

function getRuntimeUserPayload(runtime, session) {
  if (runtime.identityMode === "authenticated_user") {
    return session
      ? {
          id: session.userId,
          email: session.email,
          fullName: session.fullName || null,
          mode: "authenticated_user",
        }
      : null;
  }

  return {
    email: String(
      process.env.NUTRITRACK_LOCAL_USER_EMAIL ||
        process.env.NUTRITRACK_DEMO_USER_EMAIL ||
        "app-local@nutritrack.local"
    ).trim(),
    mode: "single_user_local",
  };
}

function ensureAuthenticatedUserMode() {
  const runtime = getRuntimeConfig();

  if (runtime.identityMode !== "authenticated_user") {
    const error = new Error("Autenticazione disponibile solo in modalita authenticated-user.");
    error.statusCode = 400;
    throw error;
  }

  return runtime;
}

function getSessionTokenFromRequest(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("nutritrack_session="))
    ?.slice("nutritrack_session=".length);
}

function stringifyContextBlock(label, value) {
  if (!value) {
    return "";
  }

  return `${label}: ${JSON.stringify(value)}`;
}

function normalizeRetrievalText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenizeRetrievalText(value) {
  return normalizeRetrievalText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function buildOpenFoodFactsRagQuery(userMessage, context = {}) {
  return [
    userMessage,
    context.currentRecipe?.title,
    Array.isArray(context.currentRecipe?.ingredients) ? context.currentRecipe.ingredients.join(" ") : "",
    Array.isArray(context.pantry) ? context.pantry.map((item) => item?.name).join(" ") : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreOpenFoodFactsRagRecord(record, queryTokens) {
  if (!record || queryTokens.length === 0) {
    return 0;
  }

  const searchableText = normalizeRetrievalText(
    [
      record.title,
      record.brand,
      record.category,
      record.quantity,
      record.serving,
      record.text,
      record.barcode
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!searchableText) {
    return 0;
  }

  let score = 0;

  queryTokens.forEach((token) => {
    if (searchableText.includes(token)) {
      score += token.length >= 5 ? 3 : 1;
    }

    if (record.barcode && String(record.barcode).includes(token)) {
      score += 5;
    }
  });

  return score;
}

function selectRelevantOpenFoodFactsRecords(userMessage, context = {}) {
  const records = Array.isArray(context.openFoodFactsKnowledge?.records)
    ? context.openFoodFactsKnowledge.records
    : [];

  if (records.length === 0) {
    return [];
  }

  const queryTokens = tokenizeRetrievalText(buildOpenFoodFactsRagQuery(userMessage, context));

  return records
    .map((record) => ({
      record,
      score: scoreOpenFoodFactsRagRecord(record, queryTokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 4)
    .map((entry) => entry.record);
}

function buildOpenFoodFactsRagBlock(userMessage, context = {}) {
  const retrievedRecords = selectRelevantOpenFoodFactsRecords(userMessage, context);

  if (retrievedRecords.length === 0) {
    return "";
  }

  // Questo blocco è il "retrieval" del flusso RAG: non passiamo l'intero dump
  // al modello, ma solo i record OpenFoodFacts più pertinenti già raccolti
  // dall'app, così l'LLM può motivare consigli e confronti senza inventare dati.
  const serializedRecords = retrievedRecords.map((record) => ({
    barcode: record.barcode,
    title: record.title,
    brand: record.brand,
    category: record.category,
    serving: record.serving,
    quantity: record.quantity,
    nutrition: record.nutrition,
    nutriscore: record.nutriscore,
    text: record.text,
    source: record.source
  }));

  return `Knowledge base OpenFoodFacts recuperata localmente:\n${JSON.stringify(serializedRecords)}`;
}

function buildRecipeAssistantMessages(userMessage, history = [], context = {}) {
  const contextMessage = [
    stringifyContextBlock("Pantry", context.pantry),
    stringifyContextBlock("Shopping list items", context.groceryItems),
    stringifyContextBlock("Profile goals", context.profile),
    stringifyContextBlock("Recipe generator filters", context.generator),
    stringifyContextBlock("Current recipe", context.currentRecipe),
    stringifyContextBlock("Recent meals", context.recentMeals),
    stringifyContextBlock("Recent recipes", context.recentRecipes),
    buildOpenFoodFactsRagBlock(userMessage, context),
  ]
    .filter(Boolean)
    .join("\n");

  const sanitizedHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant") && entry.content)
        .slice(-8)
        .map((entry) => ({
          role: entry.role,
          content: String(entry.content),
        }))
    : [];

  return [
    {
      role: "system",
      content:
        "Sei un assistant culinario e nutrizionale di livello GPT, integrato in un'app reale di meal planning. Rispondi sempre in italiano naturale, competente e utile. Non parlare di limiti tecnici a meno che l'utente lo chieda esplicitamente. Quando proponi ricette o modifiche, sii concreto: ingredienti, quantità approssimative, passaggi essenziali, alternative intelligenti e note nutrizionali sintetiche. Usa sempre il contesto dell'app, qualora disponibile: dispensa, obiettivi nutrizionali, filtri di generazione e ricetta corrente. Se è presente una knowledge base OpenFoodFacts recuperata localmente, usala solo come supporto fattuale per prodotti, alternative e spiegazioni nutrizionali, senza inventare nutrienti mancanti. Evita di ripetere ricette, abbinamenti o ingredienti dominanti già apparsi di recente, a meno che l'utente li richieda esplicitamente. Se il messaggio dell'utente è ambiguo, fai al massimo una domanda di chiarimento breve; altrimenti proponi direttamente la soluzione più utile."
    },
    ...(contextMessage
      ? [
          {
            role: "system",
            content: `Contesto applicativo disponibile:\n${contextMessage}`,
          },
        ]
      : []),
    ...sanitizedHistory,
    {
      role: "user",
      content: userMessage
    }
  ];
}

function parseJsonObjectFromCompletion(content) {
  const raw = String(content || "").trim();

  if (!raw) {
    throw new Error("Risposta Azure OpenAI vuota.");
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw;
  const firstBraceIndex = candidate.indexOf("{");
  const lastBraceIndex = candidate.lastIndexOf("}");

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    throw new Error("Risposta JSON non trovata nella completion.");
  }

  return JSON.parse(candidate.slice(firstBraceIndex, lastBraceIndex + 1));
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTodayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function roundMacroValue(value) {
  return Math.max(0, Math.round(Number(value) || 0));
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

function sortPantryForRecipeGeneration(pantry = []) {
  return pantry
    .filter((item) => item && item.name)
    .map((item) => {
      const daysUntilExpiry = getDaysUntilIsoDate(item.expiryDate);
      return {
        name: String(item.name),
        quantity: String(item.quantity || ""),
        category: String(item.category || ""),
        expiryDate: item.expiryDate || "",
        daysUntilExpiry,
        priority:
          daysUntilExpiry == null
            ? "normal"
            : daysUntilExpiry < 0
            ? "expired"
            : daysUntilExpiry <= 2
            ? "urgent"
            : daysUntilExpiry <= 5
            ? "soon"
            : "normal",
      };
    })
    .sort((firstItem, secondItem) => {
      const firstRank = firstItem.daysUntilExpiry == null ? Number.POSITIVE_INFINITY : firstItem.daysUntilExpiry;
      const secondRank = secondItem.daysUntilExpiry == null ? Number.POSITIVE_INFINITY : secondItem.daysUntilExpiry;

      if (firstRank !== secondRank) {
        return firstRank - secondRank;
      }

      return firstItem.name.localeCompare(secondItem.name, "it");
    });
}

function tokenizeRecipeComparableText(value) {
  return normalizeRetrievalText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function findMatchingRecipeIngredient(recipe, pantryItem) {
  if (!recipe || !pantryItem || !Array.isArray(recipe.ingredients)) {
    return null;
  }

  const pantryName = normalizeRetrievalText(pantryItem.name);
  const pantryTokens = tokenizeRecipeComparableText(pantryItem.name);

  return recipe.ingredients.find((ingredient) => {
    const normalizedIngredient = normalizeRetrievalText(ingredient);
    const ingredientTokens = tokenizeRecipeComparableText(ingredient);
    const hasTokenOverlap = pantryTokens.some((pantryToken) =>
      ingredientTokens.some(
        (ingredientToken) =>
          ingredientToken === pantryToken ||
          ingredientToken.includes(pantryToken) ||
          pantryToken.includes(ingredientToken)
      )
    );

    return pantryName && (normalizedIngredient.includes(pantryName) || hasTokenOverlap);
  }) || null;
}

function getRecipePantryMatches(recipe, pantry = []) {
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    return [];
  }

  return pantry.reduce((matches, pantryItem) => {
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

function parseQuantityLabel(quantityLabel) {
  const raw = String(quantityLabel || "").trim();
  const match = raw.match(/(\d+(?:[.,]\d+)?)(?:\s*([a-zA-Zà-ÿ]+))?/);

  if (!match) {
    return null;
  }

  const value = Number(String(match[1]).replace(",", "."));
  const unit = String(match[2] || "").toLowerCase();

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    raw,
    value,
    unit,
  };
}

function normalizeQuantityUnit(unit) {
  if (!unit) {
    return "";
  }

  if (unit === "kg") {
    return "g";
  }

  if (unit === "l") {
    return "ml";
  }

  return unit;
}

function convertQuantityToBaseUnit(value, unit) {
  const normalizedUnit = normalizeQuantityUnit(unit);

  if (unit === "kg") {
    return { value: value * 1000, unit: normalizedUnit };
  }

  if (unit === "l") {
    return { value: value * 1000, unit: normalizedUnit };
  }

  return { value, unit: normalizedUnit };
}

function formatQuantityValue(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10).replace(".", ",");
}

function formatPantryQuantity(value, unit, fallbackRaw) {
  if (!unit) {
    return fallbackRaw || formatQuantityValue(value);
  }

  return `${formatQuantityValue(value)} ${unit}`;
}

function decreasePantryItemQuantity(pantryItem, ingredientLine) {
  const pantryQuantity = parseQuantityLabel(pantryItem.quantity);
  const ingredientQuantity = parseQuantityLabel(ingredientLine);

  if (!pantryQuantity) {
    return {
      consumed: true,
      nextQuantity: "",
      removed: true,
    };
  }

  if (!ingredientQuantity) {
    const nextValue = pantryQuantity.value - 1;

    if (nextValue <= 0) {
      return {
        consumed: pantryQuantity.value,
        nextQuantity: "",
        removed: true,
      };
    }

    return {
      consumed: 1,
      nextQuantity: formatPantryQuantity(nextValue, pantryQuantity.unit, pantryItem.quantity),
      removed: false,
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
      };
    }

    return {
      consumed: ingredientBase.value,
      nextQuantity: formatPantryQuantity(nextValue, pantryBase.unit, pantryItem.quantity),
      removed: false,
    };
  }

  const fallbackValue = pantryQuantity.value - 1;

  if (fallbackValue <= 0) {
    return {
      consumed: pantryQuantity.value,
      nextQuantity: "",
      removed: true,
    };
  }

  return {
    consumed: 1,
    nextQuantity: formatPantryQuantity(fallbackValue, pantryQuantity.unit, pantryItem.quantity),
    removed: false,
  };
}

function getSuggestedMealTime(mealType) {
  const defaults = {
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "20:00",
    snack: "16:30",
  };

  return defaults[mealType] || "13:00";
}

function createNutritionMealFromRecipe(recipe, mealType) {
  return {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `meal-${Date.now().toString(36)}`,
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
    nutritionSourceLabel: "Importato da Recipes",
  };
}

function applyRecipeToDietState(state, recipe, mealType) {
  const nextState = cloneJson(state) || {};
  nextState.nutrition = nextState.nutrition || {};
  nextState.grocery = nextState.grocery || {};
  nextState.nutrition.meals = Array.isArray(nextState.nutrition.meals) ? nextState.nutrition.meals : [];
  nextState.grocery.pantry = Array.isArray(nextState.grocery.pantry) ? nextState.grocery.pantry : [];

  const meal = createNutritionMealFromRecipe(recipe, mealType);
  nextState.nutrition.meals.push(meal);

  const pantryUpdates = [];
  const matchedPantryItems = getRecipePantryMatches(recipe, nextState.grocery.pantry);

  matchedPantryItems.forEach(({ pantryItem, ingredientLine }) => {
    const result = decreasePantryItemQuantity(pantryItem, ingredientLine);
    const pantryIndex = nextState.grocery.pantry.findIndex((item) => item.id === pantryItem.id);

    if (pantryIndex === -1) {
      return;
    }

    if (result.removed) {
      nextState.grocery.pantry.splice(pantryIndex, 1);
    } else {
      nextState.grocery.pantry[pantryIndex] = {
        ...nextState.grocery.pantry[pantryIndex],
        quantity: result.nextQuantity,
      };
    }

    pantryUpdates.push({
      pantryItemName: pantryItem.name,
      ingredientLine,
      removed: result.removed,
      nextQuantity: result.nextQuantity,
    });
  });

  return {
    state: nextState,
    meal,
    pantryUpdates,
  };
}

function sanitizeRecipeGenerationFilters(rawFilters = {}) {
  return {
    dietType: String(rawFilters.dietType || "balanced"),
    caloriesTarget: toFiniteNumber(rawFilters.caloriesTarget, 500),
    mealType: String(rawFilters.mealType || "dinner"),
    prompt: String(rawFilters.prompt || "").trim(),
  };
}

function buildRecipeGenerationMessages(filters, context = {}) {
  const pantry = sortPantryForRecipeGeneration(Array.isArray(context.pantry) ? context.pantry : []);
  const urgentPantryItems = pantry.filter((item) => item.priority === "expired" || item.priority === "urgent");
  const recentRecipes = Array.isArray(context.recentRecipes) ? context.recentRecipes.slice(0, 6) : [];
  const recentMeals = Array.isArray(context.recentMeals) ? context.recentMeals.slice(0, 8) : [];
  const groceryItems = Array.isArray(context.groceryItems) ? context.groceryItems.slice(0, 16) : [];
  const goalSummary = String(context.profile?.goalSummary || "").trim();
  const contextMessage = [
    stringifyContextBlock("Pantry prioritizzata", pantry),
    stringifyContextBlock("Ingredienti in shopping list", groceryItems),
    stringifyContextBlock("Obiettivi nutrizionali", context.profile),
    stringifyContextBlock("Meal log recenti", recentMeals),
    stringifyContextBlock("Ricette recenti da non ripetere", recentRecipes),
    stringifyContextBlock("Filtri utente", filters),
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    `Genera una ricetta per ${filters.mealType} con target di circa ${filters.caloriesTarget} kcal e stile alimentare ${filters.dietType}.`,
    filters.prompt ? `Vincoli e preferenze dell'utente: ${filters.prompt}` : "",
    "I dati utente presenti nel contesto applicativo provengono dallo stato reale dell'app salvato a database e devono essere usati come vincoli effettivi di generazione, non come semplici suggerimenti.",
    "Se nel profilo utente sono presenti allergie, condizioni mediche, preferenze alimentari, obiettivi nutrizionali o altri vincoli personali, la ricetta deve rispettarli esplicitamente.",
    goalSummary ? `Obiettivi di profilo da considerare come vincoli reali: ${goalSummary}.` : "",
    context.profile?.primaryObjectiveLabel
      ? "La ricetta deve essere coerente prima di tutto con l'obiettivo principale del profilo, non solo con il target calorico."
      : "",
    pantry.length > 0
      ? "Usa la dispensa reale come sorgente principale degli ingredienti. Se possibile privilegia gli elementi con scadenza piu vicina."
      : "La dispensa e' vuota: proponi comunque una ricetta realistica e coerente con i vincoli.",
    urgentPantryItems.length > 0
      ? `Ingredienti urgenti da privilegiare: ${urgentPantryItems.map((item) => item.name).join(", ")}.`
      : "",
    recentRecipes.length > 0
      ? `Nella stessa sessione Recipes dell'app hai gia proposto queste ricette all'utente: ${recentRecipes
          .map((recipe) => recipe.title)
          .filter(Boolean)
          .join("; ")}. Non riproporre nessuna di queste ricette e non generare varianti minime con gli stessi ingredienti principali, la stessa struttura o lo stesso concept.`
      : "",
    recentRecipes.length > 0
      ? "La nuova proposta deve essere chiaramente diversa da quelle gia mostrate nella sessione corrente: cambia ingredienti principali, combinazione del piatto e impostazione generale della ricetta. Una ricetta e considerata ripetuta anche se cambia solo una salsa, una verdura secondaria, un contorno o una piccola quantita, ma mantiene lo stesso nucleo del piatto."
      : "",
    recentMeals.length > 0
      ? `Considera anche i pasti recenti gia registrati, per aumentare la varieta complessiva: ${recentMeals
          .map((meal) => meal.name)
          .filter(Boolean)
          .join("; ")}.`
      : "",
    "Devi massimizzare la varieta durante la stessa sessione utente: se ci sono ricette recenti nel contesto, evita ripetizioni, quasi-duplicati e micro-variazioni della stessa proposta.",
    "Restituisci solo JSON valido, senza markdown o testo extra, con questa forma esatta:",
    JSON.stringify(
      {
        title: "string",
        description: "string",
        duration: 20,
        servings: 1,
        difficulty: "Facile",
        calories: 500,
        protein: 30,
        carbs: 45,
        fats: 18,
        ingredients: ["150 g petto di pollo", "120 g zucchine"],
        instructions: ["Step 1", "Step 2"],
        pantryNote: "string",
        criteriaNote: "string",
        personalNote: "string",
        pantryUsed: ["petto di pollo", "zucchine"],
      },
      null,
      2
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "system",
      content:
        "Sei un motore di generazione ricette per un'app di meal planning e puoi anche generare liste della spesa sulla base delle abitudini di acquisto dell'utente e sulla base dei dati profilo inseriti. Devi creare una singola ricetta completa, concreta e fattibile usando soprattutto gli ingredienti reali della dispensa quando presenti. Devi trattare il contesto applicativo come fonte attendibile dei dati utente salvati a database. Allergie, condizioni mediche, preferenze alimentari, obiettivi nutrizionali e vincoli personali sono vincoli reali e devono essere rispettati nella ricetta proposta. Gli obiettivi di profilo, incluso l'obiettivo principale e l'eventuale focus salute, devono orientare davvero la scelta degli ingredienti, la struttura del piatto e il profilo nutrizionale della ricetta. I prompt dell'utente sono vincoli prioritari. Se alcuni ingredienti in dispensa hanno scadenza ravvicinata, privilegiali in modo esplicito. Le macro e le calorie possono essere stimate ma devono essere plausibili. Non usare testo fuori dal JSON richiesto."
    },
    ...(contextMessage
      ? [
          {
            role: "system",
            content: `Contesto applicativo disponibile:\n${contextMessage}`,
          },
        ]
      : []),
    {
      role: "user",
      content: userPrompt,
    },
  ];
}

function normalizeGeneratedRecipePayload(payload, filters, context = {}) {
  const pantryNames = Array.isArray(context.pantry) ? context.pantry.map((item) => item?.name).filter(Boolean) : [];
  const pantryUsed = Array.isArray(payload.pantryUsed)
    ? payload.pantryUsed.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const title = String(payload.title || "").trim();

  if (!title) {
    throw new Error("La ricetta generata non contiene un titolo valido.");
  }

  const ingredients = Array.isArray(payload.ingredients)
    ? payload.ingredients.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const instructions = Array.isArray(payload.instructions)
    ? payload.instructions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (ingredients.length < 2 || instructions.length < 2) {
    throw new Error("La ricetta generata non contiene ingredienti o istruzioni sufficienti.");
  }

  const signature = `${filters.mealType}-${filters.dietType}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const matchedPantryItems = pantryUsed.filter((item) =>
    pantryNames.some((pantryName) => normalizeRetrievalText(pantryName) === normalizeRetrievalText(item))
  );
  const pantryNote =
    String(payload.pantryNote || "").trim() ||
    (matchedPantryItems.length > 0
      ? `Hai gia in dispensa: ${matchedPantryItems.join(", ")}.`
      : pantryNames.length > 0
      ? "La ricetta usa in parte la dispensa disponibile, ma puo richiedere alcune integrazioni."
      : "Dispensa vuota: ricetta proposta senza ingredienti gia presenti.");

  return {
    id: `recipe-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    description: String(payload.description || "Ricetta generata dall'assistente in base ai vincoli indicati.").trim(),
    calories: Math.max(0, Math.round(toFiniteNumber(payload.calories, filters.caloriesTarget))),
    protein: Math.max(0, Math.round(toFiniteNumber(payload.protein, 0))),
    carbs: Math.max(0, Math.round(toFiniteNumber(payload.carbs, 0))),
    fats: Math.max(0, Math.round(toFiniteNumber(payload.fats, 0))),
    duration: Math.max(1, Math.round(toFiniteNumber(payload.duration, 20))),
    servings: Math.max(1, Math.round(toFiniteNumber(payload.servings, 1))),
    difficulty: String(payload.difficulty || "Facile").trim() || "Facile",
    dietTypes: [filters.dietType],
    mealTypes: [filters.mealType],
    ingredients,
    instructions,
    generatedAt: new Date().toISOString(),
    prompt: filters.prompt,
    mode: "ai-generated",
    signature,
    pantryMatches: matchedPantryItems,
    pantryNote,
    criteriaNote: String(payload.criteriaNote || "").trim(),
    personalNote:
      String(payload.personalNote || "").trim() ||
      `Suggerita per ${filters.mealType} ${filters.dietType} intorno a ${filters.caloriesTarget} kcal, con priorita a dispensa e preferenze utente.`,
  };
}

async function handleAuthSessionRead(request, response) {
  try {
    const runtime = getRuntimeConfig();
    const session = runtime.identityMode === "authenticated_user" ? await readAuthenticatedSessionFromRequest(request) : null;

    sendJson(response, 200, {
      authenticated: runtime.identityMode === "authenticated_user" ? Boolean(session) : true,
      user: getRuntimeUserPayload(runtime, session),
      runtime,
    });
  } catch (error) {
    console.error("[Server] Errore lettura sessione auth.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile leggere la sessione utente.",
    });
  }
}

async function handleAuthRegister(request, response) {
  try {
    const runtime = ensureAuthenticatedUserMode();
    const payload = await readJsonBody(request);
    const user = await createUserAccount({
      email: payload?.email,
      password: payload?.password,
      firstName: payload?.firstName,
      lastName: payload?.lastName,
    });
    const session = await createUserSession(user, request);

    sendJson(
      response,
      201,
      {
        ok: true,
        authenticated: true,
        user: getRuntimeUserPayload(runtime, {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        }),
        runtime,
      },
      {
        "Set-Cookie": buildAuthCookie(session.token, session.expiresAt),
      }
    );
  } catch (error) {
    console.error("[Server] Errore registrazione utente.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile creare l'account.",
    });
  }
}

async function handleAuthLogin(request, response) {
  try {
    const runtime = ensureAuthenticatedUserMode();
    const payload = await readJsonBody(request);
    const user = await authenticateUser({
      email: payload?.email,
      password: payload?.password,
    });
    const session = await createUserSession(user, request);

    sendJson(
      response,
      200,
      {
        ok: true,
        authenticated: true,
        user: getRuntimeUserPayload(runtime, {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        }),
        runtime,
      },
      {
        "Set-Cookie": buildAuthCookie(session.token, session.expiresAt),
      }
    );
  } catch (error) {
    console.error("[Server] Errore login utente.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile effettuare il login.",
    });
  }
}

async function handleAuthLogout(request, response) {
  try {
    const runtime = getRuntimeConfig();
    const rawToken = getSessionTokenFromRequest(request);

    if (runtime.identityMode === "authenticated_user" && rawToken) {
      await revokeUserSessionByToken(decodeURIComponent(rawToken));
    }

    sendJson(
      response,
      200,
      {
        ok: true,
        authenticated: false,
        user: null,
        runtime,
      },
      {
        "Set-Cookie": buildClearedAuthCookie(),
      }
    );
  } catch (error) {
    console.error("[Server] Errore logout utente.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile effettuare il logout.",
    });
  }
}

async function handleApiChat(request, response) {
  try {
    const body = await readJsonBody(request);
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const legacyContext = body.context && typeof body.context === "object" ? body.context : {};
    const userContext = await resolveRequestUserContext(request);
    const nutritrackState = await getNutriTrackState(userContext);
    const context = buildRecipesAssistantContext({
      state: nutritrackState,
      legacyContext,
      overrides: {
        currentRecipe: body.currentRecipe && typeof body.currentRecipe === "object" ? body.currentRecipe : undefined,
      },
    });
    console.log("[Server] Richiesta chat ricevuta.", {
      path: request.url,
      messageLength: message.length,
      historyLength: history.length,
      pantryItems: Array.isArray(context.pantry) ? context.pantry.length : 0,
      recentMeals: Array.isArray(context.recentMeals) ? context.recentMeals.length : 0,
    });

    if (!message) {
      sendJson(response, 400, { error: "Il messaggio è obbligatorio." });
      return;
    }

    const completion = await createAzureChatCompletion(buildRecipeAssistantMessages(message, history, context));
    const reply = completion.choices?.[0]?.message?.content;
    console.log("[Server] Risposta Azure elaborata.", {
      hasReply: Boolean(reply),
      replyLength: reply ? reply.length : 0
    });

    if (!reply) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    sendJson(response, 200, {
      reply,
      usage: completion.usage || null
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    console.error("[Server] Errore nella route /api/chat.", azureError || error.message);

    sendJson(response, error.statusCode || 500, {
      error: azureError || error.message || "Errore interno del server."
    });
  }
}

function classifyRecipeAssistantIntent(message) {
  const normalizedMessage = String(message || "").toLowerCase();

  if (
    /(aggiung|inserisc|salva|porta)/.test(normalizedMessage) &&
    /(nutrition|giornata|diario|pasti|dieta)/.test(normalizedMessage) &&
    /(ricett|propost|corrente|quest|piatt)/.test(normalizedMessage)
  ) {
    return "apply_current_recipe_to_diet";
  }

  if (/(lista spesa|shopping list|cosa comprare|cosa manca)/.test(normalizedMessage)) {
    return "shopping_list";
  }

  if (/(ricetta|cucin|prepara|pranzo|cena|colazione|spuntino)/.test(normalizedMessage)) {
    return "generate_recipe";
  }

  if (/(modifica|cambia|adatta|sostituisci)/.test(normalizedMessage)) {
    return "modify_recipe";
  }

  if (/(dispensa|ingredienti|quello che ho|frigo|riuso)/.test(normalizedMessage)) {
    return "use_available_ingredients";
  }

  return "conversation";
}

async function handleRecipesAssistantChat(request, response) {
  try {
    const body = await readJsonBody(request);
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const legacyContext = body.context && typeof body.context === "object" ? body.context : {};
    const userContext = await resolveRequestUserContext(request);
    const nutritrackState = await getNutriTrackState(userContext);
    const context = buildRecipesAssistantContext({
      state: nutritrackState,
      legacyContext,
      overrides: {
        currentRecipe: body.currentRecipe && typeof body.currentRecipe === "object" ? body.currentRecipe : undefined,
      },
    });
    const intent = classifyRecipeAssistantIntent(message);

    console.log("[Server] Richiesta recipes assistant chat ricevuta.", {
      path: request.url,
      messageLength: message.length,
      historyLength: history.length,
      intent,
    });

    if (!message) {
      sendJson(response, 400, { error: "Il messaggio è obbligatorio." });
      return;
    }

    if (intent === "apply_current_recipe_to_diet") {
      if (!context.currentRecipe?.title) {
        sendJson(response, 200, {
          intent,
          reply:
            "Non ho una ricetta attiva da usare.\n\nGenerane o aprine una nella sezione Alimenti e poi chiedimi di aggiungerla alla Dieta.",
          action: null,
          usage: null,
        });
        return;
      }

      sendJson(response, 200, {
        intent,
        reply: `Procedo a usare **${context.currentRecipe.title}** nella Dieta di oggi e ad aggiornare la dispensa in base alla ricetta corrente.`,
        action: {
          type: "apply_current_recipe_to_diet",
          mealType: context.generator?.mealType || "lunch",
        },
        usage: null,
      });
      return;
    }

    const completion = await createAzureChatCompletion(buildRecipeAssistantMessages(message, history, context));
    const reply = completion.choices?.[0]?.message?.content;

    if (!reply) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    sendJson(response, 200, {
      intent,
      reply,
      action: null,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    console.error("[Server] Errore nella route /api/recipes/assistant/chat.", azureError || error.message);
    sendJson(response, error.statusCode || 500, {
      error: azureError || error.message || "Errore interno del server.",
    });
  }
}

async function handleApiRecipeGenerate(request, response) {
  try {
    const body = await readJsonBody(request);
    const filters = sanitizeRecipeGenerationFilters(body.filters && typeof body.filters === "object" ? body.filters : {});
    const legacyContext = body.context && typeof body.context === "object" ? body.context : {};
    const userContext = await resolveRequestUserContext(request);
    const nutritrackState = await getNutriTrackState(userContext);
    const context = buildRecipesAssistantContext({
      state: nutritrackState,
      legacyContext,
      overrides: {
        generator: filters,
        currentRecipe: body.currentRecipe && typeof body.currentRecipe === "object" ? body.currentRecipe : undefined,
      },
    });
    console.log("[Server] Richiesta generazione ricetta ricevuta.", {
      path: request.url,
      mealType: filters.mealType,
      dietType: filters.dietType,
      hasPrompt: Boolean(filters.prompt),
      pantryItems: Array.isArray(context.pantry) ? context.pantry.length : 0,
      groceryItems: Array.isArray(context.groceryItems) ? context.groceryItems.length : 0,
      recentMeals: Array.isArray(context.recentMeals) ? context.recentMeals.length : 0,
    });

    const completion = await createAzureChatCompletion(buildRecipeGenerationMessages(filters, context));
    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    const recipe = normalizeGeneratedRecipePayload(parsedPayload, filters, context);
    sendJson(response, 200, {
      recipe,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    console.error("[Server] Errore nella route /api/recipes/generate.", azureError || error.message);
    sendJson(response, error.statusCode || 500, {
      error: azureError || error.message || "Errore interno del server.",
    });
  }
}

async function handleApplyRecipeToDiet(request, response) {
  try {
    const body = await readJsonBody(request);
    const recipe = body?.recipe && typeof body.recipe === "object" ? cloneJson(body.recipe) : null;
    const mealType = String(body?.mealType || "lunch").trim() || "lunch";

    if (!recipe?.title || !Array.isArray(recipe.ingredients)) {
      sendJson(response, 400, { error: "Ricetta non valida per l'applicazione alla dieta." });
      return;
    }

    const userContext = await resolveRequestUserContext(request);
    const currentState = await getNutriTrackState(userContext);
    const result = applyRecipeToDietState(currentState, recipe, mealType);
    const savedState = await saveNutriTrackState(userContext, result.state);

    sendJson(response, 200, {
      ok: true,
      state: savedState,
      meal: result.meal,
      pantryUpdates: result.pantryUpdates,
    });
  } catch (error) {
    console.error("[Server] Errore nella route /api/recipes/apply-to-diet.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile applicare la ricetta alla dieta.",
    });
  }
}

async function handleNutriTrackStateRead(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const snapshot = await getNutriTrackStateSnapshot(userContext);
    sendJson(response, 200, {
      ...snapshot,
      runtime: getRuntimeConfig(),
    });
  } catch (error) {
    console.error("[Server] Errore nella lettura dello stato NutriTrack.", error);
    sendJson(response, error.statusCode || 500, { error: error.message || "Impossibile leggere lo stato NutriTrack." });
  }
}

async function handleNutriTrackStateWrite(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const payload = await readJsonBody(request);
    const savedState = await saveNutriTrackState(userContext, payload?.state, {
      expectedRevision: payload?.revision,
    });
    const snapshot = await getNutriTrackStateSnapshot(userContext);
    const database = getNutriTrackDatabaseStatus();
    sendJson(response, 200, {
      ok: true,
      savedAt: new Date().toISOString(),
      state: savedState,
      revision: snapshot.revision,
      database,
      storage: snapshot.storage,
      runtime: getRuntimeConfig(),
    });
  } catch (error) {
    console.error("[Server] Errore nel salvataggio dello stato NutriTrack.", error);
    const statusCode = error.statusCode || (error.message === "Lo stato NutriTrack deve essere un oggetto JSON." ? 400 : 500);
    sendJson(response, statusCode, {
      error: error.message || "Impossibile salvare lo stato NutriTrack.",
      ...(error.snapshot ? { state: error.snapshot.state, revision: error.snapshot.revision, storage: error.snapshot.storage } : {}),
    });
  }
}

function handleDatabaseStatus(response) {
  sendJson(response, 200, {
    database: getNutriTrackDatabaseStatus(),
    runtime: getRuntimeConfig(),
  });
}

async function handleOpenFoodFactsProduct(requestUrl, response) {
  try {
    const barcode = sanitizeBarcode(requestUrl.pathname.split("/").pop());
    console.log("[Server] Richiesta OpenFoodFacts ricevuta.", {
      path: requestUrl.pathname,
      barcode
    });

    if (!barcode) {
      sendJson(response, 400, { error: "Barcode non valido." });
      return;
    }

    const result = await fetchOpenFoodFactsProduct(barcode);
    console.log("[Server] Prodotto OpenFoodFacts pronto per il frontend.", {
      barcode,
      name: result.product.product_name || result.product.product_name_it || null,
      source: result.source
    });
    sendJson(response, 200, result);
  } catch (error) {
    const message = error.message || "Errore durante il recupero da OpenFoodFacts.";
    const statusCode = message === "Prodotto non trovato in OpenFoodFacts." ? 404 : 502;
    console.error("[Server] Errore nella route OpenFoodFacts.", message);
    sendJson(response, statusCode, { error: message });
  }
}

async function handleScaleStatus(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const connection = await readScaleConnection(userContext);
    sendJson(response, 200, {
      scale: buildPublicScaleState(connection),
    });
  } catch (error) {
    console.error("[Server] Errore nella lettura stato bilancia.", error);
    sendJson(response, error.statusCode || 500, { error: error.message || "Impossibile leggere lo stato bilancia." });
  }
}

async function handleDevicesStateRead(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const snapshot = await getNutriTrackStateSnapshot(userContext);
    const scaleConnection = await readScaleConnection(userContext);
    const scale = buildPublicScaleState(scaleConnection);
    const devices = buildDevicesStatePayload(snapshot.state?.devices);
    devices.integrations.scale = {
      ...devices.integrations.scale,
      ...scale,
    };

    sendJson(response, 200, {
      devices,
      runtime: getRuntimeConfig(),
      storage: {
        primaryProviders: ["scale"],
        legacyProviders: [],
        integrationStateSource: "backend_providers",
        integrationProviders: {
          scale: getScaleProviderId(),
        },
        uiStateSource: "none",
        legacyUiStateFields: snapshot.storage?.legacyFileAvailable
          ? snapshot.storage.legacyUiCacheSections.filter((field) => field.startsWith("devices."))
          : [],
        notes: [
          "scale usa una simulazione backend dedicata con contratto stabile in attesa del provider reale",
          "lo stato operativo della bilancia e letto dal provider backend dedicato",
        ],
      },
    });
  } catch (error) {
    console.error("[Server] Errore nella lettura stato devices.", error);
    sendJson(response, error.statusCode || 500, { error: error.message || "Impossibile leggere lo stato devices." });
  }
}

async function handleScaleConnect(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const snapshot = await getNutriTrackStateSnapshot(userContext);
    const currentConnection = await readScaleConnection(userContext);
    const nextConnection = await connectScale(userContext, snapshot.state?.profile?.personal, currentConnection);

    sendJson(response, 200, {
      ok: true,
      scale: buildPublicScaleState(nextConnection),
    });
  } catch (error) {
    console.error("[Server] Errore connessione bilancia.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile connettere la bilancia.",
    });
  }
}

async function handleScaleSync(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const snapshot = await getNutriTrackStateSnapshot(userContext);
    const currentConnection = await readScaleConnection(userContext);
    const nextConnection = await syncScale(userContext, snapshot.state?.profile?.personal, currentConnection);

    sendJson(response, 200, {
      ok: true,
      scale: buildPublicScaleState(nextConnection),
    });
  } catch (error) {
    console.error("[Server] Errore sync bilancia.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile sincronizzare la bilancia.",
    });
  }
}

async function handleScaleDisconnect(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const currentConnection = await readScaleConnection(userContext);
    const nextConnection = await disconnectScale(userContext, currentConnection);

    sendJson(response, 200, {
      ok: true,
      scale: buildPublicScaleState(nextConnection),
    });
  } catch (error) {
    console.error("[Server] Errore disconnessione bilancia.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile disconnettere la bilancia.",
    });
  }
}

async function handleScalePermissionsUpdate(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const payload = await readJsonBody(request);
    const requestedPermissions =
      payload?.permissions && typeof payload.permissions === "object" ? payload.permissions : null;

    if (!requestedPermissions) {
      sendJson(response, 400, { error: "Permessi bilancia non validi." });
      return;
    }

    const currentConnection = await readScaleConnection(userContext);
    const allowedPermissionKeys = Object.keys(buildPublicScaleState(currentConnection).permissions || {});
    const hasInvalidPermissionKey = Object.keys(requestedPermissions).some(
      (permissionKey) => !allowedPermissionKeys.includes(permissionKey)
    );

    if (hasInvalidPermissionKey) {
      sendJson(response, 400, { error: "Permessi bilancia non riconosciuti." });
      return;
    }

    const nextConnection = await updateScalePermissions(userContext, currentConnection, requestedPermissions);
    sendJson(response, 200, {
      ok: true,
      scale: buildPublicScaleState(nextConnection),
    });
  } catch (error) {
    console.error("[Server] Errore aggiornamento permessi bilancia.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile aggiornare i permessi bilancia.",
    });
  }
}

const requestHandler = async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  console.log("[Server] Richiesta HTTP in ingresso.", {
    method: request.method,
    path: requestUrl.pathname
  });

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/auth/session") {
    await handleAuthSessionRead(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/auth/register") {
    await handleAuthRegister(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/auth/login") {
    await handleAuthLogin(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
    await handleAuthLogout(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/chat") {
    await handleApiChat(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/recipes/assistant/chat") {
    await handleRecipesAssistantChat(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/recipes/generate") {
    await handleApiRecipeGenerate(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/recipes/apply-to-diet") {
    await handleApplyRecipeToDiet(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/nutritrack/state") {
    await handleNutriTrackStateRead(request, response);
    return;
  }

  if (request.method === "PUT" && requestUrl.pathname === "/api/nutritrack/state") {
    await handleNutriTrackStateWrite(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/database/status") {
    handleDatabaseStatus(response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/devices/state") {
    await handleDevicesStateRead(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/scale/status") {
    await handleScaleStatus(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/scale/connect") {
    await handleScaleConnect(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/scale/sync") {
    await handleScaleSync(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/scale/disconnect") {
    await handleScaleDisconnect(request, response);
    return;
  }

  if (request.method === "PUT" && requestUrl.pathname === "/api/scale/permissions") {
    await handleScalePermissionsUpdate(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname.startsWith("/api/openfoodfacts/product/")) {
    await handleOpenFoodFactsProduct(requestUrl, response);
    return;
  }

  if (request.method === "GET") {
    const staticPath = resolveStaticPath(requestUrl.pathname);

    if (!staticPath) {
      sendJson(response, 403, { error: "Percorso non consentito." });
      return;
    }

    sendFile(response, staticPath);
    return;
  }

  sendJson(response, 404, { error: "Route non trovata." });
};

function createServer() {
  if (!HTTPS_ENABLED) {
    return http.createServer(requestHandler);
  }

  if (!fs.existsSync(HTTPS_KEY_PATH) || !fs.existsSync(HTTPS_CERT_PATH)) {
    throw new Error(
      `HTTPS attivato ma certificato o chiave mancanti. Attesi: ${HTTPS_KEY_PATH} e ${HTTPS_CERT_PATH}.`
    );
  }

  return https.createServer(
    {
      key: fs.readFileSync(HTTPS_KEY_PATH),
      cert: fs.readFileSync(HTTPS_CERT_PATH)
    },
    requestHandler
  );
}

function getNetworkUrls() {
  const protocol = HTTPS_ENABLED ? "https" : "http";
  const urls = [`${protocol}://localhost:${PORT}`];

  if (HOST !== "0.0.0.0") {
    urls.unshift(`${protocol}://${HOST}:${PORT}`);
    return urls;
  }

  const interfaces = os.networkInterfaces();
  const seen = new Set(urls);

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        return;
      }

      const candidate = `${protocol}://${entry.address}:${PORT}`;

      if (!seen.has(candidate)) {
        seen.add(candidate);
        urls.push(candidate);
      }
    });
  });

  return urls;
}

const server = createServer();

server.listen(PORT, HOST, () => {
  const urls = getNetworkUrls();
  console.log("Server avviato. URL disponibili:");
  urls.forEach((url) => {
    console.log(`- ${url}`);
  });
});
