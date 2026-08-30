function getBmiLabel(bmi) {
  if (!bmi) {
    return "Profilo incompleto";
  }

  if (bmi < 18.5) {
    return "Sottopeso";
  }

  if (bmi < 25) {
    return "Normale";
  }

  if (bmi < 30) {
    return "Sovrappeso";
  }

  return "Obesita";
}

function getActivityMultiplier(level) {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    "very-active": 1.9,
  };

  return multipliers[level] || multipliers.moderate;
}

function getActivityLabel(level) {
  const labels = {
    sedentary: "sedentario",
    light: "leggero",
    moderate: "moderato",
    active: "attivo",
    "very-active": "molto attivo",
  };

  return labels[level] || labels.moderate;
}

const profileMetricRanges = {
  age: { min: 1, max: 120 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 20, max: 300 },
};

const MEDICAL_DOCUMENT_MAX_FILE_BYTES = 5_500_000;
const MEDICAL_DOCUMENT_SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MEDICAL_DOCUMENT_SUPPORTED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "pdf", "docx"]);

const medicalLabMetricLabels = {
  total_cholesterol: "Colesterolo totale",
  hdl_cholesterol: "Colesterolo HDL",
  ldl_cholesterol: "Colesterolo LDL",
  triglycerides: "Trigliceridi",
  glucose: "Glicemia",
  hba1c: "Emoglobina glicata",
  blood_pressure_systolic: "Pressione sistolica",
  blood_pressure_diastolic: "Pressione diastolica",
  other: "Altro valore",
};

const medicalLabMetricStatuses = {
  low: "Basso",
  normal: "Nella norma",
  high: "Alto",
  unknown: "Da verificare",
};

function renderMedicalMetricStatusOptions(selectedStatus) {
  return Object.entries(medicalLabMetricStatuses)
    .map(
      ([status, label]) =>
        `<option value="${escapeHtml(status)}"${status === selectedStatus ? " selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function isProfileMetricInRange(value, range) {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

function normalizeMedicalLabMetrics(metrics) {
  return Array.isArray(metrics)
    ? metrics
        .map((metric) => {
          const key = String(metric?.key || "other").trim() || "other";
          const label = String(metric?.label || medicalLabMetricLabels[key] || "Valore clinico").trim();
          const value = String(metric?.value || "").trim();

          if (!value) {
            return null;
          }

          return {
            id: String(metric?.id || crypto.randomUUID()),
            key,
            label,
            value,
            unit: String(metric?.unit || "").trim(),
            referenceRange: String(metric?.referenceRange || "").trim(),
            status: medicalLabMetricStatuses[metric?.status] ? metric.status : "unknown",
            confidence: Number.isFinite(Number(metric?.confidence)) ? Math.max(0, Math.min(1, Number(metric.confidence))) : null,
            documentDate: String(metric?.documentDate || "").trim(),
            sourceName: String(metric?.sourceName || "").trim(),
            capturedAt: String(metric?.capturedAt || new Date().toISOString()).trim(),
          };
        })
        .filter(Boolean)
        .slice(0, 40)
    : [];
}

function formatMedicalLabMetric(metric) {
  const unit = metric.unit ? ` ${metric.unit}` : "";
  const range = metric.referenceRange ? ` · rif. ${metric.referenceRange}` : "";
  const date = metric.documentDate ? ` · ${metric.documentDate}` : "";
  return `${metric.label}: ${metric.value}${unit}${range}${date}`;
}

function buildMedicalLabMetricsConditionsLine(metrics) {
  const metricSummary = normalizeMedicalLabMetrics(metrics).map(formatMedicalLabMetric).join("; ");
  return metricSummary ? `Valori da referto: ${metricSummary}.` : "";
}

function syncMedicalConditionsFieldFromLabMetrics(form, metrics) {
  if (!form?.elements?.medicalConditions) {
    return "";
  }

  const preservedLines = String(form.elements.medicalConditions.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Valori da referto:"));
  const importLine = buildMedicalLabMetricsConditionsLine(metrics);
  const nextConditions = [...preservedLines, importLine].filter(Boolean).join("\n");
  form.elements.medicalConditions.value = nextConditions;
  return nextConditions;
}

function getMedicalMetricStatusLabel(status) {
  return medicalLabMetricStatuses[status] || medicalLabMetricStatuses.unknown;
}

function renderMedicalLabMetrics() {
  const list = document.querySelector("[data-medical-metrics-list]");

  if (!list) {
    return;
  }

  const metrics = normalizeMedicalLabMetrics(appState.profile?.medical?.labMetrics);

  if (metrics.length === 0) {
    list.innerHTML = '<p class="medical-doc-empty">Nessun valore importato dai documenti.</p>';
    return;
  }

  list.innerHTML = metrics
    .map(
      (metric, index) => `
        <article class="medical-metric-chip" data-medical-metric-card="${index}">
          <div class="medical-metric-display">
            <span>${escapeHtml(metric.label)}</span>
            <strong>${escapeHtml(metric.value)}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ""}</strong>
            <small>${escapeHtml(getMedicalMetricStatusLabel(metric.status))}${metric.referenceRange ? ` · rif. ${escapeHtml(metric.referenceRange)}` : ""}</small>
          </div>
          <div class="medical-metric-edit" data-medical-metric-edit-form="${index}" hidden>
            <label>
              <span>Nome</span>
              <input type="text" name="label" value="${escapeHtml(metric.label)}" required />
            </label>
            <label>
              <span>Valore</span>
              <input type="text" name="value" value="${escapeHtml(metric.value)}" required />
            </label>
            <label>
              <span>Unita</span>
              <input type="text" name="unit" value="${escapeHtml(metric.unit)}" />
            </label>
            <label>
              <span>Range</span>
              <input type="text" name="referenceRange" value="${escapeHtml(metric.referenceRange)}" />
            </label>
            <label>
              <span>Stato</span>
              <select name="status">${renderMedicalMetricStatusOptions(metric.status)}</select>
            </label>
          </div>
          <div class="medical-metric-actions">
            <button class="medical-icon-btn" type="button" data-medical-metric-edit="${index}" aria-label="Modifica ${escapeHtml(metric.label)}" title="Modifica">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" /><path d="m14.5 6 3.5 3.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" /></svg>
            </button>
            <button class="medical-icon-btn" type="button" data-medical-metric-save="${index}" aria-label="Salva ${escapeHtml(metric.label)}" title="Salva" hidden>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg>
            </button>
            <button class="medical-icon-btn" type="button" data-medical-metric-cancel="${index}" aria-label="Annulla modifica ${escapeHtml(metric.label)}" title="Annulla" hidden>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" /></svg>
            </button>
            <button class="medical-icon-btn danger" type="button" data-medical-metric-delete="${index}" aria-label="Elimina ${escapeHtml(metric.label)}" title="Elimina">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function getMedicalDocumentFileExtension(file) {
  return String(file?.name || "").split(".").pop().toLowerCase();
}

function isSupportedMedicalDocumentFile(file) {
  const mimeType = String(file?.type || "").toLowerCase();
  const extension = getMedicalDocumentFileExtension(file);
  return MEDICAL_DOCUMENT_SUPPORTED_MIME_TYPES.has(mimeType) || MEDICAL_DOCUMENT_SUPPORTED_EXTENSIONS.has(extension);
}

function formatMedicalDocumentFileSize(size) {
  const megabytes = Number(size || 0) / 1_000_000;
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(Number(size || 0) / 1000))} KB`;
}

function readMedicalDocumentFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Seleziona una foto, un PDF o un documento Word .docx."));
      return;
    }

    if (!isSupportedMedicalDocumentFile(file)) {
      reject(new Error("Formato non supportato. Carica una foto, un PDF o un Word .docx."));
      return;
    }

    if (file.size > MEDICAL_DOCUMENT_MAX_FILE_BYTES) {
      reject(new Error("Documento troppo grande. Prova con un file piu leggero."));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Impossibile leggere il file selezionato.")));
    reader.readAsDataURL(file);
  });
}

async function analyzeMedicalDocumentFile(file) {
  const dataUrl = await readMedicalDocumentFile(file);
  const response = await fetch(window.NutriTrackBootstrap.buildNutriTrackApiPath("/api/profile/analyze-medical-document"), {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: {
        dataUrl,
        name: file.name,
        type: file.type,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Impossibile analizzare il documento.");
  }

  return payload.analysis;
}

function setMedicalDocumentStatus(message, tone = "") {
  const status = document.querySelector("[data-medical-document-status]");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.statusTone = tone;
}

function renderMedicalDocumentReview(analysis) {
  const panel = document.querySelector("[data-medical-document-review]");
  const list = document.querySelector("[data-medical-document-results]");
  const note = document.querySelector("[data-medical-document-note]");

  if (!panel || !list || !note) {
    return;
  }

  const metrics = normalizeMedicalLabMetrics(analysis?.metrics);

  if (metrics.length === 0) {
    panel.hidden = true;
    list.innerHTML = "";
    note.textContent = "";
    return;
  }

  panel.hidden = false;
  list.innerHTML = metrics
    .map(
      (metric, index) => `
        <article class="medical-document-result">
          <label>
            <span>Nome</span>
            <input type="text" value="${escapeHtml(metric.label)}" data-medical-document-field="${index}:label" />
          </label>
          <label>
            <span>Valore</span>
            <input type="text" value="${escapeHtml(metric.value)}" data-medical-document-field="${index}:value" />
          </label>
          <label>
            <span>Unita</span>
            <input type="text" value="${escapeHtml(metric.unit)}" data-medical-document-field="${index}:unit" />
          </label>
          <label>
            <span>Range</span>
            <input type="text" value="${escapeHtml(metric.referenceRange)}" data-medical-document-field="${index}:referenceRange" />
          </label>
          <label>
            <span>Stato</span>
            <select data-medical-document-field="${index}:status">${renderMedicalMetricStatusOptions(metric.status)}</select>
          </label>
          <button class="medical-icon-btn danger" type="button" data-medical-document-delete="${index}" aria-label="Elimina ${escapeHtml(metric.label)}" title="Elimina">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" /></svg>
          </button>
        </article>
      `
    )
    .join("");
  note.textContent = analysis?.reviewNote || "Controlla i valori prima di applicarli al profilo.";
}

function inferHealthFocusFromMetrics(metrics) {
  const keys = new Set(metrics.map((metric) => metric.key));

  if (keys.has("total_cholesterol") || keys.has("hdl_cholesterol") || keys.has("ldl_cholesterol") || keys.has("triglycerides")) {
    return "cholesterol";
  }

  if (keys.has("glucose") || keys.has("hba1c")) {
    return "glycemia";
  }

  if (keys.has("blood_pressure_systolic") || keys.has("blood_pressure_diastolic")) {
    return "blood-pressure";
  }

  return "";
}

function toggleHealthFocusField(primaryObjective) {
  const healthFocusField = document.querySelector("[data-health-focus-field]");
  const healthFocusSelect = document.querySelector('[name="healthFocus"]');
  const requiresHealthFocus = primaryObjective === "health-support";

  if (healthFocusField) {
    healthFocusField.hidden = !requiresHealthFocus;
  }

  if (healthFocusSelect) {
    healthFocusSelect.required = requiresHealthFocus;

    if (!requiresHealthFocus) {
      healthFocusSelect.value = "";
    }
  }
}

let profileSaveConfirmationTimeoutId = null;
let goalsSaveConfirmationTimeoutId = null;

function showSaveConfirmation(selector, timeoutKey) {
  document.querySelectorAll(selector).forEach((element) => {
    element.classList.add("is-visible");
    element.setAttribute("aria-hidden", "false");
  });

  if (timeoutKey.id) {
    clearTimeout(timeoutKey.id);
  }

  timeoutKey.id = window.setTimeout(() => {
    document.querySelectorAll(selector).forEach((element) => {
      element.classList.remove("is-visible");
      element.setAttribute("aria-hidden", "true");
    });
    timeoutKey.id = null;
  }, 2600);
}

function showProfileSaveConfirmation() {
  showSaveConfirmation("[data-profile-save-confirmation]", {
    get id() {
      return profileSaveConfirmationTimeoutId;
    },
    set id(value) {
      profileSaveConfirmationTimeoutId = value;
    },
  });
}

function showGoalsSaveConfirmation() {
  showSaveConfirmation("[data-goals-save-confirmation]", {
    get id() {
      return goalsSaveConfirmationTimeoutId;
    },
    set id(value) {
      goalsSaveConfirmationTimeoutId = value;
    },
  });
}

function updateControlValidationState(control, shouldHighlight) {
  if (!control) {
    return;
  }

  control.classList.toggle("field-invalid-control", shouldHighlight);
  const field = control.closest(".field");

  if (field) {
    field.classList.toggle("field-invalid", shouldHighlight);
  }
}

function validateControlGroup(controls) {
  let isValid = true;

  controls.forEach((control) => {
    const shouldHighlight = !control.checkValidity();
    updateControlValidationState(control, shouldHighlight);

    if (shouldHighlight) {
      isValid = false;
    }
  });

  return isValid;
}

function calculateProfileRecommendations(personal) {
  const age = normalizeNumber(personal.age);
  const heightCm = normalizeNumber(personal.heightCm);
  const currentWeightKg = normalizeNumber(personal.currentWeightKg);
  const targetWeightKg = normalizeNumber(personal.targetWeightKg);
  const gender = personal.gender || "male";

  if (
    !isProfileMetricInRange(age, profileMetricRanges.age) ||
    !isProfileMetricInRange(heightCm, profileMetricRanges.heightCm) ||
    !isProfileMetricInRange(currentWeightKg, profileMetricRanges.weightKg)
  ) {
    return {
      tdee: null,
      calories: null,
      protein: null,
      carbs: null,
      fats: null,
      note: "Completa altezza, peso ed eta per ottenere obiettivi personalizzati.",
      calorieNote: "Le raccomandazioni appariranno dopo aver completato il profilo.",
    };
  }

  const bmrBase =
    10 * currentWeightKg +
    6.25 * heightCm -
    5 * age +
    (gender === "female" ? -161 : gender === "male" ? 5 : -78);
  const tdee = Math.round(bmrBase * getActivityMultiplier(personal.activityLevel));

  let recommendedCalories = tdee;
  let calorieNote = "Target di mantenimento basato sul tuo profilo.";
  const hasValidTargetWeight = isProfileMetricInRange(targetWeightKg, profileMetricRanges.weightKg);

  if (hasValidTargetWeight && targetWeightKg < currentWeightKg) {
    recommendedCalories = Math.round(tdee - 500);
    calorieNote = "Deficit moderato per supportare la perdita di peso.";
  } else if (hasValidTargetWeight && targetWeightKg > currentWeightKg) {
    recommendedCalories = Math.round(tdee + 250);
    calorieNote = "Surplus moderato per supportare l'aumento di peso.";
  }

  const protein = Math.round(currentWeightKg * 2);
  const fats = Math.round((recommendedCalories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((recommendedCalories - protein * 4 - fats * 9) / 4));

  return {
    tdee,
    calories: recommendedCalories,
    protein,
    carbs,
    fats,
    note: `Basato su un livello di attivita ${getActivityLabel(personal.activityLevel)}.`,
    calorieNote,
  };
}

function renderBmiDisplayValue(bmiDisplay, bmi) {
  if (!bmiDisplay) {
    return;
  }

  const label = document.createElement("em");
  label.textContent = getBmiLabel(bmi);

  bmiDisplay.replaceChildren(
    document.createTextNode(bmi ? bmi.toFixed(1) : "--"),
    document.createTextNode(" "),
    label
  );
}

function renderProfile() {
  const form = document.querySelector("[data-profile-form]");

  if (!form) {
    return;
  }

  const { personal, medical, goals } = appState.profile;

  form.elements.fullName.value = personal.fullName;
  form.elements.age.value = personal.age;
  form.elements.gender.value = personal.gender;
  form.elements.heightCm.value = personal.heightCm;
  form.elements.currentWeightKg.value = personal.currentWeightKg;
  form.elements.targetWeightKg.value = personal.targetWeightKg;
  form.elements.activityLevel.value = personal.activityLevel;

  form.elements.allergies.value = medical.allergies;
  form.elements.medications.value = medical.medications;
  form.elements.medicalConditions.value = medical.medicalConditions;
  form.elements.dietaryPreferences.value = medical.dietaryPreferences;
  form.elements.primaryObjective.value = goals.primaryObjective || "";
  form.elements.secondaryObjective.value = goals.secondaryObjective || "";
  form.elements.healthFocus.value = goals.healthFocus || "";
  toggleHealthFocusField(goals.primaryObjective || "");

  form.elements.goalCalories.value = goals.calories;
  form.elements.goalProtein.value = goals.protein;
  form.elements.goalCarbs.value = goals.carbs;
  form.elements.goalFats.value = goals.fats;
  form.elements.goalWater.value = goals.water;
  renderMedicalLabMetrics();

  document.querySelectorAll("[data-diet-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.dietType === personal.dietType);
  });

  const bmi = calculateBmi(normalizeNumber(personal.heightCm), normalizeNumber(personal.currentWeightKg));
  const bmiDisplay = document.querySelector("[data-bmi-display]");
  renderBmiDisplayValue(bmiDisplay, bmi);

  const recommendations = calculateProfileRecommendations(personal);

  const recommendationMap = {
    tdee: recommendations.tdee ? `${recommendations.tdee} kcal` : "--",
    calories: recommendations.calories ? `${recommendations.calories} kcal` : "--",
    protein: recommendations.protein ? `${recommendations.protein}g` : "--",
    carbs: recommendations.carbs ? `${recommendations.carbs}g` : "--",
    fats: recommendations.fats ? `${recommendations.fats}g` : "--",
  };

  Object.entries(recommendationMap).forEach(([key, value]) => {
    const element = document.querySelector(`[data-profile-recommendation="${key}"]`);

    if (element) {
      element.textContent = value;
    }
  });

  const note = document.querySelector("[data-profile-recommendation-note]");
  const calorieNote = document.querySelector("[data-profile-goal-note]");

  if (note) {
    note.textContent = recommendations.note;
  }

  if (calorieNote) {
    calorieNote.textContent = recommendations.calorieNote;
  }

  renderProgress();
  renderDevices();
}

function setupProfileSection() {
  const form = document.querySelector("[data-profile-form]");
  const applyButton = document.querySelector("[data-apply-profile-recommendations]");
  const profileSaveButton = document.querySelector("[data-profile-save-button]");
  const goalsSaveButton = document.querySelector("[data-goals-save-button]");

  if (!form || !applyButton || !profileSaveButton || !goalsSaveButton) {
    return;
  }

  bindFormValidationFeedback(form);

  const buildProfileSectionPayload = () => ({
    personal: {
      fullName: String(form.elements.fullName.value).trim(),
      age: normalizeNumber(form.elements.age.value),
      gender: form.elements.gender.value,
      heightCm: normalizeNumber(form.elements.heightCm.value),
      currentWeightKg: normalizeNumber(form.elements.currentWeightKg.value),
      targetWeightKg: normalizeNumber(form.elements.targetWeightKg.value),
      activityLevel: form.elements.activityLevel.value,
      dietType: appState.profile.personal.dietType,
    },
    medical: {
      allergies: String(form.elements.allergies.value).trim(),
      medications: String(form.elements.medications.value).trim(),
      medicalConditions: String(form.elements.medicalConditions.value).trim(),
      dietaryPreferences: String(form.elements.dietaryPreferences.value).trim(),
      labMetrics: normalizeMedicalLabMetrics(appState.profile.medical.labMetrics),
    },
    goals: {
      primaryObjective: form.elements.primaryObjective.value,
      secondaryObjective: form.elements.secondaryObjective.value,
      healthFocus: String(form.elements.healthFocus.value || "").trim(),
    },
  });

  const buildDailyGoalsPayload = () => ({
    calories: normalizeNumber(form.elements.goalCalories.value),
    protein: normalizeNumber(form.elements.goalProtein.value),
    carbs: normalizeNumber(form.elements.goalCarbs.value),
    fats: normalizeNumber(form.elements.goalFats.value),
    water: normalizeNumber(form.elements.goalWater.value),
  });

  const submitProfileDetails = () => {
    const controls = [
      form.elements.fullName,
      form.elements.age,
      form.elements.heightCm,
      form.elements.currentWeightKg,
      form.elements.targetWeightKg,
      form.elements.activityLevel,
    ];

    if (form.elements.healthFocus.required) {
      controls.push(form.elements.healthFocus);
    }

    if (!validateControlGroup(controls)) {
      return false;
    }

    const nextSections = buildProfileSectionPayload();

    appState.profile = {
      ...appState.profile,
      personal: nextSections.personal,
      medical: nextSections.medical,
      goals: {
        ...appState.profile.goals,
        ...nextSections.goals,
      },
    };
    captureTodayProgressSnapshot({
      weightKg: nextSections.personal.currentWeightKg,
    });
    saveState();
    renderProfile();
    renderProgress();
    resetFormValidationState(form);
    showProfileSaveConfirmation();
    return true;
  };

  const submitDailyGoals = () => {
    const controls = [
      form.elements.goalCalories,
      form.elements.goalProtein,
      form.elements.goalCarbs,
      form.elements.goalFats,
      form.elements.goalWater,
    ];

    if (!validateControlGroup(controls)) {
      return false;
    }

    appState.profile = {
      ...appState.profile,
      goals: {
        ...appState.profile.goals,
        ...buildDailyGoalsPayload(),
      },
    };
    syncNutritionGoalsFromProfile();
    saveState();
    renderProfile();
    renderNutrition();
    resetFormValidationState(form);
    showGoalsSaveConfirmation();
    return true;
  };

  const submitFullProfile = () => {
    const didSaveProfile = submitProfileDetails();

    if (!didSaveProfile) {
      return false;
    }

    const dailyGoals = buildDailyGoalsPayload();
    const hasValidDailyGoals = Object.values(dailyGoals).every((value) => value !== null && value >= 0);

    if (hasValidDailyGoals) {
      appState.profile = {
        ...appState.profile,
        goals: {
          ...appState.profile.goals,
          ...dailyGoals,
        },
      };
      syncNutritionGoalsFromProfile();
      captureTodayProgressSnapshot({
        weightKg: appState.profile.personal.currentWeightKg,
      });
      saveState();
      renderProfile();
      renderNutrition();
    }

    return true;
  };

  const medicalDocumentInput = document.querySelector("[data-medical-document-input]");
  const medicalDocumentAnalyzeButton = document.querySelector("[data-medical-document-analyze]");
  const medicalDocumentApplyButton = document.querySelector("[data-medical-document-apply]");
  const medicalDocumentClearButton = document.querySelector("[data-medical-document-clear]");
  const medicalDocumentReviewPanel = document.querySelector("[data-medical-document-review]");
  const medicalMetricsList = document.querySelector("[data-medical-metrics-list]");
  let latestMedicalDocumentAnalysis = null;

  const clearMedicalDocumentReview = () => {
    latestMedicalDocumentAnalysis = null;
    renderMedicalDocumentReview(null);

    if (medicalDocumentInput) {
      medicalDocumentInput.value = "";
    }
  };

  const applyMedicalDocumentAnalysis = () => {
    const metrics = normalizeMedicalLabMetrics(latestMedicalDocumentAnalysis?.metrics).map((metric) => ({
      ...metric,
      sourceName: latestMedicalDocumentAnalysis?.documentType || "Documento medico",
      documentDate: metric.documentDate || latestMedicalDocumentAnalysis?.documentDate || "",
    }));

    if (metrics.length === 0) {
      setMedicalDocumentStatus("Nessun valore da applicare.", "error");
      return;
    }

    const existingMetrics = normalizeMedicalLabMetrics(appState.profile.medical.labMetrics);
    const nextLabMetrics = [...metrics, ...existingMetrics].slice(0, 40);
    const nextConditions = syncMedicalConditionsFieldFromLabMetrics(form, nextLabMetrics);
    const healthFocus = inferHealthFocusFromMetrics(metrics);

    form.elements.medicalConditions.value = nextConditions;

    if (healthFocus) {
      form.elements.primaryObjective.value = "health-support";
      toggleHealthFocusField("health-support");
      form.elements.healthFocus.value = healthFocus;
    }

    appState.profile = {
      ...appState.profile,
      medical: {
        ...appState.profile.medical,
        allergies: String(form.elements.allergies.value).trim(),
        medications: String(form.elements.medications.value).trim(),
        medicalConditions: nextConditions,
        dietaryPreferences: String(form.elements.dietaryPreferences.value).trim(),
        labMetrics: nextLabMetrics,
      },
      goals: {
        ...appState.profile.goals,
        primaryObjective: form.elements.primaryObjective.value,
        secondaryObjective: form.elements.secondaryObjective.value,
        healthFocus: String(form.elements.healthFocus.value || "").trim(),
      },
    };

    saveState();
    renderProfile();
    clearMedicalDocumentReview();
    showProfileSaveConfirmation();
    setMedicalDocumentStatus("Valori applicati al profilo.", "success");
  };

  const setSavedMedicalMetricEditMode = (index, isEditing) => {
    const card = medicalMetricsList?.querySelector(`[data-medical-metric-card="${index}"]`);

    if (!card) {
      return;
    }

    card.classList.toggle("is-editing", isEditing);
    card.querySelector(".medical-metric-display").hidden = isEditing;
    card.querySelector("[data-medical-metric-edit-form]").hidden = !isEditing;
    card.querySelector("[data-medical-metric-edit]").hidden = isEditing;
    card.querySelector("[data-medical-metric-delete]").hidden = isEditing;
    card.querySelector("[data-medical-metric-save]").hidden = !isEditing;
    card.querySelector("[data-medical-metric-cancel]").hidden = !isEditing;
  };

  const readSavedMedicalMetricEdit = (index) => {
    const editContainer = medicalMetricsList?.querySelector(`[data-medical-metric-edit-form="${index}"]`);
    const existingMetric = normalizeMedicalLabMetrics(appState.profile.medical.labMetrics)[index] || {};

    if (!editContainer) {
      return null;
    }

    return normalizeMedicalLabMetrics([
      {
        ...existingMetric,
        label: editContainer.querySelector('[name="label"]')?.value,
        value: editContainer.querySelector('[name="value"]')?.value,
        unit: editContainer.querySelector('[name="unit"]')?.value,
        referenceRange: editContainer.querySelector('[name="referenceRange"]')?.value,
        status: editContainer.querySelector('[name="status"]')?.value,
      },
    ])[0];
  };

  const persistLabMetricsFromCards = (metrics, message) => {
    const nextMetrics = normalizeMedicalLabMetrics(metrics);
    const nextConditions = syncMedicalConditionsFieldFromLabMetrics(form, nextMetrics);

    appState.profile = {
      ...appState.profile,
      medical: {
        ...appState.profile.medical,
        allergies: String(form.elements.allergies.value).trim(),
        medications: String(form.elements.medications.value).trim(),
        medicalConditions: nextConditions,
        dietaryPreferences: String(form.elements.dietaryPreferences.value).trim(),
        labMetrics: nextMetrics,
      },
    };

    saveState();
    renderProfile();
    setMedicalDocumentStatus(message, "success");
  };

  medicalDocumentInput?.addEventListener("change", () => {
    const file = medicalDocumentInput.files?.[0];
    latestMedicalDocumentAnalysis = null;
    renderMedicalDocumentReview(null);

    if (!file) {
      setMedicalDocumentStatus("", "");
      return;
    }

    if (!isSupportedMedicalDocumentFile(file)) {
      setMedicalDocumentStatus("Formato non supportato. Usa foto, PDF o Word .docx.", "error");
      return;
    }

    if (file.size > MEDICAL_DOCUMENT_MAX_FILE_BYTES) {
      setMedicalDocumentStatus("Documento troppo grande. Carica un file piu leggero.", "error");
      return;
    }

    setMedicalDocumentStatus(`File caricato: ${file.name} (${formatMedicalDocumentFileSize(file.size)}). Pronto per l'analisi.`, "success");
  });

  const updateMedicalDocumentDraftField = (event) => {
    const fieldConfig = event.target.closest("[data-medical-document-field]")?.dataset.medicalDocumentField;

    if (!fieldConfig || !latestMedicalDocumentAnalysis) {
      return;
    }

    const [indexValue, fieldName] = fieldConfig.split(":");
    const index = Number(indexValue);
    const metrics = normalizeMedicalLabMetrics(latestMedicalDocumentAnalysis.metrics);

    if (!Number.isInteger(index) || !metrics[index] || !fieldName) {
      return;
    }

    metrics[index] = {
      ...metrics[index],
      [fieldName]: event.target.value,
    };
    latestMedicalDocumentAnalysis = {
      ...latestMedicalDocumentAnalysis,
      metrics,
    };
  };

  medicalDocumentReviewPanel?.addEventListener("input", updateMedicalDocumentDraftField);
  medicalDocumentReviewPanel?.addEventListener("change", updateMedicalDocumentDraftField);

  medicalDocumentReviewPanel?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-medical-document-delete]");

    if (!deleteButton || !latestMedicalDocumentAnalysis) {
      return;
    }

    const index = Number(deleteButton.dataset.medicalDocumentDelete);
    const metrics = normalizeMedicalLabMetrics(latestMedicalDocumentAnalysis.metrics).filter((_, metricIndex) => metricIndex !== index);
    latestMedicalDocumentAnalysis = {
      ...latestMedicalDocumentAnalysis,
      metrics,
    };
    renderMedicalDocumentReview(latestMedicalDocumentAnalysis);
    setMedicalDocumentStatus(metrics.length ? "Valore rimosso dalla proposta." : "Nessun valore rimasto nella proposta.", metrics.length ? "success" : "");
  });

  medicalMetricsList?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-medical-metric-edit]");
    const saveButton = event.target.closest("[data-medical-metric-save]");
    const cancelButton = event.target.closest("[data-medical-metric-cancel]");
    const deleteButton = event.target.closest("[data-medical-metric-delete]");

    if (editButton) {
      setSavedMedicalMetricEditMode(Number(editButton.dataset.medicalMetricEdit), true);
      return;
    }

    if (cancelButton) {
      renderMedicalLabMetrics();
      return;
    }

    if (saveButton) {
      const index = Number(saveButton.dataset.medicalMetricSave);
      const metrics = normalizeMedicalLabMetrics(appState.profile.medical.labMetrics);
      const editedMetric = readSavedMedicalMetricEdit(index);

      if (!editedMetric) {
        setMedicalDocumentStatus("Inserisci almeno nome e valore per salvare la card.", "error");
        return;
      }

      metrics[index] = editedMetric;
      persistLabMetricsFromCards(metrics, "Valore aggiornato.");
      return;
    }

    if (deleteButton) {
      const index = Number(deleteButton.dataset.medicalMetricDelete);
      const metrics = normalizeMedicalLabMetrics(appState.profile.medical.labMetrics).filter((_, metricIndex) => metricIndex !== index);
      persistLabMetricsFromCards(metrics, "Valore eliminato dal profilo.");
    }
  });

  document.querySelectorAll("[data-diet-type]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.profile.personal.dietType = button.dataset.dietType;
      renderProfile();
    });
  });

  form.addEventListener("input", (event) => {
    const relevantFields = ["age", "gender", "heightCm", "currentWeightKg", "targetWeightKg", "activityLevel"];

    if (relevantFields.includes(event.target.name)) {
      const draftPersonal = {
        ...appState.profile.personal,
        age: form.elements.age.value,
        gender: form.elements.gender.value,
        heightCm: form.elements.heightCm.value,
        currentWeightKg: form.elements.currentWeightKg.value,
        targetWeightKg: form.elements.targetWeightKg.value,
        activityLevel: form.elements.activityLevel.value,
      };

      const bmi = calculateBmi(normalizeNumber(draftPersonal.heightCm), normalizeNumber(draftPersonal.currentWeightKg));
      const bmiDisplay = document.querySelector("[data-bmi-display]");
      renderBmiDisplayValue(bmiDisplay, bmi);

      const recommendations = calculateProfileRecommendations(draftPersonal);

      const recommendationMap = {
        tdee: recommendations.tdee ? `${recommendations.tdee} kcal` : "--",
        calories: recommendations.calories ? `${recommendations.calories} kcal` : "--",
        protein: recommendations.protein ? `${recommendations.protein}g` : "--",
        carbs: recommendations.carbs ? `${recommendations.carbs}g` : "--",
        fats: recommendations.fats ? `${recommendations.fats}g` : "--",
      };

      Object.entries(recommendationMap).forEach(([key, value]) => {
        const element = document.querySelector(`[data-profile-recommendation="${key}"]`);

        if (element) {
          element.textContent = value;
        }
      });

      const note = document.querySelector("[data-profile-recommendation-note]");
      const calorieNote = document.querySelector("[data-profile-goal-note]");

      if (note) {
        note.textContent = recommendations.note;
      }

      if (calorieNote) {
        calorieNote.textContent = recommendations.calorieNote;
      }
    }
  });

  form.elements.primaryObjective.addEventListener("change", () => {
    toggleHealthFocusField(form.elements.primaryObjective.value);
    updateFormValidationStyles(form);
  });

  applyButton.addEventListener("click", () => {
    const recommendations = calculateProfileRecommendations({
      ...appState.profile.personal,
      age: form.elements.age.value,
      gender: form.elements.gender.value,
      heightCm: form.elements.heightCm.value,
      currentWeightKg: form.elements.currentWeightKg.value,
      targetWeightKg: form.elements.targetWeightKg.value,
      activityLevel: form.elements.activityLevel.value,
    });

    if (!recommendations.calories) {
      return;
    }

    form.elements.goalCalories.value = recommendations.calories;
    form.elements.goalProtein.value = recommendations.protein;
    form.elements.goalCarbs.value = recommendations.carbs;
    form.elements.goalFats.value = recommendations.fats;

    submitDailyGoals();
  });

  medicalDocumentAnalyzeButton?.addEventListener("click", async () => {
    const file = medicalDocumentInput?.files?.[0];

    try {
      medicalDocumentAnalyzeButton.disabled = true;
      setMedicalDocumentStatus("Analisi del documento in corso...", "");
      latestMedicalDocumentAnalysis = await analyzeMedicalDocumentFile(file);
      renderMedicalDocumentReview(latestMedicalDocumentAnalysis);
      setMedicalDocumentStatus("Valori rilevati. Verifica il riepilogo prima di applicarli.", "success");
    } catch (error) {
      latestMedicalDocumentAnalysis = null;
      renderMedicalDocumentReview(null);
      setMedicalDocumentStatus(error.message || "Impossibile analizzare il documento.", "error");
    } finally {
      medicalDocumentAnalyzeButton.disabled = false;
    }
  });

  medicalDocumentApplyButton?.addEventListener("click", applyMedicalDocumentAnalysis);

  medicalDocumentClearButton?.addEventListener("click", () => {
    clearMedicalDocumentReview();
    setMedicalDocumentStatus("Documento scartato.", "");
  });

  profileSaveButton.addEventListener("click", submitFullProfile);
  goalsSaveButton.addEventListener("click", submitDailyGoals);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitFullProfile();
  });

  renderProfile();
}

setupProfileSection();
