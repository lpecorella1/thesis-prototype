const crypto = require("crypto");
const {
  readNutriTrackStateFile,
  writeNutriTrackStateFile,
} = require("./nutritrack-state-file-store");
const {
  buildDatabaseStatus,
  mirrorNutriTrackStateToPostgres,
  readNutriTrackStateFromPostgres,
} = require("./nutritrack-state-postgres-store");

const POSTGRES_PRIMARY_SECTIONS = ["profile", "nutrition", "grocery", "progress", "recipes", "datasets"];

function cloneNutriTrackState(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function hasMeaningfulNutriTrackState(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function sanitizeNutriTrackStatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Lo stato NutriTrack deve essere un oggetto JSON.");
  }

  return cloneNutriTrackState(payload);
}

function createNutriTrackConflictError(message, snapshot) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "NUTRITRACK_STATE_CONFLICT";
  error.snapshot = snapshot;
  return error;
}

function computeNutriTrackStateRevision(state, primarySource) {
  const serializedState = JSON.stringify(state || null);
  return `${primarySource}:${crypto.createHash("sha256").update(serializedState).digest("hex")}`;
}

function pickAvailableSectionSources(postgresState) {
  return POSTGRES_PRIMARY_SECTIONS.filter((sectionName) =>
    hasMeaningfulNutriTrackState(postgresState?.[sectionName])
  );
}

function buildLegacyUiCacheState(fullState) {
  const sourceState = cloneNutriTrackState(fullState) || {};

  return {
    ...(sourceState.recipes
      ? {
          recipes: {
            ...(sourceState.recipes.generator ? { generator: sourceState.recipes.generator } : {}),
            ...(sourceState.recipes.currentRecipe ? { currentRecipe: sourceState.recipes.currentRecipe } : {}),
            ...(Array.isArray(sourceState.recipes.chatMessages) ? { chatMessages: sourceState.recipes.chatMessages } : {}),
          },
        }
      : {}),
    ...(sourceState.datasets?.openFoodFacts?.source
      ? {
          datasets: {
            openFoodFacts: {
              source: sourceState.datasets.openFoodFacts.source,
            },
          },
        }
      : {}),
    ...(sourceState.devices && typeof sourceState.devices === "object"
      ? {
          devices: {
            ...(sourceState.devices.showPermissionsPanel !== undefined
              ? { showPermissionsPanel: sourceState.devices.showPermissionsPanel }
              : {}),
          },
        }
      : {}),
    ...(sourceState.grocery?.ar ? { grocery: { ar: sourceState.grocery.ar } } : {}),
    ...(sourceState.progress?.autoSnapshots ? { progress: { autoSnapshots: sourceState.progress.autoSnapshots } } : {}),
  };
}

function buildStructuredPostgresState(postgresState) {
  if (!hasMeaningfulNutriTrackState(postgresState)) {
    return null;
  }

  return {
    profile: cloneNutriTrackState(postgresState.profile) || {},
    nutrition: {
      ...(cloneNutriTrackState(postgresState.nutrition) || {}),
    },
    grocery: {
      ...(cloneNutriTrackState(postgresState.grocery) || {}),
    },
    progress: {
      ...(cloneNutriTrackState(postgresState.progress) || {}),
    },
    recipes: {
      ...(cloneNutriTrackState(postgresState.recipes) || {}),
    },
    datasets: {
      ...(cloneNutriTrackState(postgresState.datasets) || {}),
    },
    devices: {
      ...(cloneNutriTrackState(postgresState.devices) || {}),
    },
  };
}

function canUseLegacyFileState(userContext, databaseStatus) {
  return !(databaseStatus.enabled && userContext?.type === "authenticated_user");
}

function composeNutriTrackState({ postgresState, legacyUiCacheState, databaseStatus, allowLegacyFileState }) {
  const structuredPostgresState = buildStructuredPostgresState(postgresState);

  if (databaseStatus.enabled) {
    if (structuredPostgresState) {
      return structuredPostgresState;
    }

    return allowLegacyFileState && hasMeaningfulNutriTrackState(legacyUiCacheState)
      ? cloneNutriTrackState(legacyUiCacheState)
      : null;
  }

  return hasMeaningfulNutriTrackState(legacyUiCacheState) ? cloneNutriTrackState(legacyUiCacheState) : null;
}

function buildStorageMetadata({ baseState, postgresState, databaseStatus, state, allowLegacyFileState }) {
  const postgresPrimarySections = pickAvailableSectionSources(postgresState);
  const postgresStructuredStateComplete = postgresPrimarySections.length === POSTGRES_PRIMARY_SECTIONS.length;
  const usingLegacyFileFallback =
    allowLegacyFileState && (!databaseStatus.enabled || !hasMeaningfulNutriTrackState(postgresState));
  const primarySource = usingLegacyFileFallback ? "legacy_file" : "postgres_primary";

  return {
    database: databaseStatus,
    primarySource,
    postgresPrimarySections,
    postgresStructuredStateComplete,
    legacyFileAvailable: hasMeaningfulNutriTrackState(baseState),
    revision: computeNutriTrackStateRevision(state, primarySource),
    usesLegacyFileFallback: usingLegacyFileFallback,
  };
}

async function getNutriTrackStateSnapshot(userContext) {
  const databaseStatus = buildDatabaseStatus();
  const allowLegacyFileState = canUseLegacyFileState(userContext, databaseStatus);
  const [storedState, postgresState] = await Promise.all([
    allowLegacyFileState ? readNutriTrackStateFile() : Promise.resolve(null),
    readNutriTrackStateFromPostgres(userContext),
  ]);
  const state = composeNutriTrackState({
    postgresState,
    legacyUiCacheState: storedState,
    databaseStatus,
    allowLegacyFileState,
  });
  const storage = buildStorageMetadata({
    baseState: storedState,
    postgresState,
    databaseStatus,
    state,
    allowLegacyFileState,
  });

  return {
    state,
    revision: storage.revision,
    storage,
  };
}

async function getNutriTrackState(userContext) {
  const snapshot = await getNutriTrackStateSnapshot(userContext);
  return snapshot.state;
}

async function saveNutriTrackState(userContext, nextState, options = {}) {
  const sanitizedState = sanitizeNutriTrackStatePayload(nextState);
  const expectedRevision = typeof options.expectedRevision === "string" ? options.expectedRevision.trim() : "";
  const currentSnapshot = await getNutriTrackStateSnapshot(userContext);

  if (expectedRevision && currentSnapshot.revision && expectedRevision !== currentSnapshot.revision) {
    throw createNutriTrackConflictError(
      "Lo stato NutriTrack e' stato aggiornato da un'altra sessione. Ricarica i dati prima di salvare di nuovo.",
      currentSnapshot
    );
  }

  const databaseStatus = buildDatabaseStatus();

  if (databaseStatus.enabled) {
    await mirrorNutriTrackStateToPostgres(sanitizedState, userContext);

    if (canUseLegacyFileState(userContext, databaseStatus)) {
      await writeNutriTrackStateFile(buildLegacyUiCacheState(sanitizedState));
    }
  } else {
    if (userContext?.type === "authenticated_user") {
      const error = new Error("Salvataggio utente non disponibile: PostgreSQL non configurato.");
      error.statusCode = 503;
      throw error;
    }

    await writeNutriTrackStateFile(sanitizedState);
  }

  return cloneNutriTrackState(sanitizedState);
}

module.exports = {
  getNutriTrackDatabaseStatus: buildDatabaseStatus,
  getNutriTrackState,
  getNutriTrackStateSnapshot,
  saveNutriTrackState,
};
