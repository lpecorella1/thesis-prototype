require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PORT = String(process.env.PORT || "3000");
const certDirectory = path.join(__dirname, "certs");
const certPath = path.join(certDirectory, "local-cert.pem");
const keyPath = path.join(certDirectory, "local-key.pem");
const opensslConfigPath = path.join(certDirectory, "openssl-local.cnf");

function getLanIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        return;
      }

      candidates.push(entry.address);
    });
  });

  const privateIp = candidates.find((address) => {
    return (
      address.startsWith("192.168.") ||
      address.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
  });

  return privateIp || candidates[0] || null;
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function writeOpenSslConfig(ipAddress) {
  const config = `[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]
C = IT
ST = Rome
L = Rome
O = NutriTrack Local
OU = Prototype
CN = ${ipAddress}

[v3_req]
subjectAltName = @alt_names
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
IP.1 = ${ipAddress}
DNS.1 = localhost
`;

  fs.writeFileSync(opensslConfigPath, config, "utf8");
}

function certificateMatchesIp(ipAddress) {
  if (!fs.existsSync(certPath)) {
    return false;
  }

  try {
    const output = execFileSync("openssl", ["x509", "-in", certPath, "-noout", "-subject", "-text"], {
      encoding: "utf8"
    });

    return output.includes(`CN = ${ipAddress}`) || output.includes(`IP Address:${ipAddress}`);
  } catch (error) {
    return false;
  }
}

function certificateIsFresh() {
  if (!fs.existsSync(certPath)) {
    return false;
  }

  try {
    execFileSync("openssl", ["x509", "-checkend", "86400", "-noout", "-in", certPath], {
      stdio: "ignore"
    });
    return true;
  } catch (error) {
    return false;
  }
}

function generateCertificate(ipAddress) {
  ensureDirectory(certDirectory);
  writeOpenSslConfig(ipAddress);

  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-nodes",
      "-days",
      "30",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-config",
      opensslConfigPath
    ],
    {
      stdio: "inherit"
    }
  );
}

function ensureCertificate(ipAddress) {
  if (certificateMatchesIp(ipAddress) && certificateIsFresh()) {
    return;
  }

  generateCertificate(ipAddress);
}

const lanIpAddress = getLanIpAddress();

if (!lanIpAddress) {
  throw new Error("Impossibile rilevare un indirizzo IP locale. Verifica di essere connessa alla stessa rete del telefono.");
}

ensureCertificate(lanIpAddress);

process.env.HOST = process.env.HOST || "0.0.0.0";
process.env.PORT = PORT;
process.env.HTTPS = "1";
process.env.HTTPS_KEY_PATH = keyPath;
process.env.HTTPS_CERT_PATH = certPath;

console.log(`[Mobile] Certificato pronto per https://${lanIpAddress}:${PORT}`);
console.log("[Mobile] Apri questo indirizzo dal telefono collegato alla stessa rete Wi-Fi.");

require("./server");
