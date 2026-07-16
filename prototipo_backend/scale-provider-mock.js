const fs = require("fs/promises");
const path = require("path");

const SCALE_CONNECTION_PATH = path.join(__dirname, "data", "scale-connection.json");

const DEFAULT_SCALE_CONNECTION = Object.freeze({
  connected: false,
  lastSyncAt: "",
  permissions: {
    weight: true,
    bmi: true,
    bodyFat: true,
  },
  latestData: {},
  lastSyncStatus: "",
});

function cloneDefaultConnection() {
  return JSON.parse(JSON.stringify(DEFAULT_SCALE_CONNECTION));
}

async function readScaleConnection() {
  try {
    const fileContent = await fs.readFile(SCALE_CONNECTION_PATH, "utf8");
    const parsed = JSON.parse(fileContent);

    return {
      ...cloneDefaultConnection(),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      permissions: {
        ...cloneDefaultConnection().permissions,
        ...(parsed?.permissions && typeof parsed.permissions === "object" ? parsed.permissions : {}),
      },
      latestData:
        parsed?.latestData && typeof parsed.latestData === "object"
          ? parsed.latestData
          : {},
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return cloneDefaultConnection();
    }

    throw error;
  }
}

async function writeScaleConnection(connection) {
  await fs.mkdir(path.dirname(SCALE_CONNECTION_PATH), { recursive: true });
  await fs.writeFile(SCALE_CONNECTION_PATH, JSON.stringify(connection, null, 2));
}

function buildScaleLatestData(profileState = {}) {
  const heightCm = Number(profileState?.heightCm);
  const weightKg = Number(profileState?.currentWeightKg);
  const bodyFatPercent = Number(profileState?.bodyFatPercent);

  const normalizedWeight = Number.isFinite(weightKg) ? Number(weightKg.toFixed(1)) : null;
  const normalizedHeight = Number.isFinite(heightCm) ? heightCm : null;
  const bmi =
    normalizedWeight != null && normalizedHeight && normalizedHeight > 0
      ? Number((normalizedWeight / ((normalizedHeight / 100) ** 2)).toFixed(1))
      : null;

  return {
    weightKg: normalizedWeight,
    bmi,
    bodyFatPercent: Number.isFinite(bodyFatPercent) ? Number(bodyFatPercent.toFixed(1)) : null,
  };
}

function buildPublicScaleState(connection) {
  const safeConnection = connection && typeof connection === "object" ? connection : cloneDefaultConnection();

  return {
    providerMode: "mock",
    configured: true,
    connected: Boolean(safeConnection.connected),
    lastSyncAt: safeConnection.lastSyncAt || "",
    permissions: {
      ...cloneDefaultConnection().permissions,
      ...(safeConnection.permissions && typeof safeConnection.permissions === "object"
        ? safeConnection.permissions
        : {}),
    },
    latestData:
      safeConnection.latestData && typeof safeConnection.latestData === "object"
        ? safeConnection.latestData
        : {},
    lastSyncStatus: safeConnection.lastSyncStatus || "",
  };
}

async function connect(profileState, currentConnection) {
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    connected: true,
    lastSyncAt: new Date().toISOString(),
    latestData: buildScaleLatestData(profileState),
    lastSyncStatus: "connected",
  };

  await writeScaleConnection(nextConnection);
  return nextConnection;
}

async function sync(profileState, currentConnection) {
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    connected: Boolean(currentConnection?.connected),
    lastSyncAt: new Date().toISOString(),
    latestData: buildScaleLatestData(profileState),
    lastSyncStatus: currentConnection?.connected ? "synced" : "not_connected",
  };

  await writeScaleConnection(nextConnection);
  return nextConnection;
}

async function disconnect(currentConnection) {
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    connected: false,
    lastSyncAt: "",
    latestData: {},
    lastSyncStatus: "disconnected",
  };

  await writeScaleConnection(nextConnection);
  return nextConnection;
}

async function updatePermissions(currentConnection, nextPermissions) {
  const safePermissions = nextPermissions && typeof nextPermissions === "object" ? nextPermissions : {};
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    permissions: {
      ...cloneDefaultConnection().permissions,
      ...(currentConnection?.permissions && typeof currentConnection.permissions === "object"
        ? currentConnection.permissions
        : {}),
      ...Object.fromEntries(
        Object.entries(safePermissions).map(([permissionKey, enabled]) => [permissionKey, Boolean(enabled)])
      ),
    },
  };

  await writeScaleConnection(nextConnection);
  return nextConnection;
}

module.exports = {
  buildPublicScaleState,
  connect,
  disconnect,
  providerId: "mock",
  readScaleConnection,
  sync,
  updatePermissions,
};
