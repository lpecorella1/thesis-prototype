function formatMealTime(value) {
  if (!value) {
    return "--:--";
  }

  const [hoursString, minutesString] = value.split(":");
  const hours = Number(hoursString);
  const minutes = Number(minutesString);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function roundMacroValue(value) {
  return Math.max(0, Math.round(value));
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function normalizeQuantityUnit(unit) {
  if (!unit) {
    return "";
  }

  if (unit === "kg") {
    return "g";
  }

  if (unit === "l") {
    return "ml";
  }

  return unit;
}

function convertQuantityToBaseUnit(value, unit) {
  const normalizedUnit = normalizeQuantityUnit(unit);

  if (unit === "kg") {
    return { value: value * 1000, unit: normalizedUnit };
  }

  if (unit === "l") {
    return { value: value * 1000, unit: normalizedUnit };
  }

  return { value, unit: normalizedUnit };
}

function formatQuantityValue(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10).replace(".", ",");
}

function formatPantryQuantity(value, unit, fallbackRaw) {
  if (!unit) {
    return fallbackRaw || formatQuantityValue(value);
  }

  return `${formatQuantityValue(value)} ${unit}`;
}
