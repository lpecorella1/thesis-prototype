if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function replaceAllCompat(pattern, replacement) {
    if (pattern instanceof RegExp) {
      if (!pattern.global) {
        throw new TypeError("replaceAll richiede una RegExp globale.");
      }

      return this.replace(pattern, replacement);
    }

    return this.split(pattern).join(replacement);
  };
}

const structuredClone =
  typeof globalThis.structuredClone === "function"
    ? (value) => globalThis.structuredClone(value)
    : (value) => JSON.parse(JSON.stringify(value));

const tabs = document.querySelectorAll(".tabs [data-tab-target]");
const panels = document.querySelectorAll("[data-tab-panel]");
const homeCards = document.querySelectorAll("[data-home-target]");
const sectionLinks = document.querySelectorAll("[data-section-link-target]");
const homeButtons = document.querySelectorAll("[data-go-home]");
const mobileHomeMediaQuery = window.matchMedia("(max-width: 840px)");

const recipeSwitches = document.querySelectorAll("[data-recipe-target]");
const recipePanels = document.querySelectorAll("[data-recipe-panel]");

const NUTRITRACK_LOCAL_STATE_CACHE_KEY = "nutriTrackPrototypeState";
const NUTRITRACK_BASE_PATH = normalizeNutriTrackBasePath(window.NUTRITRACK_BASE_PATH || "");
const NUTRITRACK_STATE_API_PATH = buildNutriTrackApiPath("/api/nutritrack/state");
const NUTRITRACK_SYNC_DEBOUNCE_MS = 450;
const groceryArStartIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 7.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
    <path d="m16.5 10 4-2.5v11l-4-2.5" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
  </svg>
`;
const groceryArStopIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
`;

function setGroceryArToggleButtonState(isActive) {
  const toggleButton = document.querySelector("[data-grocery-ar-toggle]");

  if (!toggleButton) {
    return;
  }

  toggleButton.innerHTML = isActive ? groceryArStopIcon : groceryArStartIcon;
  toggleButton.setAttribute("aria-label", isActive ? "Ferma camera" : "Avvia camera");
}

const nutritrackSyncRuntime = {
  hydrationStarted: false,
  isHydrating: false,
  isSaving: false,
  hasPendingWrite: false,
  saveTimeoutId: null,
};

const groceryArRuntime = {
  stream: null,
  detector: null,
  detectionLoopId: null,
  isStarting: false,
};

const openFoodFactsRuntime = {
  nutritionLookup: null,
  nutritionDraft: null,
  groceryLookup: null,
};

const barcodeScannerRuntime = {
  stream: null,
  detector: null,
  detectionLoopId: null,
  isStarting: false,
  isResolving: false,
  target: "",
  lastDetectedBarcode: "",
};

const recipeChatRuntime = {
  isWaiting: false,
};

function normalizeNutriTrackBasePath(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue === "/") {
    return "";
  }

  return `/${rawValue.replace(/^\/+|\/+$/g, "")}`;
}

function buildNutriTrackApiPath(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${path || ""}`;
  return `${NUTRITRACK_BASE_PATH}${normalizedPath}`;
}

window.NutriTrackBootstrap = Object.freeze({
  crypto,
  structuredClone,
  tabs,
  panels,
  homeCards,
  sectionLinks,
  homeButtons,
  mobileHomeMediaQuery,
  recipeSwitches,
  recipePanels,
  NUTRITRACK_LOCAL_STATE_CACHE_KEY,
  NUTRITRACK_BASE_PATH,
  NUTRITRACK_STATE_API_PATH,
  NUTRITRACK_SYNC_DEBOUNCE_MS,
  buildNutriTrackApiPath,
  defaultRecipeTimestamp,
  RECIPE_NUTRITION_SOURCE_LABEL,
  groceryArStartIcon,
  groceryArStopIcon,
  setGroceryArToggleButtonState,
  nutritrackSyncRuntime,
  groceryArRuntime,
  openFoodFactsRuntime,
  barcodeScannerRuntime,
  recipeChatRuntime,
  OPEN_FOOD_FACTS_FIELDS,
  getDefaultRecipeState,
  getDefaultRecipeChatMessages,
  getRelativeDateKey,
  getDefaultProgressState,
  devicesCatalog,
  getDefaultDevicesUiState,
  getDefaultDevicesIntegrationsState,
  getDefaultDevicesState,
  defaultState,
});
