const crypto = require("crypto");

let pgModule;
let sharedPool;

const PASSWORD_SCHEME = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_COOKIE_NAME = "nutritrack_session";
const SESSION_TTL_DAYS = Number(process.env.NUTRITRACK_SESSION_TTL_DAYS || "14");

function getPgModule() {
  if (pgModule !== undefined) {
    return pgModule;
  }

  try {
    pgModule = require("pg");
  } catch (error) {
    pgModule = null;
  }

  return pgModule;
}

function getDatabaseConfig() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  const enabled = String(process.env.NUTRITRACK_USE_POSTGRES || "").trim() === "1";
  const pg = getPgModule();
  const usesPlaceholderCredentials =
    connectionString.includes("://USERNAME:") ||
    connectionString.includes(":PASSWORD@");

  return {
    connectionString,
    enabled,
    pg,
    usesPlaceholderCredentials,
    available: Boolean(enabled && connectionString && pg),
  };
}

function getPool() {
  const config = getDatabaseConfig();

  if (!config.available) {
    return null;
  }

  if (!sharedPool) {
    sharedPool = new config.pg.Pool({
      connectionString: config.connectionString,
    });
  }

  return sharedPool;
}

async function withClient(callback) {
  const config = getDatabaseConfig();

  if (config.enabled && config.usesPlaceholderCredentials) {
    const error = new Error(
      "PostgreSQL non configurato correttamente: sostituisci USERNAME e PASSWORD nel file prototipo_backend/.env con le credenziali reali del database."
    );
    error.statusCode = 503;
    throw error;
  }

  const pool = getPool();

  if (!pool) {
    const error = new Error("Autenticazione non disponibile: PostgreSQL non configurato.");
    error.statusCode = 503;
    throw error;
  }

  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeFullName(firstName, lastName) {
  return [firstName, lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function parseCookieHeader(value) {
  return String(value || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((result, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return result;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const rawValue = entry.slice(separatorIndex + 1).trim();
      result[key] = decodeURIComponent(rawValue);
      return result;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  segments.push(`Path=${options.path || "/"}`);

  if (options.httpOnly !== false) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

function buildPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256");
  return [PASSWORD_SCHEME, String(PASSWORD_ITERATIONS), salt, derivedKey.toString("hex")].join("$");
}

function verifyPassword(password, storedHash) {
  const [scheme, iterationText, salt, expectedHash] = String(storedHash || "").split("$");

  if (scheme !== PASSWORD_SCHEME || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number(iterationText);

  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, "sha256");
  const actualHash = derivedKey.toString("hex");

  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function validateCredentials(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || "");

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const error = new Error("Email non valida.");
    error.statusCode = 400;
    throw error;
  }

  if (normalizedPassword.length < 8) {
    const error = new Error("La password deve contenere almeno 8 caratteri.");
    error.statusCode = 400;
    throw error;
  }

  return {
    email: normalizedEmail,
    password: normalizedPassword,
  };
}

function validateRegistrationProfile(firstName, lastName) {
  const normalizedFirstName = String(firstName || "").trim();
  const normalizedLastName = String(lastName || "").trim();

  if (!normalizedFirstName) {
    const error = new Error("Il nome è obbligatorio.");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedLastName) {
    const error = new Error("Il cognome è obbligatorio.");
    error.statusCode = 400;
    throw error;
  }

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    fullName: normalizeFullName(normalizedFirstName, normalizedLastName),
  };
}

function buildSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function buildSessionExpiryDate() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function getClientIpAddress(request) {
  const forwardedFor = String(request?.headers?.["x-forwarded-for"] || "").trim();

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return String(request?.socket?.remoteAddress || "").trim() || null;
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "Lax",
    secure: String(process.env.HTTPS || "").trim() === "1",
    path: "/",
  };
}

function buildAuthCookie(token, expiresAt) {
  return serializeCookie(SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptions(),
    expires: expiresAt,
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  });
}

function buildClearedAuthCookie() {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}

async function createUserAccount({ email, password, firstName, lastName }) {
  const credentials = validateCredentials(email, password);
  const profile = validateRegistrationProfile(firstName, lastName);

  return withClient(async (client) => {
    const existingUser = await client.query(
      `
        SELECT id
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [credentials.email]
    );

    if (existingUser.rows[0]) {
      const error = new Error("Esiste gia un account con questa email.");
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = buildPasswordHash(credentials.password);
    await client.query("BEGIN");

    try {
      const result = await client.query(
        `
          INSERT INTO users (email, password_hash)
          VALUES ($1, $2)
          RETURNING id, email
        `,
        [credentials.email, passwordHash]
      );

      await client.query(
        `
          INSERT INTO user_profiles (user_id, full_name)
          VALUES ($1, $2)
        `,
        [result.rows[0].id, profile.fullName]
      );

      await client.query("COMMIT");

      return {
        id: result.rows[0].id,
        email: result.rows[0].email,
        fullName: profile.fullName,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function authenticateUser({ email, password }) {
  const credentials = validateCredentials(email, password);

  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT users.id, users.email, users.password_hash, users.account_status
             , up.full_name
        FROM users
        LEFT JOIN user_profiles up ON up.user_id = users.id
        WHERE users.email = $1
        LIMIT 1
      `,
      [credentials.email]
    );

    const user = result.rows[0];

    if (!user || !verifyPassword(credentials.password, user.password_hash)) {
      const error = new Error("Credenziali non valide.");
      error.statusCode = 401;
      throw error;
    }

    if (user.account_status !== "active") {
      const error = new Error("Account non attivo.");
      error.statusCode = 403;
      throw error;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name || null,
    };
  });
}

async function createUserSession(user, request) {
  return withClient(async (client) => {
    const token = buildSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = buildSessionExpiryDate();

    await client.query(
      `
        INSERT INTO user_sessions (
          user_id,
          session_token_hash,
          expires_at,
          user_agent,
          ip_address
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [user.id, tokenHash, expiresAt.toISOString(), String(request?.headers?.["user-agent"] || "").slice(0, 512), getClientIpAddress(request)]
    );

    return {
      token,
      expiresAt,
    };
  });
}

async function readUserSessionByToken(token) {
  if (!token) {
    return null;
  }

  return withClient(async (client) => {
    const tokenHash = hashSessionToken(token);
    const result = await client.query(
      `
        SELECT
          us.id AS session_id,
          us.user_id,
          us.expires_at,
          u.email,
          u.account_status,
          up.full_name
        FROM user_sessions us
        JOIN users u ON u.id = us.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE us.session_token_hash = $1
          AND us.revoked_at IS NULL
          AND us.expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `,
      [tokenHash]
    );

    const row = result.rows[0];

    if (!row || row.account_status !== "active") {
      return null;
    }

    await client.query(
      `
        UPDATE user_sessions
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [row.session_id]
    );

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name || null,
      expiresAt: row.expires_at,
    };
  });
}

async function revokeUserSessionByToken(token) {
  if (!token) {
    return false;
  }

  return withClient(async (client) => {
    const result = await client.query(
      `
        UPDATE user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE session_token_hash = $1
          AND revoked_at IS NULL
      `,
      [hashSessionToken(token)]
    );

    return result.rowCount > 0;
  });
}

async function readAuthenticatedSessionFromRequest(request) {
  const cookies = parseCookieHeader(request?.headers?.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  return readUserSessionByToken(token);
}

module.exports = {
  SESSION_COOKIE_NAME,
  authenticateUser,
  buildAuthCookie,
  buildClearedAuthCookie,
  createUserAccount,
  createUserSession,
  readAuthenticatedSessionFromRequest,
  revokeUserSessionByToken,
};
