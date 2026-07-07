const fs = require("fs");
const path = require("path");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const envPath = path.join(__dirname, ".env");
loadEnvFile(envPath);

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";

function ensureAzureConfig() {
  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "Config mancante nel file .env. Inserisci AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY e AZURE_OPENAI_DEPLOYMENT."
    );
  }
}

async function createAzureChatCompletion(messages) {
  ensureAzureConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  console.log("[Azure] Inizio chiamata chat completions.", {
    deployment,
    apiVersion,
    messageCount: Array.isArray(messages) ? messages.length : 0
  });

  try {
    const response = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey
        },
        body: JSON.stringify({
          messages,
          max_tokens: 800,
          temperature: 0.7
        }),
        signal: controller.signal
      }
    );

    const data = await response.json();
    console.log("[Azure] Risposta ricevuta.", {
      ok: response.ok,
      status: response.status,
      hasChoices: Array.isArray(data?.choices),
      usage: data?.usage || null
    });

    if (!response.ok) {
      const error = new Error("Errore Azure OpenAI.");
      error.details = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Timeout dalla chiamata Azure OpenAI.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  createAzureChatCompletion,
  ensureAzureConfig
};
