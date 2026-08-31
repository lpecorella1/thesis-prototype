const crypto = require("crypto");

let pgModule;
let sharedPool;

const PASSWORD_SCHEME = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_COOKIE_NAME = "nutritrack_session";
const SESSION_TTL_DAYS = Number(process.env.NUTRITRACK_SESSION_TTL_DAYS || "14");
const PASSWORD_RESET_TTL_MINUTES = 30;

let nodemailerModule;
let mailTransporter;

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

function getNodemailerModule() {
  if (nodemailerModule !== undefined) {
    return nodemailerModule;
  }

  try {
    nodemailerModule = require("nodemailer");
  } catch (error) {
    nodemailerModule = null;
  }

  return nodemailerModule;
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

function normalizePasswordResetToken(value) {
  return String(value || "").trim();
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

function normalizeCookiePath(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue || rawValue === "/") {
    return "/";
  }

  return `/${rawValue.replace(/^\/+|\/+$/g, "")}`;
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

function validatePasswordResetEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const error = new Error("e-mail non valida.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedEmail;
}

function validatePasswordResetPayload(password, passwordConfirmation) {
  const normalizedPassword = String(password || "");
  const normalizedPasswordConfirmation = String(passwordConfirmation || "");

  if (normalizedPassword.length < 8) {
    const error = new Error("La password deve contenere almeno 8 caratteri.");
    error.statusCode = 400;
    throw error;
  }

  if (normalizedPassword !== normalizedPasswordConfirmation) {
    const error = new Error("Le password inserite non corrispondono.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedPassword;
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

function buildPasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function buildSessionExpiryDate() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function buildPasswordResetExpiryDate() {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
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
    path: normalizeCookiePath(process.env.NUTRITRACK_BASE_PATH || "/nutritrack"),
  };
}

function getSmtpConfig() {
  const host = String(process.env.NUTRITRACK_SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.NUTRITRACK_SMTP_PORT || "587");
  const secure = String(process.env.NUTRITRACK_SMTP_SECURE || "").trim() === "1";
  const user = String(process.env.NUTRITRACK_SMTP_USER || process.env.NUTRITRACK_MAIL_USER || "").trim();
  const pass = String(process.env.NUTRITRACK_SMTP_PASS || process.env.NUTRITRACK_MAIL_PASS || "").trim();
  const from = String(process.env.NUTRITRACK_MAIL_FROM || `NutriTrack <${user}>`).trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    available: Boolean(host && port && user && pass),
  };
}

function getMailTransporter() {
  const nodemailer = getNodemailerModule();
  const config = getSmtpConfig();

  if (!nodemailer) {
    const error = new Error("Invio email non disponibile: dipendenza nodemailer mancante.");
    error.statusCode = 503;
    throw error;
  }

  if (!config.available) {
    const error = new Error("Invio email non configurato: completa le variabili SMTP nel file .env.");
    error.statusCode = 503;
    throw error;
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return {
    transporter: mailTransporter,
    from: config.from,
  };
}

function normalizePublicAppUrl(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  return rawValue.endsWith("/") ? rawValue : `${rawValue}/`;
}

function buildRequestPublicAppUrl(request) {
  const configuredUrl = normalizePublicAppUrl(process.env.NUTRITRACK_PUBLIC_URL);

  if (configuredUrl) {
    return configuredUrl;
  }

  const host = String(request?.headers?.["x-forwarded-host"] || request?.headers?.host || "").trim();

  if (!host) {
    const error = new Error("URL pubblico dell'app non configurato.");
    error.statusCode = 503;
    throw error;
  }

  const protocol = String(request?.headers?.["x-forwarded-proto"] || (process.env.HTTPS === "1" ? "https" : "http"))
    .split(",")[0]
    .trim();
  const basePath = normalizeCookiePath(process.env.NUTRITRACK_BASE_PATH || "/nutritrack");

  return normalizePublicAppUrl(`${protocol}://${host}${basePath}`);
}

function buildPasswordResetUrl(token, request) {
  const url = new URL(buildRequestPublicAppUrl(request));
  url.searchParams.set("resetToken", token);
  return url.toString();
}

async function sendPasswordResetEmail({ email, resetUrl }) {
  const { transporter, from } = getMailTransporter();

  await transporter.sendMail({
    from,
    to: email,
    subject: "Recupero password NutriTrack",
    text:
      "Hai richiesto il recupero della password per NutriTrack.\n\n" +
      `Apri questo link entro ${PASSWORD_RESET_TTL_MINUTES} minuti per impostare una nuova password:\n${resetUrl}\n\n` +
      "Se non hai richiesto tu questa operazione, puoi ignorare questa email.",
    html:
      "<p>Hai richiesto il recupero della password per NutriTrack.</p>" +
      `<p>Apri questo link entro ${PASSWORD_RESET_TTL_MINUTES} minuti per impostare una nuova password:</p>` +
      `<p><a href="${resetUrl}">Reimposta password</a></p>` +
      "<p>Se non hai richiesto tu questa operazione, puoi ignorare questa email.</p>",
  });
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

async function requestPasswordReset({ email }, request) {
  const normalizedEmail = validatePasswordResetEmail(email);

  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT id, email, account_status
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail]
    );
    const user = result.rows[0];

    if (!user || user.account_status !== "active") {
      const error = new Error("e-mail non valida.");
      error.statusCode = 400;
      throw error;
    }

    const token = buildPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = buildPasswordResetExpiryDate();

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [user.id]
    );

    await client.query(
      `
        INSERT INTO password_reset_tokens (
          user_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [user.id, tokenHash, expiresAt.toISOString(), String(request?.headers?.["user-agent"] || "").slice(0, 512), getClientIpAddress(request)]
    );

    const resetUrl = buildPasswordResetUrl(token, request);
    await sendPasswordResetEmail({
      email: user.email,
      resetUrl,
    });

    return {
      email: user.email,
      expiresAt,
    };
  });
}

async function confirmPasswordReset({ token, password, passwordConfirmation }) {
  const normalizedToken = normalizePasswordResetToken(token);

  if (!normalizedToken) {
    const error = new Error("Link non valido o scaduto.");
    error.statusCode = 400;
    throw error;
  }

  const newPassword = validatePasswordResetPayload(password, passwordConfirmation);
  const tokenHash = hashPasswordResetToken(normalizedToken);

  return withClient(async (client) => {
    await client.query("BEGIN");

    try {
      const result = await client.query(
        `
          SELECT
            prt.id,
            prt.user_id,
            prt.expires_at,
            prt.used_at,
            u.account_status
          FROM password_reset_tokens prt
          JOIN users u ON u.id = prt.user_id
          WHERE prt.token_hash = $1
          LIMIT 1
          FOR UPDATE
        `,
        [tokenHash]
      );
      const resetToken = result.rows[0];

      if (
        !resetToken ||
        resetToken.used_at ||
        resetToken.account_status !== "active" ||
        new Date(resetToken.expires_at).getTime() <= Date.now()
      ) {
        const error = new Error("Link non valido o scaduto.");
        error.statusCode = 400;
        throw error;
      }

      await client.query(
        `
          UPDATE users
          SET password_hash = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [buildPasswordHash(newPassword), resetToken.user_id]
      );

      await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [resetToken.id]
      );

      await client.query(
        `
          UPDATE user_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
            AND revoked_at IS NULL
        `,
        [resetToken.user_id]
      );

      await client.query("COMMIT");

      return {
        ok: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
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
  confirmPasswordReset,
  createUserAccount,
  createUserSession,
  readAuthenticatedSessionFromRequest,
  requestPasswordReset,
  revokeUserSessionByToken,
};
