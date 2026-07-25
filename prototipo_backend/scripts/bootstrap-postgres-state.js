require("../backend-env");

const {
  getNutriTrackStateSnapshot,
  saveNutriTrackState,
} = require("../nutritrack-state/nutritrack-state-repository");

const EMPTY_NUTRITRACK_STATE = Object.freeze({
  profile: {
    personal: {},
    medical: {},
    goals: {},
  },
  nutrition: {
    meals: [],
  },
  grocery: {
    items: [],
    pantry: [],
  },
  progress: {
    dailyLogs: [],
  },
  recipes: {
    generated: [],
    saved: [],
  },
  datasets: {
    openFoodFacts: {
      productsByBarcode: {},
    },
  },
});

async function main() {
  const snapshot = await getNutriTrackStateSnapshot(null);

  if (
    snapshot.storage?.primarySource === "postgres_primary" &&
    snapshot.storage?.postgresStructuredStateComplete === true
  ) {
    console.log("PostgreSQL state bootstrap skipped: structured state already available.");
    return;
  }

  const sourceState = snapshot.state && typeof snapshot.state === "object"
    ? snapshot.state
    : EMPTY_NUTRITRACK_STATE;

  await saveNutriTrackState(null, sourceState);
  console.log("PostgreSQL state bootstrap completed.");
}

main().catch((error) => {
  console.error("PostgreSQL state bootstrap failed:", error.message);
  process.exitCode = 1;
});
