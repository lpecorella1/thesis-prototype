require("./backend-env");

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
