const {
  readNutriTrackStateFile,
  writeNutriTrackStateFile,
} = require("./nutritrack-state-file-store");

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

async function getNutriTrackState() {
  const storedState = await readNutriTrackStateFile();
  return hasMeaningfulNutriTrackState(storedState) ? cloneNutriTrackState(storedState) : null;
}

async function saveNutriTrackState(nextState) {
  const sanitizedState = sanitizeNutriTrackStatePayload(nextState);
  await writeNutriTrackStateFile(sanitizedState);
  return cloneNutriTrackState(sanitizedState);
}

module.exports = {
  getNutriTrackState,
  saveNutriTrackState,
};
