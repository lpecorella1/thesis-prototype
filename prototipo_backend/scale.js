const mockScaleProvider = require("./scale-provider-mock");

const SCALE_PROVIDER = process.env.SCALE_PROVIDER || "mock";

const SCALE_PROVIDERS = Object.freeze({
  mock: mockScaleProvider,
});

function getScaleProvider() {
  return SCALE_PROVIDERS[SCALE_PROVIDER] || SCALE_PROVIDERS.mock;
}

function getScaleProviderId() {
  return SCALE_PROVIDERS[SCALE_PROVIDER] ? SCALE_PROVIDER : "mock";
}

async function readScaleConnection() {
  return readScaleConnectionForUser(null);
}

async function readScaleConnectionForUser(userContext) {
  return getScaleProvider().readScaleConnection(userContext);
}

function buildPublicScaleState(connection) {
  return getScaleProvider().buildPublicScaleState(connection);
}

async function connectScale(userContext, profileState, currentConnection) {
  return getScaleProvider().connect(profileState, currentConnection, userContext);
}

async function syncScale(userContext, profileState, currentConnection) {
  return getScaleProvider().sync(profileState, currentConnection, userContext);
}

async function disconnectScale(userContext, currentConnection) {
  return getScaleProvider().disconnect(currentConnection, userContext);
}

async function updateScalePermissions(userContext, currentConnection, nextPermissions) {
  return getScaleProvider().updatePermissions(currentConnection, nextPermissions, userContext);
}

module.exports = {
  buildPublicScaleState,
  connectScale,
  disconnectScale,
  getScaleProvider,
  getScaleProviderId,
  readScaleConnection: readScaleConnectionForUser,
  syncScale,
  updateScalePermissions,
};
