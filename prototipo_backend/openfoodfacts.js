const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const datasetPath = path.join(__dirname, "en.openfoodfacts.org.products.csv");
const OPEN_FOOD_FACTS_API_URL = "https://world.openfoodfacts.org/api/v2/product";

const REQUIRED_COLUMNS = [
  "code",
  "product_name",
  "brands",
  "quantity",
  "serving_size",
  "categories",
  "categories_tags",
  "nutriscore_grade",
  "nutriscore_score",
  "image_url",
  "image_small_url",
  "energy-kcal_100g",
  "fat_100g",
  "carbohydrates_100g",
  "sugars_100g",
  "fiber_100g",
  "proteins_100g"
];

let cachedHeaderMap = null;

function sanitizeBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

function ensureDatasetExists() {
  if (!fs.existsSync(datasetPath)) {
    throw new Error("Dataset OpenFoodFacts locale non trovato.");
  }
}

function getHeaderMap() {
  if (cachedHeaderMap) {
    return cachedHeaderMap;
  }

  ensureDatasetExists();
  const fileDescriptor = fs.openSync(datasetPath, "r");
  const chunkSize = 128 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  let bytesRead = 0;
  let headerChunk = "";

  try {
    bytesRead = fs.readSync(fileDescriptor, buffer, 0, chunkSize, 0);
    headerChunk = buffer.toString("utf8", 0, bytesRead);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  const headerLine = headerChunk.split(/\r?\n/, 1)[0];

  if (!headerLine) {
    throw new Error("Header del dataset OpenFoodFacts non leggibile.");
  }

  const columns = headerLine.split("\t");
  cachedHeaderMap = Object.fromEntries(columns.map((column, index) => [column, index]));
  return cachedHeaderMap;
}

function getValue(columns, headerMap, key) {
  const index = headerMap[key];
  return index === undefined ? "" : String(columns[index] || "").trim();
}

function toOptionalNumber(value) {
  if (!value) {
    return null;
  }

  const normalized = Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

function buildCompatibleProduct(columns, headerMap) {
  const categoriesTags = getValue(columns, headerMap, "categories_tags");

  return {
    code: getValue(columns, headerMap, "code"),
    product_name: getValue(columns, headerMap, "product_name"),
    product_name_it: "",
    brands: getValue(columns, headerMap, "brands"),
    quantity: getValue(columns, headerMap, "quantity"),
    serving_size: getValue(columns, headerMap, "serving_size"),
    categories: getValue(columns, headerMap, "categories"),
    categories_tags: categoriesTags
      ? categoriesTags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [],
    nutriscore_grade: getValue(columns, headerMap, "nutriscore_grade"),
    nutriscore_score: toOptionalNumber(getValue(columns, headerMap, "nutriscore_score")),
    image_url: getValue(columns, headerMap, "image_url"),
    image_front_small_url: getValue(columns, headerMap, "image_small_url"),
    nutriments: {
      "energy-kcal_100g": toOptionalNumber(getValue(columns, headerMap, "energy-kcal_100g")),
      fat_100g: toOptionalNumber(getValue(columns, headerMap, "fat_100g")),
      carbohydrates_100g: toOptionalNumber(getValue(columns, headerMap, "carbohydrates_100g")),
      sugars_100g: toOptionalNumber(getValue(columns, headerMap, "sugars_100g")),
      fiber_100g: toOptionalNumber(getValue(columns, headerMap, "fiber_100g")),
      proteins_100g: toOptionalNumber(getValue(columns, headerMap, "proteins_100g"))
    }
  };
}

async function fetchOpenFoodFactsApiProduct(barcode) {
  const response = await fetch(`${OPEN_FOOD_FACTS_API_URL}/${barcode}.json`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`OpenFoodFacts API non raggiungibile (${response.status}).`);
  }

  const payload = await response.json();
  const product = payload?.product;

  if (!product?.code) {
    return null;
  }

  return product;
}

function findProductLineByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    const normalizedBarcode = sanitizeBarcode(barcode);

    if (!normalizedBarcode) {
      reject(new Error("Barcode non valido."));
      return;
    }

    ensureDatasetExists();
    execFile(
      "rg",
      ["-m", "1", `^${normalizedBarcode}\\t`, datasetPath],
      { maxBuffer: 1024 * 1024 * 8 },
      (error, stdout) => {
        if (error) {
          if (error.code === 1) {
            resolve(null);
            return;
          }

          reject(new Error("Ricerca nel dataset OpenFoodFacts fallita."));
          return;
        }

        resolve(stdout.trim());
      }
    );
  });
}

async function fetchOpenFoodFactsProduct(barcode) {
  const normalizedBarcode = sanitizeBarcode(barcode);

  if (!normalizedBarcode) {
    throw new Error("Barcode non valido.");
  }

  try {
    const apiProduct = await fetchOpenFoodFactsApiProduct(normalizedBarcode);

    if (apiProduct) {
      return {
        product: apiProduct,
        source: "api"
      };
    }
  } catch (error) {
    console.warn("[OpenFoodFacts] Lookup API fallito, provo il dataset locale.", {
      barcode: normalizedBarcode,
      message: error.message
    });
  }

  const headerMap = getHeaderMap();
  const productLine = await findProductLineByBarcode(normalizedBarcode);

  if (!productLine) {
    throw new Error("Prodotto non trovato in OpenFoodFacts.");
  }

  const columns = productLine.split("\t");
  const product = buildCompatibleProduct(columns, headerMap);
  return {
    product,
    source: "dataset"
  };
}

module.exports = {
  fetchOpenFoodFactsProduct,
  sanitizeBarcode,
  REQUIRED_COLUMNS
};
