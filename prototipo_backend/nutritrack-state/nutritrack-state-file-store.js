const fs = require("fs/promises");
const path = require("path");

const nutritrackStateDataDir = path.join(__dirname, "..", "data");
const nutritrackStateFilePath = path.join(nutritrackStateDataDir, "nutritrack-state.json");

async function ensureNutriTrackStateDataDir() {
  await fs.mkdir(nutritrackStateDataDir, { recursive: true });
}

async function readNutriTrackStateFile() {
  try {
    const fileContent = await fs.readFile(nutritrackStateFilePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeNutriTrackStateFile(nextState) {
  await ensureNutriTrackStateDataDir();
  await fs.writeFile(nutritrackStateFilePath, JSON.stringify(nextState, null, 2), "utf8");
}

module.exports = {
  nutritrackStateFilePath,
  readNutriTrackStateFile,
  writeNutriTrackStateFile,
};
