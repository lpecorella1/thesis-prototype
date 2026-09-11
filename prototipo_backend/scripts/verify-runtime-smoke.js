const { mkdtemp, rm } = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = Number(process.env.NUTRITRACK_SMOKE_PORT || "3011");
const DEFAULT_BASE_PATH =
  process.env.NUTRITRACK_BASE_PATH === undefined ? "/nutritrack" : process.env.NUTRITRACK_BASE_PATH;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${payload.error || text}`);
  }

  return payload;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${text}`);
  }

  return text;
}

function normalizeBasePath(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue === "/") {
    return "";
  }

  return `/${rawValue.replace(/^\/+|\/+$/g, "")}`;
}

function buildApiUrl(baseUrl, path) {
  return `${baseUrl}${normalizeBasePath(DEFAULT_BASE_PATH)}${path}`;
}

function buildAppUrl(baseUrl, path = "/") {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;
  return `${baseUrl}${normalizeBasePath(DEFAULT_BASE_PATH)}${normalizedPath}`;
}

async function waitForServer(baseUrl, timeoutMs = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetchJson(buildApiUrl(baseUrl, "/api/database/status"));
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function main() {
  const tempDataDir = await mkdtemp(path.join(os.tmpdir(), "nutritrack-smoke-"));
  const baseUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  const serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      HOST: DEFAULT_HOST,
      PORT: String(DEFAULT_PORT),
      NUTRITRACK_USE_POSTGRES: "0",
      NUTRITRACK_APP_MODE: "single-user-local",
      NUTRITRACK_ENABLE_DEVELOPMENT_SEED: "0",
      NUTRITRACK_BASE_PATH: DEFAULT_BASE_PATH,
      NUTRITRACK_DATA_DIR: tempDataDir,
      AZURE_OPENAI_ENDPOINT: "",
      AZURE_OPENAI_API_KEY: "",
      AZURE_OPENAI_DEPLOYMENT: "",
      FOODDATA_CENTRAL_API_KEY: "",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);

    const databaseStatusPayload = await fetchJson(buildApiUrl(baseUrl, "/api/database/status"));
    const indexMarkup = await fetchText(buildAppUrl(baseUrl, "/"));
    const bootstrapScript = await fetchText(buildAppUrl(baseUrl, "/scripts/bootstrap.js"));
    const statePayload = await fetchJson(buildApiUrl(baseUrl, "/api/nutritrack/state"));
    const legacyStateWriteResponse = await fetch(buildApiUrl(baseUrl, "/api/nutritrack/state"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: statePayload.revision,
        state: {},
      }),
    });
    const devicesPayload = await fetchJson(buildApiUrl(baseUrl, "/api/devices/state"));
    const mealAnalysisPayload = await fetchJson(buildApiUrl(baseUrl, "/api/nutrition/analyze-meal"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: "80 g pasta e 1 banana",
      }),
    });
    const clientScalePayload = await fetchJson(buildApiUrl(baseUrl, "/api/scale/client-measurement"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        providerMode: "standard_ble",
        device: {
          name: "Smoke Test BLE Scale",
        },
        measurement: {
          weightKg: 72.4,
          bmi: 23.1,
          bodyFatPercent: null,
          measuredAt: "2026-07-25T09:00:00.000Z",
          sourcePayload: {
            flags: 10,
          },
        },
      }),
    });
    const profilePayload = await fetchJson(buildApiUrl(baseUrl, "/api/profile"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: statePayload.revision,
        profile: {
          personal: {
            fullName: "Smoke Profile Atomic",
            age: 38,
            gender: "female",
            heightCm: 168,
            currentWeightKg: 64,
            targetWeightKg: 62,
            activityLevel: "moderate",
            dietType: "balanced",
          },
          medical: {
            allergies: "Nessuna",
            medications: "",
            medicalConditions: "",
            dietaryPreferences: "Mediterranea",
            labMetrics: [
              {
                id: "smoke-metric-1",
                key: "glucose",
                label: "Glicemia",
                value: "92",
                unit: "mg/dL",
                status: "normal",
              },
            ],
          },
          goals: {
            primaryObjective: "weight-maintenance",
            calories: 1900,
            protein: 95,
            carbs: 220,
            fats: 65,
            water: 8,
          },
        },
      }),
    });
    const groceryPayload = await fetchJson(buildApiUrl(baseUrl, "/api/grocery"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: profilePayload.revision,
        grocery: {
          items: [
            {
              id: "smoke-grocery-1",
              name: "Riso",
              quantity: "1 kg",
              category: "Cereali",
              completed: false,
            },
          ],
          pantry: [
            {
              id: "smoke-pantry-1",
              name: "Olio",
              quantity: "1 bottiglia",
              category: "Dispensa",
              expiryDate: "2026-12-31",
            },
          ],
        },
      }),
    });
    const progressPayload = await fetchJson(buildApiUrl(baseUrl, "/api/progress"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: groceryPayload.revision,
        progress: {
          dailyLogs: [
            {
              date: "2026-07-25",
              weightKg: 72.4,
              waterGlasses: 7,
              burnedCalories: 220,
            },
          ],
          autoSnapshots: {
            "2026-07-25": {
              date: "2026-07-25",
              calories: 1800,
              protein: 90,
            },
          },
          selectedRange: "month",
        },
      }),
    });
    const recipesPayload = await fetchJson(buildApiUrl(baseUrl, "/api/recipes/state"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: progressPayload.revision,
        recipes: {
          generator: {
            dietType: "balanced",
            caloriesTarget: "650",
            mealType: "lunch",
            prompt: "smoke",
          },
          currentRecipe: null,
          history: [
            {
              id: "smoke-recipe-1",
              title: "Smoke recipe",
              generatedAt: "2026-07-25T12:00:00.000Z",
              signature: "smoke-recipe-1",
            },
          ],
          savedRecipeIds: ["smoke-recipe-1"],
          generatedRecipesById: {},
          chatMessages: [
            {
              role: "user",
              content: "Ciao",
            },
          ],
        },
      }),
    });
    const createMealPayload = await fetchJson(buildApiUrl(baseUrl, "/api/nutrition/meals"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: recipesPayload.revision,
        meal: {
          id: "smoke-meal-1",
          name: "Smoke meal",
          date: "2026-07-25",
          time: "12:30",
          calories: 420,
          protein: 18,
          carbs: 52,
          fats: 14,
          nutritionSource: "manual",
          nutritionSourceLabel: "Manuale",
          entryMode: "manual",
          entryMethod: "manual-meal-form",
        },
      }),
    });
    const updateMealPayload = await fetchJson(buildApiUrl(baseUrl, "/api/nutrition/meals/smoke-meal-1"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: createMealPayload.revision,
        meal: {
          ...createMealPayload.meal,
          calories: 455,
        },
      }),
    });
    const deleteMealPayload = await fetchJson(buildApiUrl(baseUrl, "/api/nutrition/meals/smoke-meal-1"), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision: updateMealPayload.revision,
      }),
    });

    assert(databaseStatusPayload.database?.mode === "file_only", "Expected file_only mode during smoke test.");
    assert(indexMarkup.includes("window.NUTRITRACK_BASE_PATH"), "Expected prefixed app shell markup.");
    assert(indexMarkup.includes("scripts/auth.js?v="), "Expected cache-busted frontend scripts.");
    assert(bootstrapScript.includes("buildNutriTrackApiPath"), "Expected prefixed frontend bootstrap helper.");
    assert(databaseStatusPayload.runtime?.identityMode === "single_user_local", "Expected single_user_local mode.");
    assert(
      databaseStatusPayload.runtime?.developmentSeedEnabled === false,
      "Development seed should be disabled during smoke test."
    );
    assert(statePayload.runtime?.summary === "single_user_local", "Unexpected runtime summary on state read.");
    assert(devicesPayload.runtime?.usesImplicitLocalUser === true, "Devices payload should expose local-user runtime.");
    assert(mealAnalysisPayload.analysis?.totals?.calories > 0, "Meal analysis fallback did not produce calories.");
    assert(
      ["fallback-standard-portions", "fooddata-central-fallback"].includes(mealAnalysisPayload.analysis?.source),
      "Meal analysis fallback returned an unexpected source."
    );
    assert(clientScalePayload.scale?.providerMode === "standard_ble", "Client scale measurement did not use BLE mode.");
    assert(clientScalePayload.scale?.latestData?.weightKg === 72.4, "Client scale measurement did not persist weight.");
    assert(
      legacyStateWriteResponse.status === 410,
      "Legacy global state write should be disabled."
    );
    assert(profilePayload.profile?.personal?.fullName === "Smoke Profile Atomic", "Profile update did not persist personal data.");
    assert(profilePayload.profile?.goals?.calories === 1900, "Profile update did not persist goals.");
    assert(
      profilePayload.profile?.medical?.labMetrics?.[0]?.id === "smoke-metric-1",
      "Profile update did not persist lab metrics."
    );
    assert(groceryPayload.grocery?.items?.[0]?.id === "smoke-grocery-1", "Grocery update did not persist list item.");
    assert(groceryPayload.grocery?.pantry?.[0]?.id === "smoke-pantry-1", "Grocery update did not persist pantry item.");
    assert(progressPayload.progress?.dailyLogs?.[0]?.waterGlasses === 7, "Progress update did not persist daily log.");
    assert(progressPayload.progress?.selectedRange === "month", "Progress update did not persist selected range.");
    assert(recipesPayload.recipes?.savedRecipeIds?.[0] === "smoke-recipe-1", "Recipes update did not persist saved ids.");
    assert(recipesPayload.recipes?.chatMessages?.[0]?.content === "Ciao", "Recipes update did not persist chat messages.");
    assert(createMealPayload.meal?.id === "smoke-meal-1", "Meal create did not echo stable meal id.");
    assert(
      createMealPayload.state?.nutrition?.meals?.some((meal) => meal.id === "smoke-meal-1"),
      "Meal create did not persist the meal."
    );
    assert(updateMealPayload.meal?.calories === 455, "Meal update did not persist calories.");
    assert(
      !deleteMealPayload.state?.nutrition?.meals?.some((meal) => meal.id === "smoke-meal-1"),
      "Meal delete did not remove the meal."
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          basePath: normalizeBasePath(DEFAULT_BASE_PATH) || "/",
          runtime: databaseStatusPayload.runtime,
          databaseMode: databaseStatusPayload.database?.mode,
        },
        null,
        2
      )
    );
  } finally {
    serverProcess.kill("SIGTERM");
    await rm(tempDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error.message,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
