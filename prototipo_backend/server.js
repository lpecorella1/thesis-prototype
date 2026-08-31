require("./backend-env");

const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
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
  confirmPasswordReset,
  createUserAccount,
  createUserSession,
  readAuthenticatedSessionFromRequest,
  requestPasswordReset,
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
  recordClientScaleMeasurement,
  syncScale,
  updateScalePermissions,
} = require("./scale");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const HTTPS_ENABLED = process.env.HTTPS === "1";
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || path.join(__dirname, "certs", "local-key.pem");
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || path.join(__dirname, "certs", "local-cert.pem");
const repositoryRoot = path.resolve(__dirname, "..");
const frontendRoot = path.join(repositoryRoot, "frontend");
const APP_BASE_PATH = normalizeAppBasePath(process.env.NUTRITRACK_BASE_PATH || "/nutritrack");
const MAX_JSON_BODY_BYTES = 8_000_000;

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
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function normalizeAppBasePath(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue === "/") {
    return "";
  }

  return `/${rawValue.replace(/^\/+|\/+$/g, "")}`;
}

function resolveRequestPath(urlPath) {
  if (!APP_BASE_PATH) {
    return {
      path: urlPath,
      isBasePathRequest: false,
    };
  }

  if (urlPath === APP_BASE_PATH) {
    return {
      path: "/",
      isBasePathRequest: true,
    };
  }

  if (urlPath.startsWith(`${APP_BASE_PATH}/`)) {
    return {
      path: urlPath.slice(APP_BASE_PATH.length) || "/",
      isBasePathRequest: true,
    };
  }

  return {
    path: urlPath,
    isBasePathRequest: false,
  };
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
  const cacheControl = [".html", ".js", ".css"].includes(extension)
    ? "no-cache"
    : "public, max-age=3600";

  fs.readFile(filePath, (error, fileContent) => {
    if (error) {
      sendJson(response, 404, { error: "File non trovato." });
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    });
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

      if (rawBody.length > MAX_JSON_BODY_BYTES) {
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

function isAzureResponseFormatUnsupported(error) {
  const message = String(error?.details?.error?.message || error?.message || "").toLowerCase();
  const code = String(error?.details?.error?.code || "").toLowerCase();

  return (
    error?.statusCode === 400 &&
    (message.includes("response_format") ||
      message.includes("json_object") ||
      message.includes("not supported") ||
      code.includes("unsupported"))
  );
}

const MEAL_COMPONENT_ESTIMATES = Object.freeze([
  {
    keywords: ["pasta", "lenticchie"],
    item: { name: "Pasta con lenticchie", quantity: "1 piatto", calories: 560, protein: 24, carbs: 88, fats: 10, confidence: 0.62 },
  },
  {
    keywords: ["brioche", "gelato"],
    item: { name: "Brioche con gelato", quantity: "1 porzione", calories: 430, protein: 8, carbs: 62, fats: 17, confidence: 0.55 },
  },
  {
    keywords: ["banana"],
    item: { name: "Banana", quantity: "1 media", calories: 105, protein: 1, carbs: 27, fats: 0, confidence: 0.74 },
  },
  {
    keywords: ["pasta"],
    item: { name: "Pasta", quantity: "1 piatto", calories: 480, protein: 15, carbs: 82, fats: 9, confidence: 0.54 },
  },
  {
    keywords: ["riso"],
    item: { name: "Riso", quantity: "1 piatto", calories: 430, protein: 9, carbs: 86, fats: 4, confidence: 0.54 },
  },
  {
    keywords: ["pollo"],
    item: { name: "Pollo", quantity: "1 porzione", calories: 260, protein: 38, carbs: 0, fats: 10, confidence: 0.58 },
  },
  {
    keywords: ["insalata"],
    item: { name: "Insalata", quantity: "1 porzione", calories: 160, protein: 5, carbs: 14, fats: 9, confidence: 0.5 },
  },
  {
    keywords: ["gelato"],
    item: { name: "Gelato", quantity: "1 coppetta", calories: 220, protein: 5, carbs: 30, fats: 9, confidence: 0.52 },
  },
  {
    keywords: ["brioche", "cornetto"],
    item: { name: "Brioche", quantity: "1 pezzo", calories: 260, protein: 6, carbs: 35, fats: 11, confidence: 0.56 },
  },
]);

function splitMealDescriptionIntoComponents(description) {
  return String(description || "")
    .split(/\s*(?:\+|;|,|\n|\b(?:e|ed)\b)\s*/gi)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function estimateMealComponentFromText(rawText) {
  const normalized = normalizeRetrievalText(rawText);
  const matchedEstimate = MEAL_COMPONENT_ESTIMATES.find((estimate) =>
    estimate.keywords.every((keyword) => normalized.includes(normalizeRetrievalText(keyword)))
  );

  if (matchedEstimate) {
    return {
      ...matchedEstimate.item,
      rawText,
      source: "standard-portion-fallback",
    };
  }

  return {
    rawText,
    name: String(rawText || "Componente pasto").trim(),
    quantity: "1 porzione",
    calories: 320,
    protein: 12,
    carbs: 35,
    fats: 12,
    confidence: 0.35,
    source: "generic-fallback",
  };
}

function buildFallbackMealAnalysis(description) {
  const items = splitMealDescriptionIntoComponents(description).map(estimateMealComponentFromText);

  if (items.length === 0) {
    throw new Error("Descrizione pasto obbligatoria.");
  }

  const totals = items.reduce(
    (result, item) => {
      result.calories += roundMacroValue(item.calories);
      result.protein += roundMacroValue(item.protein);
      result.carbs += roundMacroValue(item.carbs);
      result.fats += roundMacroValue(item.fats);
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    name: description,
    items,
    totals,
    confidence: Math.min(...items.map((item) => item.confidence ?? 0.35)),
    source: "fallback-standard-portions",
    reviewNote: "Stima basata su porzioni standard: da far confermare o correggere all'utente.",
  };
}

function buildMealAnalysisMessages(description, context = {}) {
  const references = Array.isArray(context.openFoodFactsKnowledge?.records)
    ? context.openFoodFactsKnowledge.records.slice(0, 12).map((record) => ({
        title: record.title,
        brand: record.brand,
        serving: record.serving,
        quantity: record.quantity,
        nutrition: record.nutrition,
        source: record.source,
      }))
    : [];

  const standardPortions = MEAL_COMPONENT_ESTIMATES.map((estimate) => estimate.item);

  return [
    {
      role: "system",
      content:
        "Sei un motore di analisi per diario alimentare. Devi convertire una descrizione libera di un intero pasto in dati nutrizionali strutturati. Usa i riferimenti OpenFoodFacts forniti solo quando pertinenti; altrimenti usa porzioni standard prudenti e dichiara confidence piu bassa. Non fornire consigli medici. Rispondi solo con JSON valido.",
    },
    {
      role: "user",
      content: [
        `Descrizione pasto: ${description}`,
        "I separatori +, virgola, punto e virgola, nuova riga e le congiunzioni italiane e/ed indicano componenti diversi del pasto quando presenti. Se una quantita e' scritta vicino a un alimento, assegnala a quell'item specifico.",
        `Riferimenti OpenFoodFacts disponibili: ${JSON.stringify(references)}`,
        `Porzioni standard fallback: ${JSON.stringify(standardPortions)}`,
        "Restituisci JSON nel formato esatto {\"name\":\"\",\"items\":[{\"rawText\":\"\",\"name\":\"\",\"quantity\":\"\",\"calories\":0,\"protein\":0,\"carbs\":0,\"fats\":0,\"confidence\":0.0,\"source\":\"openfoodfacts|standard-portion|ai-estimate\"}],\"totals\":{\"calories\":0,\"protein\":0,\"carbs\":0,\"fats\":0},\"confidence\":0.0,\"reviewNote\":\"\"}. I totals devono essere la somma degli items.",
      ].join("\n"),
    },
  ];
}

function buildMealPhotoDescriptionMessages(imageDataUrl) {
  return [
    {
      role: "system",
      content:
        "Sei un motore di riconoscimento visivo per diario alimentare. Devi osservare una foto di un pasto e convertirla in una descrizione testuale breve, in italiano, adatta a essere analizzata da un calcolatore nutrizionale. Non inventare alimenti non visibili. Quando possibile indica quantita o porzioni stimate vicino a ogni alimento. Rispondi solo con JSON valido.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "Analizza la foto del pasto. Restituisci JSON nel formato {\"description\":\"\",\"items\":[{\"name\":\"\",\"quantity\":\"\",\"confidence\":0.0}],\"reviewNote\":\"\"}. " +
            "La description deve essere una singola frase pronta per il form, separando gli alimenti con virgole o con 'e'. Esempio: \"80 g pasta con lenticchie, 1 banana e brioche con gelato\".",
        },
        {
          type: "image_url",
          image_url: {
            url: imageDataUrl,
          },
        },
      ],
    },
  ];
}

function normalizeMealPhotoDescriptionPayload(payload) {
  const itemDescriptions = Array.isArray(payload?.items)
    ? payload.items
        .map((item) => {
          const name = String(item?.name || "").trim();
          const quantity = String(item?.quantity || "").trim();
          return name ? `${quantity ? `${quantity} ` : ""}${name}` : "";
        })
        .filter(Boolean)
    : [];
  const description = String(payload?.description || "").trim() || itemDescriptions.join(", ");

  if (!description) {
    throw new Error("Nessun alimento riconoscibile nella foto.");
  }

  return {
    description,
    items: itemDescriptions,
    reviewNote: String(payload?.reviewNote || "Controlla la descrizione prima di aggiungere il pasto.").trim(),
  };
}

function normalizeMealAnalysisItem(item) {
  return {
    rawText: String(item?.rawText || item?.name || "").trim(),
    name: String(item?.name || item?.rawText || "Alimento").trim(),
    quantity: String(item?.quantity || "1 porzione").trim(),
    calories: roundMacroValue(item?.calories),
    protein: roundMacroValue(item?.protein),
    carbs: roundMacroValue(item?.carbs),
    fats: roundMacroValue(item?.fats),
    confidence: normalizePantryImportConfidence(item?.confidence) ?? 0.45,
    source: String(item?.source || "ai-estimate").trim(),
  };
}

function normalizeMealAnalysisPayload(payload, description) {
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeMealAnalysisItem).filter((item) => item.name)
    : [];

  if (items.length === 0) {
    return buildFallbackMealAnalysis(description);
  }

  const totals = items.reduce(
    (result, item) => {
      result.calories += item.calories;
      result.protein += item.protein;
      result.carbs += item.carbs;
      result.fats += item.fats;
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    name: String(payload?.name || description).trim(),
    items: items.slice(0, 12),
    totals,
    confidence: normalizePantryImportConfidence(payload?.confidence) ?? Math.min(...items.map((item) => item.confidence)),
    source: "ai-meal-analysis",
    reviewNote: String(payload?.reviewNote || "Rivedi le porzioni prima di salvare.").trim(),
  };
}

async function handleMealPhotoDescription(request, response) {
  try {
    const payload = await readJsonBody(request);
    const imageDataUrl = sanitizePantryImportImageDataUrl(payload?.image?.dataUrl || payload?.imageDataUrl);
    const messages = buildMealPhotoDescriptionMessages(imageDataUrl);
    let completion;

    try {
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 700,
        responseFormat: { type: "json_object" },
        temperature: 0.1,
      });
    } catch (error) {
      if (!isAzureResponseFormatUnsupported(error)) {
        throw error;
      }

      completion = await createAzureChatCompletion(messages, {
        maxTokens: 700,
        temperature: 0.1,
      });
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    const result = normalizeMealPhotoDescriptionPayload(parsedPayload);

    sendJson(response, 200, {
      ...result,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    const statusCode = error.message === "Formato immagine non valido." || error.message?.startsWith("Immagine troppo grande") ? 400 : error.statusCode || 500;
    console.error("[Server] Errore nella route /api/nutrition/describe-meal-image.", azureError || error.message);
    sendJson(response, statusCode, {
      error: azureError || error.message || "Impossibile riconoscere il pasto dalla foto.",
    });
  }
}

async function handleMealNutritionAnalysis(request, response) {
  let errorPhase = "init";
  let fallbackDescription = "";

  try {
    errorPhase = "read-body";
    const payload = await readJsonBody(request);
    const description = String(payload?.description || "").trim();
    fallbackDescription = description;

    if (!description) {
      sendJson(response, 400, { error: "La descrizione del pasto e' obbligatoria." });
      return;
    }

    const requestedState = payload?.state && typeof payload.state === "object" ? payload.state : null;
    let stateForContext = requestedState;

    if (!stateForContext) {
      errorPhase = "resolve-user";
      const userContext = await resolveRequestUserContext(request);
      errorPhase = "read-state";
      stateForContext = await getNutriTrackState(userContext);
    }

    errorPhase = "build-context";
    const context = buildRecipesAssistantContext({
      state: stateForContext,
    });

    errorPhase = "azure-completion";
    const messages = buildMealAnalysisMessages(description, context);
    let completion;

    try {
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1000,
        responseFormat: { type: "json_object" },
        temperature: 0.15,
      });
    } catch (error) {
      if (!isAzureResponseFormatUnsupported(error)) {
        throw error;
      }

      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1000,
        temperature: 0.15,
      });
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("Risposta Azure OpenAI non valida.");
    }

    errorPhase = "parse-json";
    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    errorPhase = "normalize-analysis";
    const analysis = normalizeMealAnalysisPayload(parsedPayload, description);

    sendJson(response, 200, {
      analysis,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    console.warn("[Server] Analisi pasto AI non disponibile, uso fallback.", {
      phase: errorPhase,
      message: azureError || error.message,
    });

    try {
      sendJson(response, 200, {
        analysis: buildFallbackMealAnalysis(fallbackDescription),
        usage: null,
        fallback: true,
      });
    } catch {
      sendJson(response, error.statusCode || 500, {
        error: azureError || error.message || "Impossibile analizzare il pasto.",
        phase: errorPhase,
      });
    }
  }
}

const MEDICAL_DOCUMENT_METRIC_KEYS = new Set([
  "total_cholesterol",
  "hdl_cholesterol",
  "ldl_cholesterol",
  "triglycerides",
  "glucose",
  "hba1c",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "other",
]);

const MEDICAL_DOCUMENT_STATUSES = new Set(["low", "normal", "high", "unknown"]);
const MEDICAL_DOCUMENT_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MEDICAL_DOCUMENT_TEXT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_MEDICAL_DOCUMENT_BYTES = 5_500_000;

function sanitizeMedicalDocumentText(value, maxLength = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeMedicalDocumentDate(value) {
  const normalized = sanitizeMedicalDocumentText(value, 24);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function inferMedicalDocumentMimeType(value, fileName = "") {
  const mimeType = String(value || "").trim().toLowerCase();

  if (MEDICAL_DOCUMENT_IMAGE_MIME_TYPES.has(mimeType) || MEDICAL_DOCUMENT_TEXT_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }

  const extension = path.extname(String(fileName || "").toLowerCase());

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return mimeType;
}

function sanitizeMedicalDocumentDataUrl(value, options = {}) {
  const dataUrl = String(value || "").trim().replace(/\s/g, "");
  const match = dataUrl.match(/^data:([^;,]*);base64,([a-z0-9+/=]+)$/i);

  if (!match) {
    throw new Error("Formato documento non valido.");
  }

  const mimeType = inferMedicalDocumentMimeType(options.mimeType || match[1], options.fileName);

  if (!MEDICAL_DOCUMENT_IMAGE_MIME_TYPES.has(mimeType) && !MEDICAL_DOCUMENT_TEXT_MIME_TYPES.has(mimeType)) {
    throw new Error("Formato non supportato. Carica immagine, PDF o Word .docx.");
  }

  if (dataUrl.length > MAX_JSON_BODY_BYTES - 200_000) {
    throw new Error("Documento troppo grande. Carica un file piu leggero o una foto compressa.");
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > MAX_MEDICAL_DOCUMENT_BYTES) {
    throw new Error("Documento troppo grande. Carica un file piu leggero o una foto compressa.");
  }

  return {
    dataUrl,
    mimeType,
    buffer,
    isImage: MEDICAL_DOCUMENT_IMAGE_MIME_TYPES.has(mimeType),
  };
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function readZipEntries(buffer, wantedNames) {
  const entries = {};
  const minEndOffset = Math.max(0, buffer.length - 0xffff - 22);
  let eocdOffset = -1;

  for (let index = buffer.length - 22; index >= minEndOffset; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Documento Word non leggibile.");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (wantedNames.has(fileName)) {
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        entries[fileName] = compressedData;
      } else if (compressionMethod === 8) {
        entries[fileName] = zlib.inflateRawSync(compressedData);
      }
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function extractTextFromDocx(buffer) {
  const wantedNames = new Set(["word/document.xml", "word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml"]);
  const entries = readZipEntries(buffer, wantedNames);
  const text = Object.values(entries)
    .map((entry) =>
      decodeXmlEntities(
        entry
          .toString("utf8")
          .replace(/<\/w:p>/g, "\n")
          .replace(/<[^>]+>/g, " ")
      )
    )
    .join("\n")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!text) {
    throw new Error("Documento Word senza testo leggibile.");
  }

  return text.slice(0, 12_000);
}

function decodePdfString(value) {
  return String(value || "")
    .replace(/\\([nrtbf()\\])/g, (_, token) => {
      const replacements = { n: "\n", r: "\r", t: "\t", b: "", f: "", "(": "(", ")": ")", "\\": "\\" };
      return replacements[token] ?? token;
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function extractPdfTextFromContent(content) {
  const chunks = [];
  const textOperatorPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayOperatorPattern = /\[((?:.|\n)*?)\]\s*TJ/g;
  let match;

  while ((match = textOperatorPattern.exec(content))) {
    const rawText = match[0].match(/\(((?:\\.|[^\\)])*)\)/)?.[1] || "";
    chunks.push(decodePdfString(rawText));
  }

  while ((match = arrayOperatorPattern.exec(content))) {
    const arrayText = [];
    const stringPattern = /\((?:\\.|[^\\)])*\)/g;
    let stringMatch;

    while ((stringMatch = stringPattern.exec(match[1]))) {
      arrayText.push(decodePdfString(stringMatch[0].slice(1, -1)));
    }

    if (arrayText.length) {
      chunks.push(arrayText.join(""));
    }
  }

  return chunks.join("\n");
}

function extractTextFromPdf(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [extractPdfTextFromContent(raw)];
  let searchOffset = 0;

  while (searchOffset < raw.length) {
    const streamMarkerOffset = raw.indexOf("stream", searchOffset);

    if (streamMarkerOffset === -1) {
      break;
    }

    const streamEndOffset = raw.indexOf("endstream", streamMarkerOffset);

    if (streamEndOffset === -1) {
      break;
    }

    const dictionaryStartOffset = raw.lastIndexOf("<<", streamMarkerOffset);
    const dictionary = dictionaryStartOffset === -1 ? "" : raw.slice(dictionaryStartOffset, streamMarkerOffset);
    let dataStart = streamMarkerOffset + "stream".length;

    if (raw[dataStart] === "\r" && raw[dataStart + 1] === "\n") {
      dataStart += 2;
    } else if (raw[dataStart] === "\n") {
      dataStart += 1;
    }

    let dataEnd = streamEndOffset;

    if (raw[dataEnd - 2] === "\r" && raw[dataEnd - 1] === "\n") {
      dataEnd -= 2;
    } else if (raw[dataEnd - 1] === "\n") {
      dataEnd -= 1;
    }

    const streamBuffer = buffer.subarray(dataStart, dataEnd);

    try {
      const decodedStream = /\/FlateDecode/.test(dictionary) ? zlib.inflateSync(streamBuffer).toString("latin1") : streamBuffer.toString("latin1");
      chunks.push(extractPdfTextFromContent(decodedStream));
    } catch {
      // Some PDF streams are images or use filters this lightweight extractor does not support.
    }

    searchOffset = streamEndOffset + "endstream".length;
  }

  const text = chunks
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 20) {
    throw new Error("PDF senza testo leggibile. Per PDF scannerizzati carica una foto o immagine della pagina.");
  }

  return text.slice(0, 12_000);
}

function extractMedicalDocumentText(documentPayload) {
  if (documentPayload.mimeType === "application/pdf") {
    return extractTextFromPdf(documentPayload.buffer);
  }

  if (documentPayload.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractTextFromDocx(documentPayload.buffer);
  }

  throw new Error("Formato documento non supportato.");
}

function buildMedicalDocumentAnalysisMessages(imageDataUrl) {
  return [
    {
      role: "system",
      content:
        "Sei un motore di estrazione dati per una web app nutrizionale. Devi leggere referti medici fotografati o scannerizzati e restituire solo JSON valido. Estrai solo valori chiaramente leggibili; non fare diagnosi, prescrizioni o terapia. Se un valore e' incerto usa confidence bassa e status unknown.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "Analizza il documento e cerca soprattutto colesterolo totale, HDL, LDL, trigliceridi, glicemia, emoglobina glicata e pressione. " +
            "Restituisci JSON nel formato {\"documentType\":\"\",\"documentDate\":\"YYYY-MM-DD oppure vuoto\",\"patientName\":\"\",\"metrics\":[{\"key\":\"total_cholesterol|hdl_cholesterol|ldl_cholesterol|triglycerides|glucose|hba1c|blood_pressure_systolic|blood_pressure_diastolic|other\",\"label\":\"\",\"value\":\"\",\"unit\":\"\",\"referenceRange\":\"\",\"status\":\"low|normal|high|unknown\",\"confidence\":0.0}],\"nutritionSignals\":[\"\"],\"reviewNote\":\"\"}. " +
            "Usa unita di misura esattamente come nel documento quando leggibili. Lascia fuori dati non utili all'alimentazione o non leggibili.",
        },
        {
          type: "image_url",
          image_url: {
            url: imageDataUrl,
          },
        },
      ],
    },
  ];
}

function buildMedicalDocumentTextAnalysisMessages(extractedText, fileName) {
  return [
    {
      role: "system",
      content:
        "Sei un motore di estrazione dati per una web app nutrizionale. Devi leggere testo estratto da referti medici e restituire solo JSON valido. Estrai solo valori chiaramente presenti; non fare diagnosi, prescrizioni o terapia. Se un valore e' incerto usa confidence bassa e status unknown.",
    },
    {
      role: "user",
      content: [
        `Nome file: ${sanitizeMedicalDocumentText(fileName, 160) || "documento caricato"}`,
        "Testo estratto dal documento:",
        extractedText,
        "Cerca soprattutto colesterolo totale, HDL, LDL, trigliceridi, glicemia, emoglobina glicata e pressione.",
        "Restituisci JSON nel formato {\"documentType\":\"\",\"documentDate\":\"YYYY-MM-DD oppure vuoto\",\"patientName\":\"\",\"metrics\":[{\"key\":\"total_cholesterol|hdl_cholesterol|ldl_cholesterol|triglycerides|glucose|hba1c|blood_pressure_systolic|blood_pressure_diastolic|other\",\"label\":\"\",\"value\":\"\",\"unit\":\"\",\"referenceRange\":\"\",\"status\":\"low|normal|high|unknown\",\"confidence\":0.0}],\"nutritionSignals\":[\"\"],\"reviewNote\":\"\"}.",
      ].join("\n\n"),
    },
  ];
}

function normalizeMedicalDocumentMetric(metric, documentDate) {
  const rawKey = sanitizeMedicalDocumentText(metric?.key, 60).toLowerCase();
  const key = MEDICAL_DOCUMENT_METRIC_KEYS.has(rawKey) ? rawKey : "other";
  const label = sanitizeMedicalDocumentText(metric?.label, 90);
  const value = sanitizeMedicalDocumentText(metric?.value, 60);

  if (!value) {
    return null;
  }

  const rawStatus = sanitizeMedicalDocumentText(metric?.status, 30).toLowerCase();
  const status = MEDICAL_DOCUMENT_STATUSES.has(rawStatus) ? rawStatus : "unknown";

  return {
    key,
    label: label || key.replace(/_/g, " "),
    value,
    unit: sanitizeMedicalDocumentText(metric?.unit, 40),
    referenceRange: sanitizeMedicalDocumentText(metric?.referenceRange, 80),
    status,
    confidence: normalizePantryImportConfidence(metric?.confidence),
    documentDate,
  };
}

function normalizeMedicalDocumentAnalysisPayload(payload) {
  const documentDate = normalizeMedicalDocumentDate(payload?.documentDate);
  const metrics = Array.isArray(payload?.metrics)
    ? payload.metrics.map((metric) => normalizeMedicalDocumentMetric(metric, documentDate)).filter(Boolean).slice(0, 20)
    : [];

  if (metrics.length === 0) {
    throw new Error("Non ho trovato valori clinici leggibili nel documento.");
  }

  const nutritionSignals = Array.isArray(payload?.nutritionSignals)
    ? payload.nutritionSignals.map((signal) => sanitizeMedicalDocumentText(signal, 180)).filter(Boolean).slice(0, 8)
    : [];

  return {
    documentType: sanitizeMedicalDocumentText(payload?.documentType, 80) || "Referto medico",
    documentDate,
    patientName: sanitizeMedicalDocumentText(payload?.patientName, 120),
    metrics,
    nutritionSignals,
    reviewNote:
      sanitizeMedicalDocumentText(payload?.reviewNote, 240) ||
      "Controlla i valori estratti prima di applicarli al profilo. Non sostituiscono il parere medico.",
  };
}

async function handleMedicalDocumentAnalysis(request, response) {
  try {
    await resolveRequestUserContext(request);
    const payload = await readJsonBody(request);
    const fileName = payload?.file?.name || payload?.image?.name || "";
    const fileMimeType = payload?.file?.type || payload?.image?.type || "";
    const documentPayload = sanitizeMedicalDocumentDataUrl(payload?.file?.dataUrl || payload?.image?.dataUrl || payload?.imageDataUrl, {
      fileName,
      mimeType: fileMimeType,
    });
    const messages = documentPayload.isImage
      ? buildMedicalDocumentAnalysisMessages(documentPayload.dataUrl)
      : buildMedicalDocumentTextAnalysisMessages(extractMedicalDocumentText(documentPayload), fileName);
    let completion;

    try {
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1100,
        responseFormat: { type: "json_object" },
        temperature: 0.05,
      });
    } catch (error) {
      if (!isAzureResponseFormatUnsupported(error)) {
        throw error;
      }

      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1100,
        temperature: 0.05,
      });
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    const analysis = normalizeMedicalDocumentAnalysisPayload(parsedPayload);

    sendJson(response, 200, {
      analysis,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    const statusCode =
      error.message === "Formato documento non valido." ||
      error.message?.startsWith("Formato non supportato") ||
      error.message?.startsWith("Documento troppo grande") ||
      error.message?.includes("senza testo leggibile")
        ? 400
        : error.statusCode || 502;
    console.error("[Server] Errore analisi documento medico.", azureError || error.message);
    sendJson(response, statusCode, {
      error: azureError || error.message || "Impossibile leggere il documento medico.",
    });
  }
}

const PANTRY_IMPORT_SOURCE_LABELS = Object.freeze({
  photo: "foto di prodotti alimentari, scontrino, spesa o frigorifero",
  receipt: "foto di uno scontrino della spesa",
  "fridge-shopping": "foto di frigorifero, dispensa o prodotti della spesa",
});

const PANTRY_IMPORT_CATEGORIES = Object.freeze([
  "Frutta e verdura",
  "Latticini",
  "Carne e pesce",
  "Cereali",
  "Dispensa",
  "Surgelati",
  "Bevande",
]);

function normalizePantryImportCategory(value) {
  const category = String(value || "").trim();
  return PANTRY_IMPORT_CATEGORIES.includes(category) ? category : "Dispensa";
}

function normalizePantryImportSourceType(value) {
  const sourceType = String(value || "").trim();
  return PANTRY_IMPORT_SOURCE_LABELS[sourceType] ? sourceType : "photo";
}

function normalizePantryImportConfidence(value) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return null;
  }

  return Math.max(0, Math.min(1, confidence));
}

function normalizePantryImportItems(payload) {
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];

  return rawItems
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quantity: String(item?.quantity || "1 confezione").trim() || "1 confezione",
      category: normalizePantryImportCategory(item?.category),
      expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item?.expiryDate || "")) ? String(item.expiryDate) : "",
      barcode: sanitizeBarcode(item?.barcode),
      confidence: normalizePantryImportConfidence(item?.confidence),
    }))
    .filter((item) => item.name)
    .slice(0, 40);
}

function normalizeGeneratedGroceryListItems(payload) {
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];

  return rawItems
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quantity: String(item?.quantity || "1 confezione").trim() || "1 confezione",
      category: normalizePantryImportCategory(item?.category),
      expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item?.expiryDate || "")) ? String(item.expiryDate) : "",
      barcode: sanitizeBarcode(item?.barcode),
      reason: String(item?.reason || "").trim(),
    }))
    .filter((item) => item.name)
    .slice(0, 18);
}

function buildGroceryListGenerationMessages(context) {
  const contextMessage = [
    stringifyContextBlock("Dispensa attuale", context.pantry),
    stringifyContextBlock("Lista della spesa corrente", context.groceryItems),
    stringifyContextBlock("Profilo, preferenze e condizioni mediche", context.profile),
    stringifyContextBlock("Pasti recenti", context.recentMeals),
    stringifyContextBlock("Ricetta corrente", context.currentRecipe),
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "system",
      content:
        "Sei un assistente nutrizionale per una web app di gestione dispensa e meal planning. Devi generare una lista della spesa concreta, prudente e personalizzata. Rispetta allergie, condizioni mediche, preferenze alimentari e obiettivi nutrizionali. Usa la dispensa come fonte attendibile: non suggerire prodotti gia presenti in quantita plausibilmente sufficiente, salvo piccoli complementi necessari. Evita sprechi: proponi quantita conservative, versatili e realistiche per una spesa breve. Rispondi solo con JSON valido.",
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
      content:
        "Genera una lista della spesa essenziale per integrare quello che manca rispetto alla dispensa e al profilo utente. Preferisci alimenti versatili, salutari e facilmente combinabili con gli ingredienti gia disponibili. Evita duplicati, porzioni eccessive e prodotti incompatibili con allergie, condizioni mediche o preferenze. Restituisci al massimo 12 prodotti. Le categorie ammesse sono: Frutta e verdura, Latticini, Carne e pesce, Cereali, Dispensa, Surgelati, Bevande. Formato JSON richiesto: {\"items\":[{\"name\":\"\",\"quantity\":\"\",\"category\":\"\",\"expiryDate\":\"\",\"barcode\":\"\",\"reason\":\"\"}]}. Lascia expiryDate vuota se non serve.",
    },
  ];
}

function sanitizePantryImportImageDataUrl(value) {
  const dataUrl = String(value || "").trim();

  if (!/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(dataUrl)) {
    throw new Error("Formato immagine non valido.");
  }

  if (dataUrl.length > MAX_JSON_BODY_BYTES - 200_000) {
    throw new Error("Immagine troppo grande. Scatta una foto piu leggera o riprova.");
  }

  return dataUrl.replace(/\s/g, "");
}

function buildPantryImageImportMessages(sourceType, imageDataUrl) {
  const sourceLabel = PANTRY_IMPORT_SOURCE_LABELS[sourceType] || PANTRY_IMPORT_SOURCE_LABELS.photo;

  return [
    {
      role: "system",
      content:
        "Sei un motore di acquisizione dati per una web app nutrizionale. Devi leggere immagini alimentari e restituire solo JSON valido. Non inventare prodotti non visibili. Se un dettaglio e' incerto, usa una quantita generica e confidence bassa. Le categorie ammesse sono: Frutta e verdura, Latticini, Carne e pesce, Cereali, Dispensa, Surgelati, Bevande.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            `Analizza questa immagine (${sourceLabel}) e converti tutti gli alimenti riconoscibili in una proposta per la dispensa. ` +
            "Rispondi con JSON nel formato {\"items\":[{\"name\":\"\",\"quantity\":\"\",\"category\":\"\",\"expiryDate\":\"\",\"barcode\":\"\",\"confidence\":0.0}]}. " +
            "Usa nomi prodotto in italiano, quantita brevi, expiryDate solo se visibile nel formato YYYY-MM-DD, barcode solo se il codice numerico e' leggibile.",
        },
        {
          type: "image_url",
          image_url: {
            url: imageDataUrl,
          },
        },
      ],
    },
  ];
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

async function handlePasswordResetRequest(request, response) {
  try {
    ensureAuthenticatedUserMode();
    const payload = await readJsonBody(request);
    await requestPasswordReset(
      {
        email: payload?.email,
      },
      request
    );

    sendJson(response, 200, {
      ok: true,
      message: "Link inviato alla mail.",
    });
  } catch (error) {
    console.error("[Server] Errore richiesta recupero password.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile inviare il link di recupero password.",
    });
  }
}

async function handlePasswordResetConfirm(request, response) {
  try {
    ensureAuthenticatedUserMode();
    const payload = await readJsonBody(request);
    await confirmPasswordReset({
      token: payload?.token,
      password: payload?.password,
      passwordConfirmation: payload?.passwordConfirmation,
    });

    sendJson(response, 200, {
      ok: true,
      message: "Password aggiornata. Effettua l'accesso con la nuova password.",
    });
  } catch (error) {
    console.error("[Server] Errore conferma recupero password.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile aggiornare la password.",
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
    const userContext = await resolveRequestUserContext(request);
    const nutritrackState = await getNutriTrackState(userContext);
    const context = buildRecipesAssistantContext({
      state: nutritrackState,
      overrides: {
        currentRecipe: body.currentRecipe && typeof body.currentRecipe === "object" ? body.currentRecipe : undefined,
      },
    });
    const intent = classifyRecipeAssistantIntent(message);

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
  let errorPhase = "init";

  try {
    errorPhase = "read-body";
    const body = await readJsonBody(request);
    const filters = sanitizeRecipeGenerationFilters(body.filters && typeof body.filters === "object" ? body.filters : {});
    errorPhase = "resolve-user";
    const userContext = await resolveRequestUserContext(request);
    errorPhase = "read-state";
    const nutritrackState = await getNutriTrackState(userContext);
    errorPhase = "build-context";
    const context = buildRecipesAssistantContext({
      state: nutritrackState,
      overrides: {
        generator: filters,
        currentRecipe: body.currentRecipe && typeof body.currentRecipe === "object" ? body.currentRecipe : undefined,
      },
    });

    errorPhase = "azure-completion";
    const generationMessages = buildRecipeGenerationMessages(filters, context);
    let completion;

    try {
      completion = await createAzureChatCompletion(generationMessages, {
        maxTokens: 1024,
        responseFormat: { type: "json_object" },
      });
    } catch (error) {
      if (!isAzureResponseFormatUnsupported(error)) {
        throw error;
      }

      console.warn("[Server] Generazione ricetta: response_format non supportato, riprovo senza JSON mode.", {
        azureCode: error.details?.error?.code || "",
        message: error.details?.error?.message || error.message,
      });
      completion = await createAzureChatCompletion(generationMessages, {
        maxTokens: 1024,
      });
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    errorPhase = "parse-json";
    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    errorPhase = "normalize-recipe";
    const recipe = normalizeGeneratedRecipePayload(parsedPayload, filters, context);
    errorPhase = "send-response";
    sendJson(response, 200, {
      recipe,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    const statusCode = error.statusCode || (azureError ? 502 : 500);
    console.error("[Server] Errore nella route /api/recipes/generate.", {
      phase: errorPhase,
      statusCode,
      azureStatusCode: error.statusCode || null,
      azureStatusText: error.statusText || "",
      azureCode: error.details?.error?.code || "",
      message: azureError || error.message,
    });
    sendJson(response, statusCode, {
      error: azureError || error.message || "Errore interno del server.",
      phase: errorPhase,
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

async function handleOpenFoodFactsProduct(urlPath, response) {
  try {
    const barcode = sanitizeBarcode(urlPath.split("/").pop());

    if (!barcode) {
      sendJson(response, 400, { error: "Barcode non valido." });
      return;
    }

    const result = await fetchOpenFoodFactsProduct(barcode);
    sendJson(response, 200, result);
  } catch (error) {
    const message = error.message || "Errore durante il recupero da OpenFoodFacts.";
    const statusCode = message === "Prodotto non trovato in OpenFoodFacts." ? 404 : 502;
    console.error("[Server] Errore nella route OpenFoodFacts.", message);
    sendJson(response, statusCode, { error: message });
  }
}

async function handleGroceryListGenerate(request, response) {
  let errorPhase = "init";

  try {
    errorPhase = "read-body";
    const payload = await readJsonBody(request);
    errorPhase = "resolve-user";
    const userContext = await resolveRequestUserContext(request);
    errorPhase = "read-state";
    const savedState = await getNutriTrackState(userContext);
    const requestedState = payload?.state && typeof payload.state === "object" ? payload.state : null;
    errorPhase = "build-context";
    const context = buildRecipesAssistantContext({
      state: requestedState || savedState,
    });

    errorPhase = "azure-completion";
    const messages = buildGroceryListGenerationMessages(context);
    let completion;

    try {
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1000,
        responseFormat: { type: "json_object" },
        temperature: 0.25,
      });
    } catch (error) {
      if (!isAzureResponseFormatUnsupported(error)) {
        throw error;
      }

      console.warn("[Server] Generazione lista spesa: response_format non supportato, riprovo senza JSON mode.", {
        azureCode: error.details?.error?.code || "",
        message: error.details?.error?.message || error.message,
      });
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1000,
        temperature: 0.25,
      });
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    errorPhase = "parse-json";
    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    errorPhase = "normalize-items";
    const items = normalizeGeneratedGroceryListItems(parsedPayload);

    sendJson(response, 200, {
      items,
      usage: completion.usage || null,
    });
  } catch (error) {
    const azureError = error.details?.error?.message;
    const statusCode = error.statusCode || (azureError ? 502 : 500);
    console.error("[Server] Errore nella route /api/grocery/generate-list.", {
      phase: errorPhase,
      statusCode,
      azureStatusCode: error.statusCode || null,
      azureStatusText: error.statusText || "",
      azureCode: error.details?.error?.code || "",
      message: azureError || error.message,
    });
    sendJson(response, statusCode, {
      error: azureError || error.message || "Impossibile generare la lista della spesa.",
      phase: errorPhase,
    });
  }
}

async function handlePantryImageImport(request, response) {
  try {
    await resolveRequestUserContext(request);
    const payload = await readJsonBody(request);
    const sourceType = normalizePantryImportSourceType(payload?.sourceType);
    const imageDataUrl = sanitizePantryImportImageDataUrl(payload?.image?.dataUrl || payload?.imageDataUrl);
    const messages = buildPantryImageImportMessages(sourceType, imageDataUrl);
    let completion;

    try {
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1200,
        responseFormat: { type: "json_object" },
        temperature: 0.1,
      });
    } catch (error) {
      if (!isAzureResponseFormatUnsupported(error)) {
        throw error;
      }

      console.warn("[Server] Import dispensa: response_format non supportato, riprovo senza JSON mode.", {
        azureCode: error.details?.error?.code || "",
        message: error.details?.error?.message || error.message,
      });
      completion = await createAzureChatCompletion(messages, {
        maxTokens: 1200,
        temperature: 0.1,
      });
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
      sendJson(response, 502, { error: "Risposta Azure OpenAI non valida." });
      return;
    }

    const parsedPayload = parseJsonObjectFromCompletion(rawContent);
    const items = normalizePantryImportItems(parsedPayload);

    sendJson(response, 200, {
      sourceType,
      items,
    });
  } catch (error) {
    console.error("[Server] Errore import immagine dispensa.", error);
    sendJson(response, error.statusCode || (error.message === "Formato immagine non valido." ? 400 : 502), {
      error: error.message || "Impossibile convertire la foto in prodotti.",
    });
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

async function handleScaleClientMeasurement(request, response) {
  try {
    const userContext = await resolveRequestUserContext(request);
    const payload = await readJsonBody(request);
    const currentConnection = await readScaleConnection(userContext);
    const nextConnection = await recordClientScaleMeasurement(userContext, currentConnection, payload);

    sendJson(response, 200, {
      ok: true,
      scale: buildPublicScaleState(nextConnection),
    });
  } catch (error) {
    console.error("[Server] Errore registrazione misura bilancia client.", error);
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Impossibile registrare la misura della bilancia.",
    });
  }
}

const requestHandler = async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const routedRequest = resolveRequestPath(requestUrl.pathname);
  const requestPath = routedRequest.path;

  if (request.method === "GET" && APP_BASE_PATH && requestUrl.pathname === APP_BASE_PATH) {
    response.writeHead(308, {
      Location: `${APP_BASE_PATH}/`,
    });
    response.end();
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && requestPath === "/api/auth/session") {
    await handleAuthSessionRead(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/auth/register") {
    await handleAuthRegister(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/auth/login") {
    await handleAuthLogin(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/auth/logout") {
    await handleAuthLogout(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/auth/password-reset/request") {
    await handlePasswordResetRequest(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/auth/password-reset/confirm") {
    await handlePasswordResetConfirm(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/recipes/assistant/chat") {
    await handleRecipesAssistantChat(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/recipes/generate") {
    await handleApiRecipeGenerate(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/recipes/apply-to-diet") {
    await handleApplyRecipeToDiet(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/nutrition/analyze-meal") {
    await handleMealNutritionAnalysis(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/nutrition/describe-meal-image") {
    await handleMealPhotoDescription(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/profile/analyze-medical-document") {
    await handleMedicalDocumentAnalysis(request, response);
    return;
  }

  if (request.method === "GET" && requestPath === "/api/nutritrack/state") {
    await handleNutriTrackStateRead(request, response);
    return;
  }

  if (request.method === "PUT" && requestPath === "/api/nutritrack/state") {
    await handleNutriTrackStateWrite(request, response);
    return;
  }

  if (request.method === "GET" && requestPath === "/api/database/status") {
    handleDatabaseStatus(response);
    return;
  }

  if (request.method === "GET" && requestPath === "/api/devices/state") {
    await handleDevicesStateRead(request, response);
    return;
  }

  if (request.method === "GET" && requestPath === "/api/scale/status") {
    await handleScaleStatus(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/scale/connect") {
    await handleScaleConnect(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/scale/sync") {
    await handleScaleSync(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/scale/disconnect") {
    await handleScaleDisconnect(request, response);
    return;
  }

  if (request.method === "PUT" && requestPath === "/api/scale/permissions") {
    await handleScalePermissionsUpdate(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/scale/client-measurement") {
    await handleScaleClientMeasurement(request, response);
    return;
  }

  if (request.method === "GET" && requestPath.startsWith("/api/openfoodfacts/product/")) {
    await handleOpenFoodFactsProduct(requestPath, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/grocery/generate-list") {
    await handleGroceryListGenerate(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/grocery/import-image") {
    await handlePantryImageImport(request, response);
    return;
  }

  if (request.method === "GET") {
    const staticPath = resolveStaticPath(requestPath);

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
  const displayPath = APP_BASE_PATH || "/";
  const urls = [`${protocol}://localhost:${PORT}${displayPath}`];

  if (HOST !== "0.0.0.0") {
    urls.unshift(`${protocol}://${HOST}:${PORT}${displayPath}`);
    return urls;
  }

  const interfaces = os.networkInterfaces();
  const seen = new Set(urls);

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        return;
      }

      const candidate = `${protocol}://${entry.address}:${PORT}${displayPath}`;

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
