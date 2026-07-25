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

function setProfileFeedback(message) {
  const feedback = document.querySelector("[data-profile-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
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

function isProfileMetricInRange(value, range) {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
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
    setProfileFeedback("Profilo salvato e sincronizzato.");
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
    setProfileFeedback("Obiettivi nutrizionali salvati.");
    return true;
  };

  const submitFullProfile = () => {
    const didSaveProfile = submitProfileDetails();

    if (!didSaveProfile) {
      setProfileFeedback("Completa i campi obbligatori del profilo.");
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

    setProfileFeedback("Profilo salvato e sincronizzato.");
    return true;
  };

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
      setProfileFeedback("Completa eta, altezza e peso prima di applicare le raccomandazioni.");
      return;
    }

    form.elements.goalCalories.value = recommendations.calories;
    form.elements.goalProtein.value = recommendations.protein;
    form.elements.goalCarbs.value = recommendations.carbs;
    form.elements.goalFats.value = recommendations.fats;

    submitDailyGoals();
    setProfileFeedback("Obiettivi consigliati applicati e salvati.");
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
