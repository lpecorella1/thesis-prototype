const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";
const STRAVA_DEFAULT_SCOPES = ["read", "activity:read_all"];
const stravaDataDir = path.join(__dirname, "data");
const stravaConnectionFilePath = path.join(stravaDataDir, "strava-connection.json");
const pendingAuthorizationStates = new Set();

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function ensureStravaDataDir() {
  await fs.mkdir(stravaDataDir, { recursive: true });
}

async function readStravaConnection() {
  try {
    const fileContent = await fs.readFile(stravaConnectionFilePath, "utf8");
    const parsed = JSON.parse(fileContent);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeStravaConnection(connection) {
  await ensureStravaDataDir();
  await fs.writeFile(stravaConnectionFilePath, JSON.stringify(connection, null, 2), "utf8");
}

async function clearStravaConnection() {
  try {
    await fs.unlink(stravaConnectionFilePath);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }
}

function normalizeScopes(scopeValue) {
  if (Array.isArray(scopeValue)) {
    return scopeValue.map((value) => String(value).trim()).filter(Boolean);
  }

  if (!scopeValue) {
    return [];
  }

  return String(scopeValue)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getBaseUrl(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = forwardedProto || (process.env.HTTPS === "1" ? "https" : "http");
  return `${protocol}://${request.headers.host}`;
}

function getStravaConfig(request) {
  const clientId = String(process.env.STRAVA_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.STRAVA_CLIENT_SECRET || "").trim();
  const redirectUri =
    String(process.env.STRAVA_REDIRECT_URI || "").trim() || `${getBaseUrl(request)}/api/strava/callback`;
  const scopes = normalizeScopes(process.env.STRAVA_SCOPES).length
    ? normalizeScopes(process.env.STRAVA_SCOPES)
    : STRAVA_DEFAULT_SCOPES;

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    configured: Boolean(clientId && clientSecret),
  };
}

function getAthleteName(athlete) {
  if (!athlete || typeof athlete !== "object") {
    return "";
  }

  return [athlete.firstname, athlete.lastname].filter(Boolean).join(" ").trim();
}

function buildPublicStravaState(connection, config) {
  const safeConnection = connection && typeof connection === "object" ? connection : null;

  return {
    configured: Boolean(config?.configured),
    connected: Boolean(safeConnection?.refreshToken),
    athleteName: getAthleteName(safeConnection?.athlete),
    athleteId: safeConnection?.athlete?.id || null,
    acceptedScopes: Array.isArray(safeConnection?.acceptedScopes) ? safeConnection.acceptedScopes : [],
    lastSyncAt: safeConnection?.lastSyncAt || "",
    lastSyncStatus: safeConnection?.lastSyncStatus || "",
    latestData:
      safeConnection?.latestData && typeof safeConnection.latestData === "object"
        ? cloneJson(safeConnection.latestData)
        : {},
  };
}

function buildAuthorizeUrl(request) {
  const config = getStravaConfig(request);

  if (!config.configured) {
    throw new Error("Configura STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET nel backend.");
  }

  const state = crypto.randomUUID();
  pendingAuthorizationStates.add(state);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: config.scopes.join(","),
    state,
  });

  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

function consumeAuthorizationState(state) {
  if (!state || !pendingAuthorizationStates.has(state)) {
    return false;
  }

  pendingAuthorizationStates.delete(state);
  return true;
}

async function requestStravaJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const errorMessage =
      payload?.message ||
      payload?.errors?.[0]?.message ||
      payload?.error ||
      `Richiesta Strava fallita (${response.status}).`;
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

async function exchangeAuthorizationCode(request, code) {
  const config = getStravaConfig(request);

  if (!config.configured) {
    throw new Error("Configura STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET nel backend.");
  }

  const payload = await requestStravaJson(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  const connection = {
    athlete: payload.athlete || null,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
    acceptedScopes: normalizeScopes(payload.scope),
    connectedAt: new Date().toISOString(),
    lastSyncAt: "",
    lastSyncStatus: "connected",
    latestData: {},
  };

  await writeStravaConnection(connection);
  return connection;
}

async function refreshStravaAccessToken(request, existingConnection) {
  const config = getStravaConfig(request);

  if (!config.configured) {
    throw new Error("Configura STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET nel backend.");
  }

  const payload = await requestStravaJson(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: existingConnection.refreshToken,
    }),
  });

  const refreshedConnection = {
    ...existingConnection,
    athlete: payload.athlete || existingConnection.athlete || null,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
    acceptedScopes: normalizeScopes(payload.scope).length
      ? normalizeScopes(payload.scope)
      : existingConnection.acceptedScopes || [],
  };

  await writeStravaConnection(refreshedConnection);
  return refreshedConnection;
}

async function getAuthorizedStravaConnection(request) {
  const connection = await readStravaConnection();

  if (!connection?.refreshToken) {
    const error = new Error("Strava non e connesso.");
    error.statusCode = 404;
    throw error;
  }

  const expiresAtMs = Number(connection.expiresAt || 0) * 1000;

  if (!connection.accessToken || !expiresAtMs || Date.now() >= expiresAtMs - 60_000) {
    return refreshStravaAccessToken(request, connection);
  }

  return connection;
}

function summarizeActivities(activities) {
  const safeActivities = Array.isArray(activities) ? activities : [];
  const totalDistanceMeters = safeActivities.reduce((sum, activity) => sum + Number(activity.distance || 0), 0);
  const totalMovingTimeSeconds = safeActivities.reduce((sum, activity) => sum + Number(activity.moving_time || 0), 0);
  const latestActivity = safeActivities[0] || null;

  return {
    activitiesCount: safeActivities.length,
    distanceKm: Number((totalDistanceMeters / 1000).toFixed(1)),
    durationMin: Math.round(totalMovingTimeSeconds / 60),
    latestActivityName: latestActivity?.name || "",
    latestActivityType: latestActivity?.type || "",
    latestActivityAt: latestActivity?.start_date || "",
  };
}

async function syncStravaActivities(request) {
  const authorizedConnection = await getAuthorizedStravaConnection(request);
  const activities = await requestStravaJson(`${STRAVA_API_BASE_URL}/athlete/activities?per_page=20&page=1`, {
    headers: {
      Authorization: `Bearer ${authorizedConnection.accessToken}`,
    },
  });

  const syncedAt = new Date().toISOString();
  const latestData = summarizeActivities(activities);
  const nextConnection = {
    ...authorizedConnection,
    lastSyncAt: syncedAt,
    lastSyncStatus: "ok",
    latestData,
  };

  await writeStravaConnection(nextConnection);
  return buildPublicStravaState(nextConnection, getStravaConfig(request));
}

async function revokeStravaConnection(request) {
  const connection = await readStravaConnection();

  if (!connection?.refreshToken) {
    await clearStravaConnection();
    return;
  }

  try {
    const activeConnection = await getAuthorizedStravaConnection(request);
    await requestStravaJson(STRAVA_REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        access_token: activeConnection.accessToken,
      }),
    });
  } catch (error) {
    console.warn("[Strava] Revoca token non completata, procedo con la pulizia locale.", error.message);
  }

  await clearStravaConnection();
}

module.exports = {
  buildAuthorizeUrl,
  buildPublicStravaState,
  consumeAuthorizationState,
  exchangeAuthorizationCode,
  getStravaConfig,
  readStravaConnection,
  revokeStravaConnection,
  syncStravaActivities,
};
