const { mkdtemp, rm } = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = Number(process.env.NUTRITRACK_SMOKE_PORT || "3011");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${payload.error || text}`);
  }

  return payload;
}

async function waitForServer(baseUrl, timeoutMs = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetchJson(`${baseUrl}/api/database/status`);
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function main() {
  const tempDataDir = await mkdtemp(path.join(os.tmpdir(), "nutritrack-smoke-"));
  const baseUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
  const serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      HOST: DEFAULT_HOST,
      PORT: String(DEFAULT_PORT),
      NUTRITRACK_USE_POSTGRES: "0",
      NUTRITRACK_APP_MODE: "single-user-local",
      NUTRITRACK_ENABLE_DEVELOPMENT_SEED: "0",
      NUTRITRACK_DATA_DIR: tempDataDir,
    },
    stdio: "ignore",
  });

  try {
    await waitForServer(baseUrl);

    const databaseStatusPayload = await fetchJson(`${baseUrl}/api/database/status`);
    const statePayload = await fetchJson(`${baseUrl}/api/nutritrack/state`);
    const devicesPayload = await fetchJson(`${baseUrl}/api/devices/state`);
    const clientScalePayload = await fetchJson(`${baseUrl}/api/scale/client-measurement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        providerMode: "standard_ble",
        device: {
          name: "Smoke Test BLE Scale",
        },
        measurement: {
          weightKg: 72.4,
          bmi: 23.1,
          bodyFatPercent: null,
          measuredAt: "2026-07-25T09:00:00.000Z",
          sourcePayload: {
            flags: 10,
          },
        },
      }),
    });
    const writePayload = await fetchJson(`${baseUrl}/api/nutritrack/state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: {
          profile: {
            personal: {
              fullName: "Smoke Test User",
            },
          },
          nutrition: {
            meals: [],
          },
          grocery: {
            items: [],
            pantry: [],
          },
          progress: {
            dailyLogs: [],
          },
          recipes: {},
          datasets: {},
        },
      }),
    });
    const readBackPayload = await fetchJson(`${baseUrl}/api/nutritrack/state`);

    assert(databaseStatusPayload.database?.mode === "file_only", "Expected file_only mode during smoke test.");
    assert(databaseStatusPayload.runtime?.identityMode === "single_user_local", "Expected single_user_local mode.");
    assert(
      databaseStatusPayload.runtime?.developmentSeedEnabled === false,
      "Development seed should be disabled during smoke test."
    );
    assert(statePayload.runtime?.summary === "single_user_local", "Unexpected runtime summary on state read.");
    assert(devicesPayload.runtime?.usesImplicitLocalUser === true, "Devices payload should expose local-user runtime.");
    assert(clientScalePayload.scale?.providerMode === "standard_ble", "Client scale measurement did not use BLE mode.");
    assert(clientScalePayload.scale?.latestData?.weightKg === 72.4, "Client scale measurement did not persist weight.");
    assert(writePayload.ok === true, "State write did not succeed.");
    assert(
      readBackPayload.state?.profile?.personal?.fullName === "Smoke Test User",
      "State round-trip did not persist expected profile data."
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          runtime: databaseStatusPayload.runtime,
          databaseMode: databaseStatusPayload.database?.mode,
        },
        null,
        2
      )
    );
  } finally {
    serverProcess.kill("SIGTERM");
    await rm(tempDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error.message,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
