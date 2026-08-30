const buildDevicesApiPath = window.NutriTrackBootstrap.buildNutriTrackApiPath;
const DEVICES_STATE_API_PATH = buildDevicesApiPath("/api/devices/state");
const SCALE_CONNECT_API_PATH = buildDevicesApiPath("/api/scale/connect");
const SCALE_SYNC_API_PATH = buildDevicesApiPath("/api/scale/sync");
const SCALE_DISCONNECT_API_PATH = buildDevicesApiPath("/api/scale/disconnect");
const SCALE_PERMISSIONS_API_PATH = buildDevicesApiPath("/api/scale/permissions");
const SCALE_CLIENT_MEASUREMENT_API_PATH = buildDevicesApiPath("/api/scale/client-measurement");

const devicesRuntime = {
  isHydratingDevices: false,
  scaleBleDevice: null,
};

function getDeviceConfig(deviceId) {
  return devicesCatalog.find((device) => device.id === deviceId) || null;
}

function getDeviceState(deviceId) {
  return appState.devices.integrations[deviceId] || null;
}

function isDeviceUnavailable(deviceId) {
  return false;
}

function getConnectedDevices() {
  return devicesCatalog.filter((device) => getDeviceState(device.id)?.connected);
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

function persistAndRenderDevices() {
  saveState();
  renderDevices();
}

function isStandardBleScaleAvailable() {
  return Boolean(window.isSecureContext && navigator.bluetooth?.requestDevice);
}

function parseGattDateTime(dataView, offset) {
  if (offset + 7 > dataView.byteLength) {
    return null;
  }

  const year = dataView.getUint16(offset, true);
  const month = dataView.getUint8(offset + 2);
  const day = dataView.getUint8(offset + 3);
  const hours = dataView.getUint8(offset + 4);
  const minutes = dataView.getUint8(offset + 5);
  const seconds = dataView.getUint8(offset + 6);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
}

function parseWeightScaleMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const usesImperialUnits = Boolean(flags & 0x01);
  const hasTimestamp = Boolean(flags & 0x02);
  const hasUserId = Boolean(flags & 0x04);
  const hasBmiAndHeight = Boolean(flags & 0x08);

  let offset = 1;
  const rawWeight = dataView.getUint16(offset, true);
  offset += 2;

  const weightKg = usesImperialUnits ? rawWeight * 0.01 * 0.45359237 : rawWeight * 0.005;
  let measuredAt = new Date().toISOString();
  let bmi = null;

  if (hasTimestamp) {
    measuredAt = parseGattDateTime(dataView, offset) || measuredAt;
    offset += 7;
  }

  if (hasUserId) {
    offset += 1;
  }

  if (hasBmiAndHeight && offset + 3 < dataView.byteLength) {
    bmi = dataView.getUint16(offset, true) * 0.1;
  }

  return {
    weightKg: Number(weightKg.toFixed(1)),
    bmi: bmi == null ? null : Number(bmi.toFixed(1)),
    bodyFatPercent: null,
    measuredAt,
    sourcePayload: {
      flags,
      usesImperialUnits,
      hasTimestamp,
      hasUserId,
      hasBmiAndHeight,
    },
  };
}

function waitForWeightScaleMeasurement(characteristic, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      characteristic.removeEventListener("characteristicvaluechanged", handleMeasurement);
      reject(new Error("Nessuna misurazione ricevuta dalla bilancia entro 45 secondi."));
    }, timeoutMs);

    function handleMeasurement(event) {
      window.clearTimeout(timeout);
      characteristic.removeEventListener("characteristicvaluechanged", handleMeasurement);

      try {
        resolve(parseWeightScaleMeasurement(event.target.value));
      } catch (error) {
        reject(new Error("Misurazione BLE ricevuta ma non leggibile."));
      }
    }

    characteristic.addEventListener("characteristicvaluechanged", handleMeasurement);
  });
}

async function requestStandardBleScaleMeasurement() {
  if (!isStandardBleScaleAvailable()) {
    throw new Error("Web Bluetooth non disponibile in questo browser o contesto.");
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: ["weight_scale"] }],
    optionalServices: ["body_composition"],
  });

  devicesRuntime.scaleBleDevice = device;
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService("weight_scale");
  const characteristic = await service.getCharacteristic("weight_measurement");
  const measurementPromise = waitForWeightScaleMeasurement(characteristic);
  await characteristic.startNotifications();

  return {
    device,
    measurement: await measurementPromise,
  };
}

async function submitClientScaleMeasurement(device, measurement) {
  const response = await fetch(SCALE_CLIENT_MEASUREMENT_API_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      providerMode: "standard_ble",
      device: {
        name: device?.name || "Bilancia BLE",
      },
      measurement,
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || `Registrazione misura bilancia fallita (${response.status}).`);
  }

  applyScaleState(payload?.scale || {});
  persistAndRenderDevices();
  return true;
}

async function connectBackendScaleDevice() {
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
  persistAndRenderDevices();
  return true;
}

async function connectScaleDevice() {
  if (!isStandardBleScaleAvailable()) {
    return connectBackendScaleDevice();
  }

  const { device, measurement } = await requestStandardBleScaleMeasurement();
  return submitClientScaleMeasurement(device, measurement);
}

async function syncScaleDevice() {
  const scaleState = getDeviceState("scale");

  if (scaleState?.providerMode === "standard_ble" && isStandardBleScaleAvailable()) {
    const { device, measurement } = await requestStandardBleScaleMeasurement();
    return submitClientScaleMeasurement(device, measurement);
  }

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

async function connectDeviceById(deviceId) {
  if (deviceId === "scale") {
    return connectScaleDevice();
  }

  return false;
}

async function syncDeviceById(deviceId) {
  if (deviceId === "scale") {
    return syncScaleDevice();
  }

  return false;
}

async function disconnectDeviceById(deviceId) {
  if (deviceId === "scale") {
    return disconnectScaleDevice();
  }

  return false;
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

  return [syncLabel, buildEnabledPermissionSummary(device)];
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
    <div class="permission-options">
      ${connectedDevices
        .map((device) => {
          const deviceState = getDeviceState(device.id);
          return `
            <div class="permission-row">
              <span class="permission-row-copy">
                <span class="permission-row-head">
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

function renderDevices() {
  renderDevicesManagePermissionsButton();
  renderDevicesGrid();
  renderDevicesPermissionsPanel();
}

function setupDevicesSection() {
  const grid = document.querySelector("[data-devices-grid]");
  const permissionsButton = document.querySelector("[data-devices-manage-permissions]");
  const permissionsPanel = document.querySelector("[data-devices-permissions-panel]");

  if (!grid || !permissionsButton || !permissionsPanel) {
    return;
  }

  permissionsButton.addEventListener("click", () => {
    appState.devices.showPermissionsPanel = !appState.devices.showPermissionsPanel;
    renderDevicesManagePermissionsButton();
    renderDevicesPermissionsPanel();
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
        console.warn("Unable to connect device.", error);
        window.alert(error?.message || "Connessione dispositivo non riuscita.");
        return;
      }
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
      } catch {
        return;
      }
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
      } catch {
        return;
      }
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
        return;
      }
      return;
    }

    deviceState.permissions[permissionKey] = permissionToggle.checked;
    saveState();
    renderDevicesGrid();
  });

  renderDevices();
  hydrateDevicesState();
}

setupDevicesSection();
