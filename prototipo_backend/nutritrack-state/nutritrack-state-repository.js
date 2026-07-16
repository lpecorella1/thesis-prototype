const {
  readNutriTrackStateFile,
  writeNutriTrackStateFile,
} = require("./nutritrack-state-file-store");
const {
  buildDatabaseStatus,
  mirrorNutriTrackStateToPostgres,
  readNutriTrackStateFromPostgres,
} = require("./nutritrack-state-postgres-store");

const POSTGRES_PRIMARY_SECTIONS = ["profile", "nutrition", "grocery", "progress"];

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

function pickAvailableSectionSources(postgresState) {
  return POSTGRES_PRIMARY_SECTIONS.filter((sectionName) =>
    hasMeaningfulNutriTrackState(postgresState?.[sectionName])
  );
}

function hasCompletePostgresStructuredState(postgresState) {
  return pickAvailableSectionSources(postgresState).length === POSTGRES_PRIMARY_SECTIONS.length;
}

function selectPrimarySectionValue(postgresSection, baseSection, fieldName) {
  if (postgresSection && Object.prototype.hasOwnProperty.call(postgresSection, fieldName)) {
    return cloneNutriTrackState(postgresSection[fieldName]);
  }

  return cloneNutriTrackState(baseSection?.[fieldName]);
}

function buildLegacyDevicesUiState(devicesState) {
  if (!devicesState || typeof devicesState !== "object" || Array.isArray(devicesState)) {
    return null;
  }

  return {
    syncPreferences:
      devicesState.syncPreferences && typeof devicesState.syncPreferences === "object"
        ? cloneNutriTrackState(devicesState.syncPreferences)
        : {},
  };
}

function buildLegacyUiCacheState(fullState) {
  const sourceState = cloneNutriTrackState(fullState) || {};
  const legacyDevicesUiState = buildLegacyDevicesUiState(sourceState.devices);

  return {
    ...(sourceState.recipes ? { recipes: sourceState.recipes } : {}),
    ...(sourceState.datasets ? { datasets: sourceState.datasets } : {}),
    ...(legacyDevicesUiState ? { devices: legacyDevicesUiState } : {}),
    ...(sourceState.nutrition?.goals ? { nutrition: { goals: sourceState.nutrition.goals } } : {}),
    ...(sourceState.grocery?.ar ? { grocery: { ar: sourceState.grocery.ar } } : {}),
    ...(sourceState.progress?.autoSnapshots ? { progress: { autoSnapshots: sourceState.progress.autoSnapshots } } : {}),
  };
}

function mergeNutriTrackState(baseState, postgresState) {
  if (!hasMeaningfulNutriTrackState(postgresState)) {
    return hasMeaningfulNutriTrackState(baseState) ? cloneNutriTrackState(baseState) : null;
  }

  const mergedState = hasMeaningfulNutriTrackState(baseState) ? cloneNutriTrackState(baseState) : {};
  const postgresPrimaryState = cloneNutriTrackState(postgresState);

  return {
    ...mergedState,
    ...postgresPrimaryState,
    profile: postgresPrimaryState.profile || mergedState.profile,
    nutrition: {
      ...(mergedState.nutrition || {}),
      ...(postgresPrimaryState.nutrition || {}),
      meals: selectPrimarySectionValue(postgresPrimaryState.nutrition, mergedState.nutrition, "meals"),
    },
    grocery: {
      ...(mergedState.grocery || {}),
      ...(postgresPrimaryState.grocery || {}),
      items: selectPrimarySectionValue(postgresPrimaryState.grocery, mergedState.grocery, "items"),
      pantry: selectPrimarySectionValue(postgresPrimaryState.grocery, mergedState.grocery, "pantry"),
    },
    progress: {
      ...(mergedState.progress || {}),
      ...(postgresPrimaryState.progress || {}),
      dailyLogs: selectPrimarySectionValue(postgresPrimaryState.progress, mergedState.progress, "dailyLogs"),
    },
  };
}

function buildStorageMetadata({ baseState, postgresState, databaseStatus }) {
  const postgresPrimarySections = pickAvailableSectionSources(postgresState);
  const postgresStructuredStateComplete = postgresPrimarySections.length === POSTGRES_PRIMARY_SECTIONS.length;

  return {
    database: databaseStatus,
    primarySource:
      postgresPrimarySections.length > 0
        ? postgresStructuredStateComplete
          ? "postgres_structured_sections_complete"
          : "postgres_structured_sections_partial"
        : "legacy_file",
    postgresPrimarySections,
    postgresStructuredStateComplete,
    legacyFileAvailable: hasMeaningfulNutriTrackState(baseState),
  };
}

async function getNutriTrackStateSnapshot() {
  const storedState = await readNutriTrackStateFile();
  const postgresState = await readNutriTrackStateFromPostgres();
  const databaseStatus = buildDatabaseStatus();

  return {
    state: mergeNutriTrackState(storedState, postgresState),
    storage: buildStorageMetadata({
      baseState: storedState,
      postgresState,
      databaseStatus,
    }),
  };
}

async function getNutriTrackState() {
  const snapshot = await getNutriTrackStateSnapshot();
  return snapshot.state;
}

async function saveNutriTrackState(nextState) {
  const sanitizedState = sanitizeNutriTrackStatePayload(nextState);
  const databaseStatus = buildDatabaseStatus();

  if (databaseStatus.enabled) {
    await mirrorNutriTrackStateToPostgres(sanitizedState);
    await writeNutriTrackStateFile(buildLegacyUiCacheState(sanitizedState));
  } else {
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
