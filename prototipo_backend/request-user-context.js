const { readAuthenticatedSessionFromRequest } = require("./auth");
const { getRuntimeConfig } = require("./runtime-config");

function buildSingleUserLocalContext() {
  return {
    type: "local_implicit",
    source: "env_local_user_email",
  };
}

async function resolveRequestUserContext(request) {
  const runtime = getRuntimeConfig();

  if (runtime.identityMode === "authenticated_user") {
    const session = await readAuthenticatedSessionFromRequest(request);

    if (!session) {
      const error = new Error("Sessione non valida o scaduta.");
      error.statusCode = 401;
      throw error;
    }

    return {
      type: "authenticated_user",
      userId: session.userId,
      email: session.email,
    };
  }

  return buildSingleUserLocalContext();
}

module.exports = {
  resolveRequestUserContext,
};
