const DEVICES_STATE_API_PATH = "/api/devices/state";
const SCALE_CONNECT_API_PATH = "/api/scale/connect";
const SCALE_SYNC_API_PATH = "/api/scale/sync";
const SCALE_DISCONNECT_API_PATH = "/api/scale/disconnect";
const SCALE_PERMISSIONS_API_PATH = "/api/scale/permissions";
const STRAVA_CONNECT_API_PATH = "/api/strava/connect";
const STRAVA_SYNC_API_PATH = "/api/strava/sync";
const STRAVA_DISCONNECT_API_PATH = "/api/strava/disconnect";

const devicesRuntime = {
  isHydratingDevices: false,
  isSyncingStrava: false,
  isDisconnectingStrava: false,
};

function setDevicesFeedback(message) {
  const feedback = document.querySelector("[data-devices-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function getDeviceConfig(deviceId) {
  return devicesCatalog.find((device) => device.id === deviceId) || null;
}

function getDeviceState(deviceId) {
  return appState.devices.integrations[deviceId] || null;
}

function isDeviceUnavailable(deviceId) {
  const deviceState = getDeviceState(deviceId);
  return deviceId === "strava" && deviceState?.configured === false;
}

function getConnectedDevices() {
  return devicesCatalog.filter((device) => getDeviceState(device.id)?.connected);
}

function getLatestDevicesSyncAt() {
  return getConnectedDevices()
    .map((device) => getDeviceState(device.id)?.lastSyncAt || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function formatDeviceSyncLabel(value) {
  if (!value) {
    return "Mai";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = getTodayDateKey();
  const syncDateKey = date.toISOString().slice(0, 10);

  if (syncDateKey === today) {
    return `Oggi, ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildEnabledPermissionSummary(device) {
  const deviceState = getDeviceState(device.id);

  if (!deviceState) {
    return device.availableLabel;
  }

  const enabledPermissions = Object.entries(device.permissions)
    .filter(([key]) => deviceState.permissions[key])
    .map(([, config]) => config.label.toLowerCase());

  if (enabledPermissions.length === 0) {
    return "Permessi attivi: nessuno";
  }

  return `Dati: ${enabledPermissions.join(", ")}`;
}

function applyScaleState(scaleState) {
  const deviceState = getDeviceState("scale");

  if (!deviceState || !scaleState || typeof scaleState !== "object") {
    return;
  }

  deviceState.connected = Boolean(scaleState.connected);
  deviceState.lastSyncAt = scaleState.lastSyncAt || "";
  deviceState.latestData =
    scaleState.latestData && typeof scaleState.latestData === "object" ? scaleState.latestData : {};
  deviceState.providerMode = scaleState.providerMode || "mock";
  deviceState.configured = scaleState.configured !== false;
  deviceState.lastSyncStatus = scaleState.lastSyncStatus || "";

  if (scaleState.permissions && typeof scaleState.permissions === "object") {
    deviceState.permissions = {
      ...deviceState.permissions,
      ...scaleState.permissions,
    };
  }
}

function applyStravaState(stravaState) {
  const deviceState = getDeviceState("strava");

  if (!deviceState || !stravaState || typeof stravaState !== "object") {
    return;
  }

  deviceState.connected = Boolean(stravaState.connected);
  deviceState.lastSyncAt = stravaState.lastSyncAt || "";
  deviceState.latestData =
    stravaState.latestData && typeof stravaState.latestData === "object" ? stravaState.latestData : {};
  deviceState.configured = Boolean(stravaState.configured);
  deviceState.athleteName = stravaState.athleteName || "";
  deviceState.athleteId = stravaState.athleteId || null;
  deviceState.acceptedScopes = Array.isArray(stravaState.acceptedScopes) ? stravaState.acceptedScopes : [];
  deviceState.lastSyncStatus = stravaState.lastSyncStatus || "";
}

function applyDevicesState(nextDevicesState) {
  if (!nextDevicesState || typeof nextDevicesState !== "object") {
    return;
  }

  appState.devices = normalizeDevicesState(nextDevicesState, { allowIntegrationState: true });
}

async function requestDevicesState() {
  const response = await fetch(DEVICES_STATE_API_PATH, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Stato devices non disponibile (${response.status}).`);
  }

  const payload = await response.json();
  return payload?.devices || null;
}

async function hydrateDevicesState() {
  if (devicesRuntime.isHydratingDevices) {
    return;
  }

  devicesRuntime.isHydratingDevices = true;

  try {
    const devicesState = await requestDevicesState();

    if (!devicesState) {
      return;
    }

    applyDevicesState(devicesState);
    saveState();
    renderDevices();
  } catch (error) {
    console.warn("Unable to hydrate devices state.", error);
  } finally {
    devicesRuntime.isHydratingDevices = false;
  }
}

function applyScaleWeightToProfileIfEnabled() {
  if (!appState.devices.syncPreferences.useConnectedWeightInProfile) {
    return;
  }

  const scaleState = getDeviceState("scale");
  const syncedWeight = normalizeNumber(scaleState?.latestData?.weightKg);

  if (syncedWeight == null) {
    return;
  }

  appState.profile.personal.currentWeightKg = syncedWeight;
  captureTodayProgressSnapshot({ weightKg: syncedWeight });
  renderProfile();
  renderProgress();
}

function persistAndRenderDevices() {
  saveState();
  renderDevices();
}

async function connectScaleDevice() {
  const response = await fetch(SCALE_CONNECT_API_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || `Connessione bilancia fallita (${response.status}).`);
  }

  applyScaleState(payload?.scale || {});
  applyScaleWeightToProfileIfEnabled();
  persistAndRenderDevices();
  return true;
}

async function syncScaleDevice() {
  const response = await fetch(SCALE_SYNC_API_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || `Sync bilancia fallito (${response.status}).`);
  }

  applyScaleState(payload?.scale || {});
  applyScaleWeightToProfileIfEnabled();
  persistAndRenderDevices();
  return true;
}

async function disconnectScaleDevice() {
  const response = await fetch(SCALE_DISCONNECT_API_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || `Disconnessione bilancia fallita (${response.status}).`);
  }

  applyScaleState(payload?.scale || {});
  persistAndRenderDevices();
  return true;
}

async function updateScalePermissions(nextPermissions) {
  const response = await fetch(SCALE_PERMISSIONS_API_PATH, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      permissions: nextPermissions,
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || `Aggiornamento permessi bilancia fallito (${response.status}).`);
  }

  applyScaleState(payload?.scale || {});
  saveState();
  renderDevicesGrid();
  renderDevicesPermissionsPanel();
  return true;
}

async function syncStravaDevice() {
  if (devicesRuntime.isSyncingStrava) {
    return false;
  }

  devicesRuntime.isSyncingStrava = true;

  try {
    const response = await fetch(STRAVA_SYNC_API_PATH, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || `Sync Strava fallito (${response.status}).`);
    }

    applyStravaState(payload?.strava || {});
    persistAndRenderDevices();
    return true;
  } finally {
    devicesRuntime.isSyncingStrava = false;
  }
}

function connectStravaDevice() {
  const deviceState = getDeviceState("strava");

  if (deviceState && !deviceState.configured) {
    setDevicesFeedback("Configura prima il backend Strava con client id e client secret.");
    return false;
  }

  window.location.assign(STRAVA_CONNECT_API_PATH);
  return true;
}

async function disconnectStravaDevice() {
  if (devicesRuntime.isDisconnectingStrava) {
    return false;
  }

  devicesRuntime.isDisconnectingStrava = true;

  try {
    const response = await fetch(STRAVA_DISCONNECT_API_PATH, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || `Disconnessione Strava fallita (${response.status}).`);
    }

    applyStravaState({
      configured: getDeviceState("strava")?.configured,
      connected: false,
      athleteName: "",
      athleteId: null,
      acceptedScopes: [],
      lastSyncAt: "",
      lastSyncStatus: "",
      latestData: {},
    });
    persistAndRenderDevices();
    return true;
  } finally {
    devicesRuntime.isDisconnectingStrava = false;
  }
}

async function connectDeviceById(deviceId) {
  if (deviceId === "strava") {
    return connectStravaDevice();
  }

  if (deviceId === "scale") {
    return connectScaleDevice();
  }

  return false;
}

async function syncDeviceById(deviceId) {
  if (deviceId === "strava") {
    return syncStravaDevice();
  }

  if (deviceId === "scale") {
    return syncScaleDevice();
  }

  return false;
}

async function disconnectDeviceById(deviceId) {
  if (deviceId === "strava") {
    return disconnectStravaDevice();
  }

  if (deviceId === "scale") {
    return disconnectScaleDevice();
  }

  return false;
}

function handleStravaCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const stravaResult = params.get("strava");

  if (!stravaResult) {
    return;
  }

  switchToTab(params.get("tab") || "profile");

  if (stravaResult === "connected") {
    setDevicesFeedback("Strava collegato. Ora recupero lo stato devices aggiornato.");
    hydrateDevicesState();
  } else if (stravaResult === "error") {
    setDevicesFeedback(`Connessione Strava non completata: ${params.get("message") || "errore sconosciuto"}.`);
  }

  params.delete("strava");
  params.delete("tab");
  params.delete("section");
  params.delete("message");
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function getDeviceMetaLines(device) {
  const deviceState = getDeviceState(device.id);

  if (!deviceState?.connected) {
    if (device.id === "scale" && deviceState?.providerMode === "mock") {
      return [
        "Disponibile in ambiente locale",
        "Connessione gestita dal backend NutriTrack",
      ];
    }

    if (isDeviceUnavailable(device.id)) {
      return [
        "Backend Strava non configurato",
        "Imposta client id e client secret sul server",
      ];
    }

    return [
      "Pronto per la connessione",
      buildEnabledPermissionSummary(device),
    ];
  }

  const syncLabel = `Ultimo sync: ${formatDeviceSyncLabel(deviceState.lastSyncAt)}`;

  if (device.id === "scale" && deviceState.latestData.weightKg != null) {
    return [
      deviceState.providerMode === "mock" ? `Integrazione locale · ${syncLabel}` : syncLabel,
      `Peso: ${deviceState.latestData.weightKg} kg${deviceState.latestData.bmi != null ? ` · BMI ${deviceState.latestData.bmi}` : ""}`,
    ];
  }

  if (device.id === "strava" && deviceState.latestData.distanceKm != null) {
    return [
      deviceState.athleteName ? `${deviceState.athleteName} · ${syncLabel}` : syncLabel,
      `${deviceState.latestData.activitiesCount || 0} attivita · ${deviceState.latestData.distanceKm} km · ${deviceState.latestData.durationMin} min`,
    ];
  }

  return [syncLabel, buildEnabledPermissionSummary(device)];
}

function renderDevicesSummary() {
  const container = document.querySelector("[data-devices-summary]");

  if (!container) {
    return;
  }

  const connectedCount = getConnectedDevices().length;
  const latestSyncAt = getLatestDevicesSyncAt();

  container.innerHTML = `
    <article>
      <strong>${devicesCatalog.length}</strong>
      <span>integrazioni disponibili</span>
    </article>
    <article>
      <strong>${connectedCount}</strong>
      <span>connessioni attive</span>
    </article>
    <article>
      <strong>${latestSyncAt ? formatDeviceSyncLabel(latestSyncAt) : "--"}</strong>
      <span>ultimo sync</span>
    </article>
  `;
}

function renderDevicesGrid() {
  const container = document.querySelector("[data-devices-grid]");

  if (!container) {
    return;
  }

  container.innerHTML = devicesCatalog
    .map((device) => {
      const deviceState = getDeviceState(device.id);
      const isConnected = Boolean(deviceState?.connected);
      const metaLines = getDeviceMetaLines(device);
      const isUnavailable = isDeviceUnavailable(device.id);
      const statusLabel = isConnected ? "Connesso" : isUnavailable ? "Da configurare" : device.disconnectedLabel;

      return `
        <article class="device-card${isConnected ? " is-connected" : ""}">
          <div class="device-top">
            <div>
              <span class="device-badge ${escapeHtml(device.badgeClass)}">${escapeHtml(device.badgeLabel)}</span>
              <h3>${escapeHtml(device.title)}</h3>
              <p>${escapeHtml(device.description)}</p>
            </div>
            <span class="status-pill${isConnected ? " connected" : ""}">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="device-meta">
            ${metaLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
          </div>
          <div class="device-actions">
            ${
              isConnected
                ? `
              <button class="ghost-btn" type="button" data-device-sync="${escapeHtml(device.id)}">Sync ora</button>
              <button class="ghost-btn danger" type="button" data-device-disconnect="${escapeHtml(device.id)}">Disconnetti</button>
            `
                : `<button class="ghost-btn primary" type="button" data-device-connect="${escapeHtml(device.id)}" ${isUnavailable ? "disabled" : ""}>${escapeHtml(device.connectLabel)}</button>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDevicesPermissionsPanel() {
  const panel = document.querySelector("[data-devices-permissions-panel]");

  if (!panel) {
    return;
  }

  panel.hidden = !appState.devices.showPermissionsPanel;

  if (panel.hidden) {
    panel.innerHTML = "";
    return;
  }

  const connectedDevices = getConnectedDevices();

  if (connectedDevices.length === 0) {
    panel.innerHTML = `
      <h3>Permessi integrazioni</h3>
      <p class="save-hint">Collega almeno un dispositivo per gestire i permessi dei dati condivisi.</p>
    `;
    return;
  }

  panel.innerHTML = `
    <h3>Permessi integrazioni</h3>
    <div class="sync-options">
      ${connectedDevices
        .map((device) => {
          const deviceState = getDeviceState(device.id);
          return `
            <div class="sync-row">
              <span class="sync-row-copy">
                <span class="sync-row-head">
                  <strong>${escapeHtml(device.title)}</strong>
                </span>
                <small>${escapeHtml(device.description)}</small>
                <div class="lookup-chip-row">
                  ${Object.entries(device.permissions)
                    .map(
                      ([key, config]) => `
                        <label class="lookup-chip">
                          <input type="checkbox" data-device-permission="${escapeHtml(device.id)}" data-device-permission-key="${escapeHtml(key)}" ${deviceState.permissions[key] ? "checked" : ""} />
                          ${escapeHtml(config.label)}
                        </label>
                      `
                    )
                    .join("")}
                </div>
              </span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDevicesManagePermissionsButton() {
  const button = document.querySelector("[data-devices-manage-permissions]");

  if (!button) {
    return;
  }

  button.textContent = appState.devices.showPermissionsPanel ? "Gestisci permessi ↑" : "Gestisci permessi ↓";
}

function renderDevicesSyncOptions() {
  const container = document.querySelector("[data-devices-sync-options]");

  if (!container) {
    return;
  }

  const options = [
    {
      key: "autoSyncDaily",
      title: "Auto-sync ogni giorno",
      description: "Aggiorna automaticamente i dati connessi di salute e nutrizione.",
    },
    {
      key: "importWorkoutCalories",
      title: "Importa le calorie dei workout nel monitoraggio dieta",
      description: "Usa i dati di attivita esterni per aggiornare la stima delle calorie bruciate.",
    },
    {
      key: "useConnectedWeightInProfile",
      title: "Usa i dati di peso connessi nei dati personali",
      description: "Aggiorna le metriche corporee dalle misurazioni della bilancia smart.",
    },
  ];

  container.innerHTML = options
    .map(
      (option) => `
        <label class="sync-row">
          <span class="sync-row-copy">
            <span class="sync-row-head">
              <strong>${escapeHtml(option.title)}</strong>
              <input type="checkbox" data-device-sync-pref="${escapeHtml(option.key)}" ${appState.devices.syncPreferences[option.key] ? "checked" : ""} />
            </span>
            <small>${escapeHtml(option.description)}</small>
          </span>
        </label>
      `
    )
    .join("");
}

function renderDevices() {
  renderDevicesManagePermissionsButton();
  renderDevicesSummary();
  renderDevicesGrid();
  renderDevicesPermissionsPanel();
  renderDevicesSyncOptions();
}

function setupDevicesSection() {
  const grid = document.querySelector("[data-devices-grid]");
  const permissionsButton = document.querySelector("[data-devices-manage-permissions]");
  const addButton = document.querySelector("[data-devices-add]");
  const permissionsPanel = document.querySelector("[data-devices-permissions-panel]");
  const syncOptions = document.querySelector("[data-devices-sync-options]");

  if (!grid || !permissionsButton || !addButton || !permissionsPanel || !syncOptions) {
    return;
  }

  permissionsButton.addEventListener("click", () => {
    appState.devices.showPermissionsPanel = !appState.devices.showPermissionsPanel;
    renderDevicesManagePermissionsButton();
    renderDevicesPermissionsPanel();
  });

  addButton.addEventListener("click", async () => {
    const nextDevice = devicesCatalog.find((device) => {
      return !getDeviceState(device.id)?.connected && !isDeviceUnavailable(device.id);
    });

    if (!nextDevice) {
      setDevicesFeedback("Tutte le integrazioni disponibili sono gia collegate oppure richiedono configurazione backend.");
      return;
    }

    try {
      if (!await connectDeviceById(nextDevice.id)) {
        return;
      }
    } catch (error) {
      setDevicesFeedback(error.message || "Connessione integrazione non riuscita.");
      return;
    }

    setDevicesFeedback(`${nextDevice.title} collegato e sincronizzato.`);
  });

  grid.addEventListener("click", async (event) => {
    const connectButton = event.target.closest("[data-device-connect]");
    const syncButton = event.target.closest("[data-device-sync]");
    const disconnectButton = event.target.closest("[data-device-disconnect]");

    if (connectButton) {
      const device = getDeviceConfig(connectButton.dataset.deviceConnect);

      if (!device) {
        return;
      }

      try {
        if (!await connectDeviceById(device.id)) {
          return;
        }
      } catch (error) {
        setDevicesFeedback(error.message || "Connessione integrazione non riuscita.");
        return;
      }

      setDevicesFeedback(`${device.title} collegato e sincronizzato.`);
      return;
    }

    if (syncButton) {
      const device = getDeviceConfig(syncButton.dataset.deviceSync);

      if (!device) {
        return;
      }

      try {
        if (!await syncDeviceById(device.id)) {
          return;
        }
      } catch (error) {
        setDevicesFeedback(error.message || "Sync integrazione non riuscito.");
        return;
      }

      setDevicesFeedback(`${device.title} sincronizzato.`);
      return;
    }

    if (disconnectButton) {
      const device = getDeviceConfig(disconnectButton.dataset.deviceDisconnect);

      if (!device) {
        return;
      }

      try {
        if (!await disconnectDeviceById(device.id)) {
          return;
        }
      } catch (error) {
        setDevicesFeedback(error.message || "Disconnessione integrazione non riuscita.");
        return;
      }

      setDevicesFeedback(`${device.title} disconnesso.`);
    }
  });

  permissionsPanel.addEventListener("change", async (event) => {
    const permissionToggle = event.target.closest("[data-device-permission]");

    if (!permissionToggle) {
      return;
    }

    const deviceId = permissionToggle.dataset.devicePermission;
    const permissionKey = permissionToggle.dataset.devicePermissionKey;
    const deviceState = getDeviceState(deviceId);

    if (!deviceState) {
      return;
    }

    if (deviceId === "scale") {
      try {
        await updateScalePermissions({
          [permissionKey]: permissionToggle.checked,
        });
      } catch (error) {
        permissionToggle.checked = !permissionToggle.checked;
        setDevicesFeedback(error.message || "Aggiornamento permessi bilancia non riuscito.");
        return;
      }

      setDevicesFeedback("Permessi bilancia aggiornati.");
      return;
    }

    deviceState.permissions[permissionKey] = permissionToggle.checked;
    saveState();
    renderDevicesGrid();
    setDevicesFeedback("Permessi integrazione aggiornati.");
  });

  syncOptions.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-device-sync-pref]");

    if (!toggle) {
      return;
    }

    appState.devices.syncPreferences[toggle.dataset.deviceSyncPref] = toggle.checked;

    if (toggle.dataset.deviceSyncPref === "useConnectedWeightInProfile" && toggle.checked) {
      const scaleState = getDeviceState("scale");

      if (scaleState?.connected) {
        applyScaleWeightToProfileIfEnabled();
        saveState();
      }
    } else {
      saveState();
    }

    renderDevices();
    setDevicesFeedback("Preferenze sync aggiornate.");
  });

  renderDevices();
  handleStravaCallbackParams();
  hydrateDevicesState();
}

setupDevicesSection();
