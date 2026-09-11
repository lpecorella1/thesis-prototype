// Recipe lookup and local state helpers.
const buildRecipesApiPath = window.NutriTrackBootstrap.buildNutriTrackApiPath;

function getRecipeById(recipeId) {
  if (!recipeId) {
    return null;
  }

  if (appState.recipes?.generatedRecipesById?.[recipeId]) {
    return appState.recipes.generatedRecipesById[recipeId];
  }

  if (appState.recipes?.currentRecipe?.id === recipeId) {
    return appState.recipes.currentRecipe;
  }

  return null;
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

function getRecipeMealLabel(value) {
  const labels = {
    breakfast: "Colazione",
    lunch: "Pranzo",
    dinner: "Cena",
    snack: "Snack",
  };

  return labels[value] || value;
}

async function generateRecipeWithAi(filters) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(buildRecipesApiPath("/api/recipes/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters }),
      signal: controller.signal,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Generazione ricetta non disponibile.");
    }

    if (!payload.recipe || typeof payload.recipe !== "object") {
      throw new Error("La risposta del backend non contiene una ricetta valida.");
    }

    registerRecipe(payload.recipe);
    return payload.recipe;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La generazione della ricetta ha impiegato troppo tempo.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function saveRecipeToHistory(recipe) {
  registerRecipe(recipe);
  appState.recipes.generatedRecipesById[recipe.id]._nutritrackHistoryVisible = true;
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

async function getRecipeAssistantResponse(message) {
  const history = appState.recipes.chatMessages.slice(-8).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(buildRecipesApiPath("/api/recipes/assistant/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
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

    return payload;
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
      </article>
    `;
    return;
  }

  const isSaved = appState.recipes.savedRecipeIds.includes(recipe.id);

  container.innerHTML = `
    <div class="result-head">
      <div>
        <h3>${escapeHtml(recipe.title)}</h3>
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
    <p class="recipe-apply-feedback" data-recipe-apply-feedback aria-live="polite"></p>
    <div class="macro-pill-row">
      <span>Proteine ${recipe.protein}g</span>
      <span>Carboidrati ${recipe.carbs}g</span>
      <span>Grassi ${recipe.fats}g</span>
      <span>Generata ${escapeHtml(formatDateTime(recipe.generatedAt))}</span>
    </div>
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

function renderRecipeGenerationError(error) {
  const container = document.querySelector("[data-recipe-result]");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <article class="empty-state">
      <h3>Generazione non riuscita</h3>
      <p>${escapeHtml(error?.message || "Il generatore AI non ha restituito una ricetta valida.")}</p>
    </article>
  `;
}

function renderRecipeHistory() {
  const container = document.querySelector("[data-recipe-history]");
  const clearButton = document.querySelector("[data-clear-recipe-history]");

  if (!container) {
    return;
  }

  if (clearButton) {
    clearButton.disabled = appState.recipes.history.length === 0;
    clearButton.setAttribute(
      "aria-label",
      appState.recipes.history.length === 0
        ? "Storico generazioni gia vuoto"
        : "Svuota storico generazioni"
    );
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

async function clearRecipeHistory() {
  if (appState.recipes.history.length === 0) {
    return;
  }

  const shouldClear = window.confirm(
    "Vuoi eliminare le ricette presenti nello storico generazioni? Le ricette salvate resteranno disponibili."
  );

  if (!shouldClear) {
    return;
  }

  const historyRecipeIds = new Set(
    appState.recipes.history.map((entry) => entry.id).filter(Boolean)
  );
  const savedRecipeIds = new Set(appState.recipes.savedRecipeIds);

  ensureGeneratedRecipeStore();
  Object.keys(appState.recipes.generatedRecipesById).forEach((recipeId) => {
    if (!historyRecipeIds.has(recipeId)) {
      return;
    }

    if (savedRecipeIds.has(recipeId)) {
      appState.recipes.generatedRecipesById[recipeId]._nutritrackHistoryVisible = false;
      return;
    }

    delete appState.recipes.generatedRecipesById[recipeId];
  });

  if (appState.recipes.currentRecipe && historyRecipeIds.has(appState.recipes.currentRecipe.id)) {
    if (savedRecipeIds.has(appState.recipes.currentRecipe.id)) {
      appState.recipes.currentRecipe._nutritrackHistoryVisible = false;
    } else {
      appState.recipes.currentRecipe = null;
    }
  }

  appState.recipes.history = [];

  try {
    await saveRecipesStateToServer();
    renderRecipes();
  } catch (error) {
    console.error("Impossibile cancellare la cronologia ricette.", error);
  }
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

// Recipe to nutrition integration helpers.
function getSuggestedMealTime(mealType) {
  const defaults = {
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "20:00",
    snack: "16:30",
  };

  return defaults[mealType] || "";
}

function inferRecipeMealType(recipe) {
  return appState.recipes.generator.mealType || recipe?.mealTypes?.[0] || "lunch";
}

function setRecipeApplyFeedback(message, tone = "neutral") {
  const feedback = document.querySelector("[data-recipe-apply-feedback]");

  if (!feedback) {
    return;
  }

  feedback.textContent = message || "";
  feedback.classList.toggle("is-error", tone === "error");
  feedback.classList.toggle("is-success", tone === "success");
}

function syncNutriTrackStateFromBackend(nextState) {
  if (!nextState) {
    return;
  }

  const normalizedState = normalizeNutriTrackState(nextState);
  Object.keys(appState).forEach((key) => {
    delete appState[key];
  });
  Object.assign(appState, normalizedState);
  saveNutriTrackStateToLocalCache();
}

async function executeRecipeAssistantAction(action) {
  if (!action) {
    return null;
  }

  if (action.type === "apply_current_recipe_to_diet") {
    const recipe = appState.recipes.currentRecipe;

    if (!recipe) {
      return {
        success: false,
        message: "Non ho una ricetta attiva da usare.\n\nGenerane o aprine una nella sezione Alimenti e poi chiedimi di aggiungerla alla Dieta.",
      };
    }

    const mealType = action.mealType || inferRecipeMealType(recipe);
    const payload = await applyRecipeToNutrition(recipe, mealType);
    const addedMeal = payload?.meal;
    const pantryUpdates = Array.isArray(payload?.pantryUpdates) ? payload.pantryUpdates : [];

    const pantrySummary =
      pantryUpdates.length > 0
        ? pantryUpdates
            .map((entry) => `- **${entry.pantryItemName}** -> ${entry.removed ? "esaurito" : `restano ${entry.nextQuantity}`}`)
            .join("\n")
        : "";

    return {
      success: true,
      message:
        `Ho aggiunto **${addedMeal.name}** ai pasti di oggi in **Dieta**.\n\n` +
        `- Orario impostato: ${formatMealTime(addedMeal.time)}\n` +
        `- Calorie: **${addedMeal.calories} kcal**\n` +
        `- Proteine: **${addedMeal.protein} g**` +
        (pantrySummary ? `\n\n---\n\n**Aggiornamento dispensa**\n${pantrySummary}` : ""),
    };
  }

  return null;
}

function applyRecipeToNutrition(recipe, mealType) {
  const form = document.querySelector("[data-nutrition-form]");

  if (!form || !recipe) {
    return Promise.resolve(null);
  }

  return fetch(buildRecipesApiPath("/api/recipes/apply-to-diet"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipe,
      mealType,
    }),
  })
    .then(async (response) => {
      const payload = await response.json();

      if (!response.ok || !payload?.state) {
        const error = new Error(payload?.error || "Non sono riuscito ad applicare la ricetta alla dieta.");
        error.status = response.status;
        throw error;
      }

      rememberNutriTrackServerRevision(payload);
      syncNutriTrackStateFromBackend(payload.state);
      const appliedMealDateKey = getMealDateKey(payload.meal);

      if (appliedMealDateKey) {
        captureProgressSnapshotForDate(appliedMealDateKey);
      }

      clearNutritionDraft();
      resetFormValidationState(form);
      await saveProgressStateToServer({ selectedRange: false });
      switchToTab("nutrition");
      renderNutrition();
      renderGrocery();
      renderProgress();
      setRecipeApplyFeedback(`Ricetta aggiunta alla Dieta: ${payload.meal?.name || recipe.title}.`, "success");

      return payload;
    });
}

// Shared UI state helpers for reopening recipes and updating chat state.
function setCurrentRecipeWithContext(recipe, pantryFallbackNote, personalFallbackNote) {
  if (!recipe) {
    return false;
  }

  appState.recipes.currentRecipe = {
    ...recipe,
    pantryMatches: Array.isArray(recipe.pantryMatches) ? recipe.pantryMatches : [],
    pantryNote: recipe.pantryNote || pantryFallbackNote,
    personalNote: recipe.personalNote || personalFallbackNote,
  };

  return true;
}

async function restoreRecipeFromCollection(recipeId, pantryFallbackNote, personalFallbackNote) {
  const recipe = getRecipeById(recipeId);

  if (!setCurrentRecipeWithContext(recipe, pantryFallbackNote, personalFallbackNote)) {
    return;
  }

  try {
    await saveRecipesStateToServer();
    renderRecipes();
  } catch (error) {
    console.error("Impossibile aprire la ricetta.", error);
  }
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

function setRecipeGeneratorPendingState(generatorForm, isWaiting) {
  const submitButton = generatorForm.querySelector('button[type="submit"]');

  Array.from(generatorForm.elements).forEach((field) => {
    if (field instanceof HTMLElement) {
      field.disabled = isWaiting;
    }
  });

  if (submitButton) {
    submitButton.textContent = isWaiting ? "Sto generando..." : "Genera ricetta";
  }
}

// Event binding for the generator form and current recipe actions.
function setupRecipeGeneratorForm(generatorForm) {
  generatorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nextFilters = {
      dietType: generatorForm.elements.dietType.value,
      caloriesTarget: generatorForm.elements.caloriesTarget.value,
      mealType: generatorForm.elements.mealType.value,
      prompt: String(generatorForm.elements.prompt.value || "").trim(),
    };

    appState.recipes.generator = nextFilters;
    setRecipeGeneratorPendingState(generatorForm, true);

    try {
      appState.recipes.currentRecipe = await generateRecipeWithAi(nextFilters);
      saveRecipeToHistory(appState.recipes.currentRecipe);
      await saveRecipesStateToServer();
      renderRecipes();
    } catch (error) {
      renderRecipeGenerationError(error);
    } finally {
      setRecipeGeneratorPendingState(generatorForm, false);
    }
  });
}

function setupRecipeResultActions(recipeResult) {
  recipeResult.addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-current-recipe]");
    const applyButton = event.target.closest("[data-apply-current-recipe-to-nutrition]");

    if (applyButton && appState.recipes.currentRecipe) {
      applyButton.disabled = true;
      applyButton.textContent = "Aggiungo...";
      setRecipeApplyFeedback("Sto aggiungendo la ricetta alla Dieta.");

      try {
        await applyRecipeToNutrition(appState.recipes.currentRecipe, appState.recipes.generator.mealType);
      } catch (error) {
        if (error?.status === 401) {
          window.handleNutriTrackUnauthorized?.();
        }

        setRecipeApplyFeedback(
          error?.message || "Non sono riuscito ad aggiungere la ricetta alla Dieta.",
          "error"
        );
      } finally {
        applyButton.disabled = false;
        applyButton.textContent = "Usa nella dieta";
      }
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

    try {
      await saveRecipesStateToServer();
      renderRecipes();
    } catch (error) {
      console.error("Impossibile salvare la ricetta.", error);
    }
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
      "Ricetta recuperata dallo storico delle generazioni."
    );
  });
}

function setupRecipeHistoryClearAction(clearButton) {
  clearButton?.addEventListener("click", clearRecipeHistory);
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
      "Ricetta recuperata dall'elenco salvati."
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

  await saveRecipesStateToServer();
  renderRecipeChat();
  chatForm.elements.message.value = "";
  setRecipeChatPendingState(chatForm, true);

  try {
    const assistantPayload = await getRecipeAssistantResponse(message);
    const actionResult = await executeRecipeAssistantAction(assistantPayload.action);
    const finalReply = actionResult?.message || assistantPayload.reply;

    appendRecipeChatMessage("assistant", finalReply);
    await saveRecipesStateToServer();
    renderRecipeChat();
    chatForm.reset();
  } catch (error) {
    appendRecipeChatMessage(
      "assistant",
      "Non riesco a rispondere in questo momento dal backend AI. Riprova tra poco."
    );
    await saveRecipesStateToServer();
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

  chatResetButton?.addEventListener("click", async () => {
    appState.recipes.chatMessages = [];
    try {
      await saveRecipesStateToServer();
      renderRecipeChat();
    } catch (error) {
      console.error("Impossibile cancellare la chat ricette.", error);
    }
  });
}

// Recipes section wiring.
function setupRecipesSection() {
  const generatorForm = document.querySelector("[data-recipe-generator-form]");
  const recipeResult = document.querySelector("[data-recipe-result]");
  const recipeHistory = document.querySelector("[data-recipe-history]");
  const clearHistoryButton = document.querySelector("[data-clear-recipe-history]");
  const savedRecipes = document.querySelector("[data-saved-recipes]");
  const chatForm = document.querySelector("[data-recipe-chat-form]");
  const chatResetButton = document.querySelector("[data-recipe-chat-reset]");

  if (!generatorForm || !recipeResult || !recipeHistory || !savedRecipes || !chatForm) {
    return;
  }

  setupRecipeGeneratorForm(generatorForm);
  setupRecipeResultActions(recipeResult);
  setupRecipeHistoryActions(recipeHistory);
  setupRecipeHistoryClearAction(clearHistoryButton);
  setupSavedRecipeActions(savedRecipes);
  setupRecipeChat(chatForm, chatResetButton);
  renderRecipes();
}

setupRecipesSection();
