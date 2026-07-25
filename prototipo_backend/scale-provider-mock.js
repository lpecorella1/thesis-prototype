const fs = require("fs/promises");
const path = require("path");
const { buildUserStorageKey } = require("./user-storage");

const scaleDataDir = path.join(__dirname, "data");
const legacyScaleConnectionPath = path.join(scaleDataDir, "scale-connection.json");

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
  return readScaleConnectionForUser(null);
}

function getScaleConnectionPath(userContext) {
  const storageKey = buildUserStorageKey(userContext);
  return path.join(scaleDataDir, "users", storageKey, "scale-connection.json");
}

async function readConnectionFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
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
      return null;
    }

    throw error;
  }
}

async function readScaleConnectionForUser(userContext) {
  const connectionPath = getScaleConnectionPath(userContext);
  const connection = await readConnectionFile(connectionPath);

  if (connection) {
    return connection;
  }

  if (userContext?.type === "authenticated_user") {
    return cloneDefaultConnection();
  }

  const legacyConnection = await readConnectionFile(legacyScaleConnectionPath);
  return legacyConnection || cloneDefaultConnection();
}

async function writeScaleConnection(connection, userContext) {
  const connectionPath = getScaleConnectionPath(userContext);
  await fs.mkdir(path.dirname(connectionPath), { recursive: true });
  await fs.writeFile(connectionPath, JSON.stringify(connection, null, 2));
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

function normalizeClientMeasurement(measurementPayload = {}) {
  const safePayload = measurementPayload && typeof measurementPayload === "object" ? measurementPayload : {};
  const measurement = safePayload.measurement && typeof safePayload.measurement === "object"
    ? safePayload.measurement
    : {};
  const weightKg = Number(measurement.weightKg);
  const bmi = Number(measurement.bmi);
  const bodyFatPercent = Number(measurement.bodyFatPercent);
  const measuredAt = measurement.measuredAt && !Number.isNaN(new Date(measurement.measuredAt).getTime())
    ? new Date(measurement.measuredAt).toISOString()
    : new Date().toISOString();

  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    const error = new Error("Peso bilancia non valido.");
    error.statusCode = 400;
    throw error;
  }

  return {
    providerMode: safePayload.providerMode === "standard_ble" ? "standard_ble" : "client_measurement",
    deviceName: typeof safePayload.device?.name === "string" ? safePayload.device.name.slice(0, 120) : "Bilancia",
    measuredAt,
    latestData: {
      weightKg: Number(weightKg.toFixed(1)),
      bmi: Number.isFinite(bmi) && bmi > 0 ? Number(bmi.toFixed(1)) : null,
      bodyFatPercent:
        Number.isFinite(bodyFatPercent) && bodyFatPercent >= 0 && bodyFatPercent <= 100
          ? Number(bodyFatPercent.toFixed(1))
          : null,
    },
    sourcePayload:
      measurement.sourcePayload && typeof measurement.sourcePayload === "object"
        ? measurement.sourcePayload
        : {},
  };
}

function buildPublicScaleState(connection) {
  const safeConnection = connection && typeof connection === "object" ? connection : cloneDefaultConnection();

  return {
    providerMode: safeConnection.providerMode || "mock",
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

async function connect(profileState, currentConnection, userContext) {
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    connected: true,
    lastSyncAt: new Date().toISOString(),
    latestData: buildScaleLatestData(profileState),
    lastSyncStatus: "connected",
  };

  await writeScaleConnection(nextConnection, userContext);
  return nextConnection;
}

async function sync(profileState, currentConnection, userContext) {
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    connected: Boolean(currentConnection?.connected),
    lastSyncAt: new Date().toISOString(),
    latestData: buildScaleLatestData(profileState),
    lastSyncStatus: currentConnection?.connected ? "synced" : "not_connected",
  };

  await writeScaleConnection(nextConnection, userContext);
  return nextConnection;
}

async function disconnect(currentConnection, userContext) {
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    connected: false,
    lastSyncAt: "",
    latestData: {},
    lastSyncStatus: "disconnected",
  };

  await writeScaleConnection(nextConnection, userContext);
  return nextConnection;
}

async function updatePermissions(currentConnection, nextPermissions, userContext) {
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

  await writeScaleConnection(nextConnection, userContext);
  return nextConnection;
}

async function recordMeasurement(currentConnection, measurementPayload, userContext) {
  const normalizedMeasurement = normalizeClientMeasurement(measurementPayload);
  const nextConnection = {
    ...cloneDefaultConnection(),
    ...(currentConnection && typeof currentConnection === "object" ? currentConnection : {}),
    providerMode: normalizedMeasurement.providerMode,
    connected: true,
    lastSyncAt: normalizedMeasurement.measuredAt,
    latestData: normalizedMeasurement.latestData,
    lastSyncStatus: "synced",
    metadata: {
      ...(currentConnection?.metadata && typeof currentConnection.metadata === "object"
        ? currentConnection.metadata
        : {}),
      deviceName: normalizedMeasurement.deviceName,
      lastSourcePayload: normalizedMeasurement.sourcePayload,
    },
  };

  await writeScaleConnection(nextConnection, userContext);
  return nextConnection;
}

module.exports = {
  buildPublicScaleState,
  connect,
  disconnect,
  providerId: "mock",
  recordMeasurement,
  readScaleConnection: readScaleConnectionForUser,
  sync,
  updatePermissions,
};
