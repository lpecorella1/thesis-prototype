function normalizeBooleanFlag(value) {
  return String(value || "").trim() === "1";
}

function normalizeIdentityMode(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (normalizedValue === "authenticated-user" || normalizedValue === "authenticated_user") {
    return "authenticated_user";
  }

  return "single_user_local";
}

function getRuntimeConfig() {
  const developmentSeedEnabled = normalizeBooleanFlag(process.env.NUTRITRACK_ENABLE_DEVELOPMENT_SEED);
  const identityMode = normalizeIdentityMode(process.env.NUTRITRACK_APP_MODE);

  return {
    identityMode,
    developmentSeedEnabled,
    usesImplicitLocalUser: identityMode === "single_user_local",
    requiresAuthenticatedUser: identityMode === "authenticated_user",
    summary: developmentSeedEnabled
      ? `${identityMode}+development_seed`
      : identityMode,
  };
}

module.exports = {
  getRuntimeConfig,
};
