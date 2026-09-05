function upsertPantryItemFromGrocery(item) {
  const pantryItem = {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    expiryDate: item.expiryDate || "",
    category: item.category,
    barcode: item.barcode || "",
    source: item.source || "manual",
    nutriscoreGrade: item.nutriscoreGrade || "",
    entryMode: item.entryMode || inferUserEntryModeFromSource(item),
    entryMethod: item.entryMethod || resolveUserEntryMethod(item, "manual-grocery-completion"),
  };
  const existingIndex = appState.grocery.pantry.findIndex((entry) => entry.id === item.id);

  if (existingIndex >= 0) {
    appState.grocery.pantry[existingIndex] = pantryItem;
  } else {
    appState.grocery.pantry.push(pantryItem);
  }

  appState.grocery.pantry.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name));
}

function removePantryItem(groceryItemId) {
  appState.grocery.pantry = appState.grocery.pantry.filter((item) => item.id !== groceryItemId);
}

const PANTRY_IMPORT_SOURCE_LABELS = {
  photo: "prodotti",
  receipt: "dello scontrino",
  "fridge-shopping": "frigo/spesa",
};

const PANTRY_IMPORT_CATEGORIES = [
  "Frutta e verdura",
  "Latticini",
  "Carne e pesce",
  "Cereali",
  "Dispensa",
  "Surgelati",
  "Bevande",
];

const pantryImportRuntime = {
  sourceType: "",
  lastFile: null,
  isLoading: false,
  draftItems: [],
};

const pantryListRuntime = {
  isExpanded: false,
};

const groceryListGenerationRuntime = {
  isLoading: false,
};

function normalizePantryImportCategory(value) {
  const category = String(value || "").trim();
  return PANTRY_IMPORT_CATEGORIES.includes(category) ? category : "Dispensa";
}

function normalizePantryImportItem(item) {
  return {
    name: String(item?.name || "").trim(),
    quantity: String(item?.quantity || "1 confezione").trim(),
    expiryDate: String(item?.expiryDate || "").trim(),
    category: normalizePantryImportCategory(item?.category),
    barcode: sanitizeBarcode(item?.barcode),
    confidence: Number.isFinite(Number(item?.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : null,
  };
}

function setPantryImportStatus(message) {
  const status = document.querySelector("[data-pantry-import-status]");

  if (status) {
    status.textContent = message;
  }
}

function setGroceryGenerationStatus(message) {
  const status = document.querySelector("[data-grocery-generation-status]");

  if (status) {
    status.textContent = message;
  }
}

function setGroceryListGenerationLoading(isLoading) {
  groceryListGenerationRuntime.isLoading = isLoading;

  const button = document.querySelector("[data-grocery-generate-list]");

  if (button) {
    button.disabled = isLoading;
    button.textContent = isLoading ? "Generazione in corso..." : "Genera lista della spesa";
  }
}

function getPantryImportSourceLabel(sourceType = pantryImportRuntime.sourceType) {
  return PANTRY_IMPORT_SOURCE_LABELS[sourceType] || "foto";
}

function renderPantryImportReview() {
  const review = document.querySelector("[data-pantry-import-review]");

  if (!review) {
    return;
  }

  if (pantryImportRuntime.isLoading) {
    review.innerHTML = `
      <article class="pantry-import-empty">
        Analisi in corso...
      </article>
    `;
    return;
  }

  if (pantryImportRuntime.draftItems.length === 0) {
    review.innerHTML = "";
    return;
  }

  const categoryOptions = (selectedCategory) =>
    PANTRY_IMPORT_CATEGORIES.map(
      (category) => `<option value="${escapeHtml(category)}"${category === selectedCategory ? " selected" : ""}>${escapeHtml(category)}</option>`
    ).join("");

  review.innerHTML = `
    <form class="pantry-import-form" data-pantry-import-review-form novalidate>
      <div class="pantry-import-review-head">
        <strong>Proposta AI</strong>
        <span>${pantryImportRuntime.draftItems.length} prodotti riconosciuti</span>
      </div>
      <div class="pantry-import-items">
        ${pantryImportRuntime.draftItems
          .map(
            (item, index) => `
              <article class="pantry-import-item" data-pantry-import-item="${index}">
                <label class="field">
                  <span>Prodotto</span>
                  <input type="text" name="name" value="${escapeHtml(item.name)}" required />
                </label>
                <label class="field">
                  <span>Quantità</span>
                  <input type="text" name="quantity" value="${escapeHtml(item.quantity)}" required />
                </label>
                <label class="field">
                  <span>Categoria</span>
                  <select name="category">
                    ${categoryOptions(item.category)}
                  </select>
                </label>
                <label class="field">
                  <span>Scadenza</span>
                  <input type="date" name="expiryDate" value="${escapeHtml(item.expiryDate)}" />
                </label>
                <input type="hidden" name="barcode" value="${escapeHtml(item.barcode)}" />
                <button class="delete-btn pantry-import-remove" type="button" data-pantry-import-remove="${index}" aria-label="Rimuovi ${escapeHtml(item.name)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
                </button>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="pantry-import-review-actions">
        <button class="grocery-neutral-btn" type="button" data-pantry-import-regenerate>Rigenera</button>
        <button class="primary-btn primary-btn-green" type="submit">Aggiungi in dispensa</button>
      </div>
    </form>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Impossibile leggere l'immagine.")));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Immagine non valida.")));
    image.src = dataUrl;
  });
}

async function compressImageForPantryImport(file) {
  const originalDataUrl = await readFileAsDataUrl(file);

  try {
    const image = await loadImageFromDataUrl(originalDataUrl);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return originalDataUrl;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch (error) {
    return originalDataUrl;
  }
}

async function requestPantryImageImport(file, sourceType) {
  const imageDataUrl = await compressImageForPantryImport(file);
  const response = await fetch(window.NutriTrackBootstrap.buildNutriTrackApiPath("/api/grocery/import-image"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceType,
      image: {
        dataUrl: imageDataUrl,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      window.handleNutriTrackUnauthorized?.();
    }

    throw new Error(payload?.error || "Importazione immagine non riuscita.");
  }

  return Array.isArray(payload?.items) ? payload.items.map(normalizePantryImportItem).filter((item) => item.name) : [];
}

function normalizeGeneratedGroceryListItem(item) {
  return {
    id: crypto.randomUUID(),
    name: String(item?.name || "").trim(),
    quantity: String(item?.quantity || "1 confezione").trim(),
    expiryDate: String(item?.expiryDate || "").trim(),
    category: normalizePantryImportCategory(item?.category),
    completed: false,
    barcode: sanitizeBarcode(item?.barcode),
    source: "ai-generated",
    nutriscoreGrade: "",
    reason: String(item?.reason || "").trim(),
    entryMode: "ai_assisted",
    entryMethod: "ai-generated-list",
  };
}

async function requestGeneratedGroceryList() {
  const response = await fetch(window.NutriTrackBootstrap.buildNutriTrackApiPath("/api/grocery/generate-list"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state: buildServerNutriTrackState(appState),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      window.handleNutriTrackUnauthorized?.();
    }

    throw new Error(payload?.error || "Generazione lista della spesa non riuscita.");
  }

  return Array.isArray(payload?.items)
    ? payload.items.map(normalizeGeneratedGroceryListItem).filter((item) => item.name && item.quantity && item.category)
    : [];
}

async function importPantryImageFile(file, sourceType) {
  if (!file || pantryImportRuntime.isLoading) {
    return;
  }

  pantryImportRuntime.sourceType = sourceType;
  pantryImportRuntime.lastFile = file;
  pantryImportRuntime.isLoading = true;
  pantryImportRuntime.draftItems = [];
  setPantryImportStatus(`Analisi della foto ${getPantryImportSourceLabel(sourceType)} in corso...`);
  renderPantryImportReview();

  try {
    const items = await requestPantryImageImport(file, sourceType);
    pantryImportRuntime.draftItems = items;
    setPantryImportStatus(
      items.length > 0
        ? "Puoi correggere la lista o rigenerarla prima del salvataggio."
        : "La foto non ha prodotto alimenti riconoscibili. Puoi riprovare con una nuova immagine."
    );
  } catch (error) {
    pantryImportRuntime.draftItems = [];
    setPantryImportStatus(error.message || "Importazione immagine non riuscita.");
  } finally {
    pantryImportRuntime.isLoading = false;
    renderPantryImportReview();
  }
}

function readPantryImportDraftFromForm(form) {
  return Array.from(form.querySelectorAll("[data-pantry-import-item]"))
    .map((row) =>
      normalizePantryImportItem({
        name: row.querySelector('[name="name"]')?.value,
        quantity: row.querySelector('[name="quantity"]')?.value,
        category: row.querySelector('[name="category"]')?.value,
        expiryDate: row.querySelector('[name="expiryDate"]')?.value,
        barcode: row.querySelector('[name="barcode"]')?.value,
      })
    )
    .filter((item) => item.name && item.quantity && item.category);
}

function addPantryImportDraftToPantry(items) {
  items.forEach((item) => {
    appState.grocery.pantry.push({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      category: item.category,
      barcode: item.barcode,
      source: "ai-image",
      nutriscoreGrade: "",
      entryMode: "ai_assisted",
      entryMethod: "ai-image-import",
    });
  });

  appState.grocery.pantry.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name));
}

function addScannedGroceryLookupToPantry() {
  const product = openFoodFactsRuntime.groceryLookup;

  if (!product?.name) {
    setPantryImportStatus("Scansiona un prodotto valido prima di aggiungerlo.");
    return false;
  }

  appState.grocery.pantry.push({
    id: crypto.randomUUID(),
    name: product.name,
    quantity: product.quantity || product.serving || "1 confezione",
    expiryDate: "",
    category: normalizePantryImportCategory(product.category),
    barcode: sanitizeBarcode(product.barcode),
    source: product.source || "openfoodfacts",
    nutriscoreGrade: product.nutriscoreGrade || "",
    entryMode: "external_lookup",
    entryMethod: "barcode-openfoodfacts",
  });
  appState.grocery.pantry.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name));
  openFoodFactsRuntime.groceryLookup = null;
  renderLookupResult("[data-off-grocery-result]", null, "");
  setPantryImportStatus(`${product.name} aggiunto alla dispensa.`);
  saveState();
  renderGrocery();
  return true;
}

function dismissScannedGroceryLookup() {
  openFoodFactsRuntime.groceryLookup = null;
  renderLookupResult("[data-off-grocery-result]", null, "");
  setPantryImportStatus("Prodotto scansionato rimosso. Puoi riprovare con un nuovo barcode.");
}

function renderGrocerySummary() {
  const totalItems = appState.grocery.items.length;
  const completedItems = appState.grocery.items.filter((item) => item.completed).length;
  const count = document.querySelector("[data-grocery-count]");
  const progress = document.querySelector("[data-grocery-progress]");
  const percentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  if (count) {
    count.textContent = `${completedItems}/${totalItems}`;
  }

  if (progress) {
    progress.style.width = `${percentage}%`;
  }
}

function renderGroceryList() {
  const list = document.querySelector("[data-grocery-list]");

  if (!list) {
    return;
  }

  if (appState.grocery.items.length === 0) {
    list.innerHTML = `
      <article class="panel empty-state">
        <h3>Lista della spesa</h3>
        <p>Aggiungi il prossimo prodotto da comprare e costruisci il tuo inventario domestico.</p>
      </article>
    `;
    return;
  }

  const groupedItems = appState.grocery.items.reduce((groups, item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }

    groups[item.category].push(item);
    return groups;
  }, {});

  list.innerHTML = Object.entries(groupedItems)
    .sort(([firstCategory], [secondCategory]) => firstCategory.localeCompare(secondCategory))
    .map(
      ([category, items]) => `
        <article class="panel category-panel">
          <div class="category-block">
            <h3>${escapeHtml(category)}</h3>
            <div class="category-items">
          ${items
            .map(
              (item) => `
                <article class="grocery-item${item.completed ? " is-complete" : ""}">
                  <div class="grocery-item-top">
                    <label class="check-row">
                      <input type="checkbox" ${item.completed ? "checked" : ""} data-grocery-toggle-id="${item.id}" />
                      <span class="checkbox-ui"></span>
                      <span>
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(item.quantity)}</small>
                        ${
                          item.nutriscoreGrade
                            ? `
                          <div class="lookup-chip-row">
                            ${item.nutriscoreGrade ? `<span class="lookup-chip ${escapeHtml(getNutriscoreClassName(item.nutriscoreGrade))} nutriscore-chip">${escapeHtml(getNutriscoreLabel(item.nutriscoreGrade))}</span>` : ""}
                          </div>
                        `
                            : ""
                        }
                      </span>
                    </label>
                    <button class="delete-btn grocery-delete-mobile" type="button" aria-label="Rimuovi prodotto" data-grocery-delete-id="${item.id}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
                    </button>
                  </div>
                  <div class="inline-actions">
                    <button class="delete-btn grocery-delete-desktop" type="button" aria-label="Rimuovi prodotto" data-grocery-delete-id="${item.id}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
                    </button>
                  </div>
                </article>
              `
            )
            .join("")}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderPantry() {
  const pantryList = document.querySelector("[data-pantry-list]");
  const pantryItems = Array.isArray(appState.grocery.pantry) ? appState.grocery.pantry : [];
  const visiblePantryLimit = 5;
  const hasHiddenPantryItems = pantryItems.length > visiblePantryLimit;
  const visiblePantryItems =
    hasHiddenPantryItems && !pantryListRuntime.isExpanded ? pantryItems.slice(0, visiblePantryLimit) : pantryItems;

  if (!pantryList) {
    return;
  }

  if (pantryItems.length === 0) {
    pantryListRuntime.isExpanded = false;
    pantryList.innerHTML = `
      <article class="empty-pantry">
        <h3>Nessun alimento salvato in dispensa</h3>
        <p>Quando completi un acquisto, l'articolo comparirà qui come ingrediente disponibile.</p>
      </article>
    `;
    return;
  }

  pantryList.innerHTML = `
    <div class="pantry-list-head" aria-hidden="true">
      <span>Prodotto</span>
      <span>Quantità / scadenza</span>
      <span>Categoria</span>
    </div>
    <div class="pantry-list-body">
      ${visiblePantryItems
        .map(
          (item) => `
            <article class="pantry-item">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.quantity)}${item.expiryDate ? ` • Scad. ${escapeHtml(formatExpiryDate(item.expiryDate))}` : ""}</span>
              <small>${escapeHtml(item.category)}</small>
              <button class="delete-btn pantry-delete-btn" type="button" aria-label="Rimuovi ${escapeHtml(item.name)} dalla dispensa" data-pantry-delete-id="${item.id}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m-9 3h12m-1 0-.63 10.14A2 2 0 0 1 14.37 19H9.63a2 2 0 0 1-1.99-1.86L7 7m3 4v4m4-4v4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
              </button>
            </article>
          `
        )
        .join("")}
    </div>
    ${
      hasHiddenPantryItems
        ? `
          <button class="pantry-expand-btn${pantryListRuntime.isExpanded ? " is-expanded" : ""}" type="button" data-pantry-toggle-expanded aria-expanded="${pantryListRuntime.isExpanded}" aria-label="${pantryListRuntime.isExpanded ? "Comprimi la dispensa" : "Mostra tutta la dispensa"}">
            <span>${pantryListRuntime.isExpanded ? "Mostra meno" : `Mostra altri ${pantryItems.length - visiblePantryLimit}`}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg>
          </button>
        `
        : ""
    }
  `;
}

function renderGroceryArOverlay() {
  const overlay = document.querySelector("[data-grocery-ar-overlay]");
  const comparisonBasisLabel = "Valori per 100 g/ml di prodotto";

  if (!overlay) {
    return;
  }

  if (!groceryArRuntime.stream) {
    overlay.innerHTML = "";
    return;
  }

  ensureGroceryArState();

  const pinnedProducts = getPinnedGroceryComparisonProducts();

  if (pinnedProducts.length === 0) {
    overlay.innerHTML = "";
    return;
  }

  overlay.innerHTML = pinnedProducts
    .map(
      ({ productId, product }) => `
        <article class="grocery-ar-card">
          <div class="grocery-ar-card-top">
            <strong>${escapeHtml(product.name)}</strong>
            <button class="grocery-ar-remove-btn" type="button" data-grocery-ar-remove-id="${escapeHtml(productId)}" aria-label="Rimuovi ${escapeHtml(product.name)} dal confronto">x</button>
          </div>
          <span class="grocery-ar-meta-line">${escapeHtml(product.brand)}</span>
          <span class="grocery-ar-meta-line">${escapeHtml(product.serving)}</span>
          ${product.nutriscoreGrade ? `<span class="grocery-ar-meta-line">${escapeHtml(getNutriscoreLabel(product.nutriscoreGrade))}</span>` : ""}
          <small>${comparisonBasisLabel}</small>
        </article>
      `
    )
    .join("");
}

function renderGroceryArComparison() {
  const comparison = document.querySelector("[data-grocery-ar-comparison]");
  const comparisonBasisLabel = "Valori per 100 g/ml di prodotto";

  if (!comparison) {
    return;
  }

  ensureGroceryArState();

  const pinnedProducts = getPinnedGroceryComparisonProducts();
  const winner = getGroceryComparisonWinner(pinnedProducts.map((entry) => entry.product));

  if (pinnedProducts.length === 0) {
    comparison.innerHTML = `
      <div class="grocery-ar-comparison-empty">
        Nessun prodotto in confronto.
      </div>
    `;
  } else {
    comparison.innerHTML = `
      <div class="grocery-ar-comparison-header">
        <strong>Confronto</strong>
        <span>${pinnedProducts.length === 1 ? "Scansiona un secondo prodotto." : "Rimuovi un prodotto con x per sostituirlo."}</span>
      </div>
      <div class="grocery-ar-comparison-grid">
        ${pinnedProducts
          .map(({ productId, product }) => {
            const score = calculateGroceryComparisonScore(product);
            const isWinner =
              winner && getComparableProductKey(winner.product) === getComparableProductKey(product) && pinnedProducts.length > 1;

            return `
              <article class="grocery-ar-compare-card">
                <div class="grocery-ar-card-top">
                  <strong>${escapeHtml(product.name)}</strong>
                  <button class="grocery-ar-remove-btn" type="button" data-grocery-ar-remove-id="${escapeHtml(productId)}" aria-label="Rimuovi ${escapeHtml(product.name)} dal confronto">x</button>
                </div>
                <span class="grocery-ar-metric-line">Calorie: ${product.calories ?? "--"} kcal</span>
                <span class="grocery-ar-metric-line">Proteine: ${product.protein ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Carboidrati: ${product.carbs ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Grassi: ${product.fats ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Zuccheri: ${product.sugar ?? "--"} g</span>
                <span class="grocery-ar-metric-line">Fibre: ${product.fiber ?? "--"} g</span>
                <small>${comparisonBasisLabel}</small>
                <div class="grocery-ar-score${product.nutriscoreGrade ? "" : " is-neutral"}">
                  ${isWinner ? "Scelta consigliata" : product.nutriscoreGrade ? getNutriscoreLabel(product.nutriscoreGrade) : "Nutrition score"}: ${product.nutriscoreGrade ? escapeHtml(String(product.nutriscoreScore ?? product.nutriscoreGrade.toUpperCase())) : score}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }
}

function renderGrocery() {
  renderGrocerySummary();
  renderGroceryList();
  renderPantry();
  renderPantryImportReview();
  renderGroceryArOverlay();
  renderGroceryArComparison();
}

function stopGroceryArCamera() {
  const stage = document.querySelector(".grocery-ar-stage");
  const video = document.querySelector("[data-grocery-ar-video]");
  const toggleButton = document.querySelector("[data-grocery-ar-toggle]");

  if (groceryArRuntime.detectionLoopId) {
    cancelAnimationFrame(groceryArRuntime.detectionLoopId);
    groceryArRuntime.detectionLoopId = null;
  }

  if (groceryArRuntime.stream) {
    groceryArRuntime.stream.getTracks().forEach((track) => track.stop());
    groceryArRuntime.stream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (stage) {
    stage.classList.remove("is-live");
  }

  if (toggleButton) {
    setGroceryArToggleButtonState(false);
  }
}

function scheduleGroceryBarcodeDetection() {
  const video = document.querySelector("[data-grocery-ar-video]");

  if (!video || !groceryArRuntime.stream || !groceryArRuntime.detector) {
    return;
  }

  const detectFrame = async () => {
    if (!groceryArRuntime.stream || !groceryArRuntime.detector) {
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const barcodes = await groceryArRuntime.detector.detect(video);
        const firstCode = barcodes[0]?.rawValue;

        if (firstCode && appState.grocery.ar.lastDetectedBarcode === firstCode) {
          groceryArRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
          return;
        }

        let matchedProduct = firstCode ? getCachedOpenFoodFactsProduct(firstCode) : null;

        if (!matchedProduct && firstCode) {
          appState.grocery.ar.lastDetectedBarcode = firstCode;
          try {
            matchedProduct = await fetchOpenFoodFactsProduct(firstCode);
          } catch (error) {
            matchedProduct = null;
          }
        }

        if (matchedProduct) {
          ensureGroceryArState();

          appState.grocery.ar.lastDetectedBarcode = firstCode;
          const pinResult = pinGroceryComparisonProduct(getComparableProductKey(matchedProduct));

          if (pinResult.added) {
            saveState();
            renderGroceryArOverlay();
            renderGroceryArComparison();
          }
        }
      } catch (error) {
      }
    }

    groceryArRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
  };

  groceryArRuntime.detectionLoopId = requestAnimationFrame(detectFrame);
}

async function startGroceryArCamera() {
  const video = document.querySelector("[data-grocery-ar-video]");
  const stage = document.querySelector(".grocery-ar-stage");
  const toggleButton = document.querySelector("[data-grocery-ar-toggle]");

  if (!video || !stage || groceryArRuntime.isStarting) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return;
  }

  groceryArRuntime.isStarting = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment",
        },
      },
      audio: false,
    });

    groceryArRuntime.stream = stream;
    video.srcObject = stream;
    await video.play();
    stage.classList.add("is-live");

    if (toggleButton) {
      setGroceryArToggleButtonState(true);
    }

    if ("BarcodeDetector" in window) {
      groceryArRuntime.detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });
      scheduleGroceryBarcodeDetection();
    } else {
      groceryArRuntime.detector = null;
    }
  } catch (error) {
    stopGroceryArCamera();
  } finally {
    groceryArRuntime.isStarting = false;
  }
}

function setupGrocerySection() {
  const form = document.querySelector("[data-grocery-form]");
  const list = document.querySelector("[data-grocery-list]");
  const pantryList = document.querySelector("[data-pantry-list]");
  const generateListButton = document.querySelector("[data-grocery-generate-list]");
  const clearCompletedButton = document.querySelector("[data-clear-completed]");
  const arToggleButton = document.querySelector("[data-grocery-ar-toggle]");
  const arClearButton = document.querySelector("[data-grocery-ar-clear]");
  const pantryImportInput = document.querySelector("[data-pantry-import-input]");
  const pantryImportPanel = document.querySelector(".pantry-import-panel");

  if (!form || !list || !pantryList || !generateListButton || !clearCompletedButton || !arToggleButton || !arClearButton) {
    return;
  }

  bindFormValidationFeedback(form);

  ensureGroceryArState();

  if (appState.grocery.pantry.length === 0) {
    appState.grocery.items
      .filter((item) => item.completed)
      .forEach((item) => upsertPantryItemFromGrocery(item));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const formData = new FormData(form);
    const item = {
      id: crypto.randomUUID(),
      name: String(formData.get("name") || "").trim(),
      quantity: String(formData.get("quantity") || "").trim(),
      expiryDate: String(formData.get("expiryDate") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      completed: false,
      barcode: sanitizeBarcode(formData.get("barcode")),
      source: "manual",
      nutriscoreGrade: "",
      entryMode: "manual",
      entryMethod: "manual-pantry-form",
    };

    if (!item.name || !item.quantity || !item.category) {
      return;
    }

    appState.grocery.pantry.push({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      category: item.category,
      barcode: item.barcode,
      source: item.source,
      nutriscoreGrade: item.nutriscoreGrade,
      entryMode: item.entryMode,
      entryMethod: item.entryMethod,
    });
    appState.grocery.pantry.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name));
    saveState();
    renderGrocery();
    form.reset();
    resetFormValidationState(form);
    form.elements.category.value = "Frutta e verdura";
    form.elements.barcode.value = "";
  });

  list.addEventListener("click", (event) => {
    const arCompareButton = event.target.closest("[data-grocery-ar-item-id]");

    if (arCompareButton) {
      const matchedProduct = getComparableProductByKey(arCompareButton.dataset.groceryArItemId);

      if (!matchedProduct) {
        return;
      }

      const pinResult = pinGroceryComparisonProduct(getComparableProductKey(matchedProduct));

      if (pinResult.added) {
        saveState();
        renderGroceryArOverlay();
        renderGroceryArComparison();
      }
      return;
    }

    const deleteButton = event.target.closest("[data-grocery-delete-id]");

    if (deleteButton) {
      const { groceryDeleteId } = deleteButton.dataset;
      appState.grocery.items = appState.grocery.items.filter((item) => item.id !== groceryDeleteId);
      saveState();
      renderGrocery();
      return;
    }

    const toggle = event.target.closest("[data-grocery-toggle-id]");

    if (toggle) {
      const nextCompleted = toggle.checked;

      appState.grocery.items = appState.grocery.items.map((item) =>
        item.id === toggle.dataset.groceryToggleId
          ? { ...item, completed: nextCompleted }
          : item
      );

      const updatedItem = appState.grocery.items.find((item) => item.id === toggle.dataset.groceryToggleId);

      if (updatedItem && nextCompleted) {
        upsertPantryItemFromGrocery(updatedItem);
      } else if (updatedItem && !nextCompleted) {
        removePantryItem(updatedItem.id);
      }

      saveState();
      renderGrocery();
    }
  });

  generateListButton.addEventListener("click", async () => {
    if (groceryListGenerationRuntime.isLoading) {
      return;
    }

    setGroceryListGenerationLoading(true);
    setGroceryGenerationStatus("Sto generando una lista coerente con dispensa, profilo e sprechi.");

    try {
      const items = await requestGeneratedGroceryList();

      if (items.length === 0) {
        setGroceryGenerationStatus("Non ho trovato prodotti utili da aggiungere alla lista in questo momento.");
        return;
      }

      appState.grocery.items = items;
      saveState();
      renderGrocery();
      setGroceryGenerationStatus(`${items.length} prodotti aggiunti alla lista della spesa.`);
    } catch (error) {
      setGroceryGenerationStatus(error.message || "Generazione lista della spesa non riuscita.");
    } finally {
      setGroceryListGenerationLoading(false);
    }
  });

  pantryList.addEventListener("click", (event) => {
    const expandButton = event.target.closest("[data-pantry-toggle-expanded]");

    if (expandButton) {
      pantryListRuntime.isExpanded = !pantryListRuntime.isExpanded;
      renderPantry();
      return;
    }

    const deleteButton = event.target.closest("[data-pantry-delete-id]");

    if (!deleteButton) {
      return;
    }

    appState.grocery.pantry = appState.grocery.pantry.filter((item) => item.id !== deleteButton.dataset.pantryDeleteId);
    if (appState.grocery.pantry.length <= 5) {
      pantryListRuntime.isExpanded = false;
    }
    saveState();
    renderPantry();
  });

  arToggleButton.addEventListener("click", async () => {
    if (groceryArRuntime.stream) {
      stopGroceryArCamera();
      return;
    }

    await startGroceryArCamera();
  });

  arClearButton.addEventListener("click", () => {
    ensureGroceryArState();
    appState.grocery.ar.pinnedProductIds = [];
    appState.grocery.ar.lastDetectedBarcode = "";
    saveState();
    renderGroceryArOverlay();
    renderGroceryArComparison();
  });

  const arPanel = document.querySelector(".grocery-ar-panel");

  arPanel?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-grocery-ar-remove-id]");

    if (!removeButton) {
      return;
    }

    unpinGroceryComparisonProduct(removeButton.dataset.groceryArRemoveId);
    saveState();
    renderGroceryArOverlay();
    renderGroceryArComparison();
  });

  pantryImportPanel?.addEventListener("click", (event) => {
    const dismissScannedProductButton = event.target.closest("[data-dismiss-grocery-lookup]");

    if (dismissScannedProductButton) {
      dismissScannedGroceryLookup();
      return;
    }

    const addScannedProductButton = event.target.closest("[data-add-grocery-lookup-to-pantry]");

    if (addScannedProductButton) {
      addScannedGroceryLookupToPantry();
      return;
    }

    const sourceButton = event.target.closest("[data-pantry-import-source]");

    if (sourceButton && pantryImportInput) {
      pantryImportRuntime.sourceType = sourceButton.dataset.pantryImportSource;
      pantryImportInput.click();
      return;
    }

    const removeButton = event.target.closest("[data-pantry-import-remove]");

    if (removeButton) {
      const removeIndex = Number(removeButton.dataset.pantryImportRemove);
      pantryImportRuntime.draftItems = pantryImportRuntime.draftItems.filter((item, index) => index !== removeIndex);
      setPantryImportStatus(
        pantryImportRuntime.draftItems.length > 0
          ? "Lista aggiornata. Puoi confermare quando e' corretta."
          : "Tutti gli elementi sono stati rimossi dalla proposta AI."
      );
      renderPantryImportReview();
      return;
    }

    const regenerateButton = event.target.closest("[data-pantry-import-regenerate]");

    if (regenerateButton && pantryImportRuntime.lastFile) {
      importPantryImageFile(pantryImportRuntime.lastFile, pantryImportRuntime.sourceType || "photo");
    }
  });

  pantryImportInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];

    if (file) {
      importPantryImageFile(file, pantryImportRuntime.sourceType || "photo");
    }

    event.target.value = "";
  });

  pantryImportPanel?.addEventListener("submit", (event) => {
    const reviewForm = event.target.closest("[data-pantry-import-review-form]");

    if (!reviewForm) {
      return;
    }

    event.preventDefault();
    const items = readPantryImportDraftFromForm(reviewForm);

    if (items.length === 0) {
      setPantryImportStatus("Aggiungi almeno un prodotto valido prima di confermare.");
      return;
    }

    addPantryImportDraftToPantry(items);
    pantryImportRuntime.draftItems = [];
    saveState();
    renderGrocery();
    setPantryImportStatus(`${items.length} prodotti aggiunti alla dispensa.`);
  });

  clearCompletedButton.addEventListener("click", () => {
    const completedCount = appState.grocery.items.filter((item) => item.completed).length;

    if (completedCount === 0) {
      return;
    }

    appState.grocery.items = appState.grocery.items.filter((item) => !item.completed);
    saveState();
    renderGrocery();
  });

  window.addEventListener("beforeunload", stopGroceryArCamera);
  renderGrocery();
}

setupGrocerySection();
