function normalizeNutriTrackState(parsedState) {
  if (!parsedState || typeof parsedState !== "object") {
    return structuredClone(defaultState);
  }

  const parsedMeals = Array.isArray(parsedState.nutrition?.meals)
    ? parsedState.nutrition.meals.map(normalizeNutritionMeal)
    : structuredClone(defaultState.nutrition.meals).map(normalizeNutritionMeal);
  const parsedDailyLogs = Array.isArray(parsedState.progress?.dailyLogs)
    ? parsedState.progress.dailyLogs.map(normalizeProgressLog).filter(Boolean)
    : structuredClone(defaultState.progress.dailyLogs);
  const parsedAutoSnapshots = normalizeProgressSnapshots(parsedState.progress?.autoSnapshots);

  return {
    ...structuredClone(defaultState),
    ...parsedState,
    nutrition: {
      ...structuredClone(defaultState.nutrition),
      ...(parsedState.nutrition || {}),
      selectedDate: isValidDateKey(parsedState.nutrition?.selectedDate)
        ? parsedState.nutrition.selectedDate
        : getTodayDateKey(),
      meals: parsedMeals,
    },
    recipes: {
      ...structuredClone(defaultState.recipes),
      ...(parsedState.recipes || {}),
      generator: {
        ...structuredClone(defaultState.recipes.generator),
        ...((parsedState.recipes && parsedState.recipes.generator) || {}),
      },
      currentRecipe: parsedState.recipes?.currentRecipe
        ? {
            ...(defaultState.recipes.currentRecipe ? structuredClone(defaultState.recipes.currentRecipe) : {}),
            ...parsedState.recipes.currentRecipe,
          }
        : structuredClone(defaultState.recipes.currentRecipe),
      history: Array.isArray(parsedState.recipes?.history)
        ? parsedState.recipes.history
        : structuredClone(defaultState.recipes.history),
      savedRecipeIds: Array.isArray(parsedState.recipes?.savedRecipeIds)
        ? parsedState.recipes.savedRecipeIds
        : structuredClone(defaultState.recipes.savedRecipeIds),
      generatedRecipesById:
        parsedState.recipes?.generatedRecipesById && typeof parsedState.recipes.generatedRecipesById === "object"
          ? parsedState.recipes.generatedRecipesById
          : structuredClone(defaultState.recipes.generatedRecipesById),
      chatMessages: Array.isArray(parsedState.recipes?.chatMessages)
        ? parsedState.recipes.chatMessages
        : structuredClone(defaultState.recipes.chatMessages),
    },
    grocery: {
      ...structuredClone(defaultState.grocery),
      ...(parsedState.grocery || {}),
      items: Array.isArray(parsedState.grocery?.items)
        ? parsedState.grocery.items.map(normalizeGroceryItem)
        : structuredClone(defaultState.grocery.items),
      pantry: Array.isArray(parsedState.grocery?.pantry)
        ? parsedState.grocery.pantry.map(normalizeGroceryItem)
        : structuredClone(defaultState.grocery.pantry),
      ar: {
        ...structuredClone(defaultState.grocery.ar),
        ...((parsedState.grocery && parsedState.grocery.ar) || {}),
        pinnedProductIds: [],
        lastDetectedBarcode: "",
      },
    },
    datasets: {
      ...structuredClone(defaultState.datasets),
      ...(parsedState.datasets || {}),
      openFoodFacts: {
        ...structuredClone(defaultState.datasets.openFoodFacts),
        ...((parsedState.datasets && parsedState.datasets.openFoodFacts) || {}),
        source: {
          ...structuredClone(defaultState.datasets.openFoodFacts.source),
          ...((parsedState.datasets?.openFoodFacts && parsedState.datasets.openFoodFacts.source) || {}),
        },
        productsByBarcode:
          parsedState.datasets?.openFoodFacts?.productsByBarcode &&
          typeof parsedState.datasets.openFoodFacts.productsByBarcode === "object"
            ? parsedState.datasets.openFoodFacts.productsByBarcode
            : structuredClone(defaultState.datasets.openFoodFacts.productsByBarcode),
      },
    },
    progress: {
      ...structuredClone(defaultState.progress),
      ...(parsedState.progress || {}),
      dailyLogs: parsedDailyLogs,
      autoSnapshots: parsedAutoSnapshots,
    },
    profile: {
      ...structuredClone(defaultState.profile),
      ...(parsedState.profile || {}),
      personal: {
        ...structuredClone(defaultState.profile.personal),
        ...((parsedState.profile && parsedState.profile.personal) || {}),
      },
      medical: {
        ...structuredClone(defaultState.profile.medical),
        ...((parsedState.profile && parsedState.profile.medical) || {}),
        labMetrics: Array.isArray(parsedState.profile?.medical?.labMetrics)
          ? parsedState.profile.medical.labMetrics
          : structuredClone(defaultState.profile.medical.labMetrics),
      },
      goals: {
        ...structuredClone(defaultState.profile.goals),
        ...((parsedState.profile && parsedState.profile.goals) || {}),
      },
    },
    devices: normalizeDevicesState(parsedState.devices),
  };
}

function buildPersistableNutriTrackState(state) {
  if (!state || typeof state !== "object") {
    return structuredClone(defaultState);
  }

  return {
    ...state,
    devices: {
      ...getPersistedDevicesUiState(state.devices),
    },
  };
}

function buildServerNutriTrackState(state) {
  const persistableState = buildPersistableNutriTrackState(state);
  const { devices, ...serverState } = persistableState;
  const groceryState = persistableState.grocery && typeof persistableState.grocery === "object"
    ? { ...persistableState.grocery }
    : {};
  const openFoodFactsState = persistableState.datasets?.openFoodFacts || {};

  delete groceryState.ar;

  return {
    ...serverState,
    grocery: groceryState,
    datasets: {
      ...(persistableState.datasets && typeof persistableState.datasets === "object" ? persistableState.datasets : {}),
      openFoodFacts: {
        productsByBarcode:
          openFoodFactsState.productsByBarcode && typeof openFoodFactsState.productsByBarcode === "object"
            ? openFoodFactsState.productsByBarcode
            : {},
      },
    },
  };
}

function loadNutriTrackStateFromLocalCache() {
  try {
    const savedState = localStorage.getItem(NUTRITRACK_LOCAL_STATE_CACHE_KEY);

    if (!savedState) {
      return structuredClone(defaultState);
    }

    return normalizeNutriTrackState(JSON.parse(savedState));
  } catch (error) {
    console.warn("Unable to load saved state, using defaults.", error);
    return structuredClone(defaultState);
  }
}

function saveNutriTrackStateToLocalCache() {
  localStorage.setItem(
    NUTRITRACK_LOCAL_STATE_CACHE_KEY,
    JSON.stringify(buildPersistableNutriTrackState(appState))
  );
}

function replaceNutriTrackState(nextState) {
  const normalizedState = normalizeNutriTrackState(nextState);
  Object.keys(appState).forEach((key) => {
    delete appState[key];
  });
  Object.assign(appState, normalizedState);
  saveNutriTrackStateToLocalCache();
  renderNutriTrackState();
}

function renderNutriTrackState() {
  renderNutrition();
  renderGrocery();
  renderProgress();
  renderDevices();
  renderProfile();
}

async function persistNutriTrackStateToApi() {
  if (nutritrackSyncRuntime.isSaving) {
    nutritrackSyncRuntime.hasPendingWrite = true;
    return;
  }

  nutritrackSyncRuntime.isSaving = true;

  try {
    const response = await fetch(NUTRITRACK_STATE_API_PATH, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: buildServerNutriTrackState(appState) }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.handleNutriTrackUnauthorized?.();
      }
      throw new Error(`Salvataggio NutriTrack fallito (${response.status}).`);
    }
  } catch (error) {
    console.warn("Unable to persist NutriTrack state to API.", error);
  } finally {
    nutritrackSyncRuntime.isSaving = false;

    if (nutritrackSyncRuntime.hasPendingWrite) {
      nutritrackSyncRuntime.hasPendingWrite = false;
      queueNutriTrackStateSync();
    }
  }
}

function queueNutriTrackStateSync() {
  if (nutritrackSyncRuntime.saveTimeoutId) {
    clearTimeout(nutritrackSyncRuntime.saveTimeoutId);
  }

  nutritrackSyncRuntime.saveTimeoutId = window.setTimeout(() => {
    nutritrackSyncRuntime.saveTimeoutId = null;
    persistNutriTrackStateToApi();
  }, NUTRITRACK_SYNC_DEBOUNCE_MS);
}

async function hydrateNutriTrackStateFromApi() {
  if (nutritrackSyncRuntime.hydrationStarted) {
    return;
  }

  nutritrackSyncRuntime.hydrationStarted = true;
  nutritrackSyncRuntime.isHydrating = true;

  try {
    const response = await fetch(NUTRITRACK_STATE_API_PATH, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.handleNutriTrackUnauthorized?.();
      }
      throw new Error(`Hydration NutriTrack fallita (${response.status}).`);
    }

    const payload = await response.json();

    if (!payload?.state) {
      if (payload?.runtime?.identityMode === "authenticated_user") {
        replaceNutriTrackState(defaultState);
        return;
      }

      queueNutriTrackStateSync();
      return;
    }

    replaceNutriTrackState(payload.state);
  } catch (error) {
    console.warn("Unable to hydrate NutriTrack state from API.", error);
  } finally {
    nutritrackSyncRuntime.isHydrating = false;
  }
}

function saveState() {
  saveNutriTrackStateToLocalCache();

  if (!nutritrackSyncRuntime.isHydrating) {
    queueNutriTrackStateSync();
  }
}
