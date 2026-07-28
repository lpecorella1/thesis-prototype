require("./backend-env");

const endpoint = String(process.env.AZURE_OPENAI_ENDPOINT || "").trim().replace(/\/+$/, "");
const apiKey = String(process.env.AZURE_OPENAI_API_KEY || "").trim();
const deployment = String(process.env.AZURE_OPENAI_DEPLOYMENT || "").trim();
const apiVersion = String(process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview").trim();

function ensureAzureConfig() {
  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "Config mancante nel file .env. Inserisci AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY e AZURE_OPENAI_DEPLOYMENT."
    );
  }
}

async function createAzureChatCompletion(messages, options = {}) {
  ensureAzureConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const requestBody = {
    messages,
    max_tokens: options.maxTokens || 1600,
    temperature: options.temperature ?? 0.7,
  };

  if (options.responseFormat) {
    requestBody.response_format = options.responseFormat;
  }

  try {
    const response = await fetch(
      `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );

    const responseText = await response.text();
    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = {
        error: {
          message: responseText.slice(0, 500) || "Risposta Azure OpenAI non JSON.",
        },
      };
    }

    if (!response.ok) {
      const error = new Error("Errore Azure OpenAI.");
      error.statusCode = response.status;
      error.statusText = response.statusText;
      error.details = data;
      throw error;
    }

    if (!data || typeof data !== "object") {
      throw new Error("Risposta Azure OpenAI non JSON.");
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
