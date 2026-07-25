function buildUserStorageKey(userContext) {
  if (userContext?.type === "authenticated_user") {
    const normalizedUserId = Number(userContext.userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Authenticated user context non valido: userId mancante.");
    }

    return `user-${normalizedUserId}`;
  }

  if (userContext?.type === "local_implicit" || !userContext) {
    return "local-app";
  }

  throw new Error(`User context non supportato per lo storage: ${userContext.type || "unknown"}.`);
}

module.exports = {
  buildUserStorageKey,
};
