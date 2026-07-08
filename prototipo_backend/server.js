const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAzureChatCompletion } = require("./azure-openai");
const { fetchOpenFoodFactsProduct, sanitizeBarcode } = require("./openfoodfacts");
const { getNutriTrackState, saveNutriTrackState } = require("./nutritrack-state/nutritrack-state-repository");

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

function sendJson(response, statusCode, payload) {
  console.log("[Server] Invio risposta JSON.", {
    statusCode,
    keys: payload && typeof payload === "object" ? Object.keys(payload) : []
  });
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
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
    stringifyContextBlock("Profile goals", context.profile),
    stringifyContextBlock("Recipe generator filters", context.generator),
    stringifyContextBlock("Current recipe", context.currentRecipe),
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
        "Sei un assistant culinario e nutrizionale di livello GPT, integrato in un'app reale di meal planning. Rispondi sempre in italiano naturale, competente e utile. Non parlare di limiti tecnici a meno che l'utente lo chieda esplicitamente. Quando proponi ricette o modifiche, sii concreto: ingredienti, quantità approssimative, passaggi essenziali, alternative intelligenti e note nutrizionali sintetiche. Usa sempre il contesto dell'app, qualora disponibile: dispensa, obiettivi nutrizionali, filtri di generazione e ricetta corrente. Se è presente una knowledge base OpenFoodFacts recuperata localmente, usala solo come supporto fattuale per prodotti, alternative e spiegazioni nutrizionali, senza inventare nutrienti mancanti. Se il messaggio dell'utente è ambiguo, fai al massimo una domanda di chiarimento breve; altrimenti proponi direttamente la soluzione più utile."
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

async function handleApiChat(request, response) {
  try {
    const body = await readJsonBody(request);
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const context = body.context && typeof body.context === "object" ? body.context : {};
    console.log("[Server] Richiesta chat ricevuta.", {
      path: request.url,
      messageLength: message.length,
      historyLength: history.length
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

    sendJson(response, 500, {
      error: azureError || error.message || "Errore interno del server."
    });
  }
}

async function handleNutriTrackStateRead(response) {
  try {
    const state = await getNutriTrackState();
    sendJson(response, 200, { state });
  } catch (error) {
    console.error("[Server] Errore nella lettura dello stato NutriTrack.", error);
    sendJson(response, 500, { error: "Impossibile leggere lo stato NutriTrack." });
  }
}

async function handleNutriTrackStateWrite(request, response) {
  try {
    const payload = await readJsonBody(request);
    const savedState = await saveNutriTrackState(payload?.state);
    sendJson(response, 200, {
      ok: true,
      savedAt: new Date().toISOString(),
      state: savedState,
    });
  } catch (error) {
    console.error("[Server] Errore nel salvataggio dello stato NutriTrack.", error);
    const statusCode = error.message === "Lo stato NutriTrack deve essere un oggetto JSON." ? 400 : 500;
    sendJson(response, statusCode, { error: error.message || "Impossibile salvare lo stato NutriTrack." });
  }
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

  if (request.method === "POST" && requestUrl.pathname === "/api/chat") {
    await handleApiChat(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/nutritrack/state") {
    await handleNutriTrackStateRead(response);
    return;
  }

  if (request.method === "PUT" && requestUrl.pathname === "/api/nutritrack/state") {
    await handleNutriTrackStateWrite(request, response);
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
