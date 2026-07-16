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
  return getScaleProvider().readScaleConnection();
}

function buildPublicScaleState(connection) {
  return getScaleProvider().buildPublicScaleState(connection);
}

async function connectScale(profileState, currentConnection) {
  return getScaleProvider().connect(profileState, currentConnection);
}

async function syncScale(profileState, currentConnection) {
  return getScaleProvider().sync(profileState, currentConnection);
}

async function disconnectScale(currentConnection) {
  return getScaleProvider().disconnect(currentConnection);
}

async function updateScalePermissions(currentConnection, nextPermissions) {
  return getScaleProvider().updatePermissions(currentConnection, nextPermissions);
}

module.exports = {
  buildPublicScaleState,
  connectScale,
  disconnectScale,
  getScaleProvider,
  getScaleProviderId,
  readScaleConnection,
  syncScale,
  updateScalePermissions,
};
