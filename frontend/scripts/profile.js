function setProfileFeedback(message) {
  const feedback = document.querySelector("[data-profile-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

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
    light: "poco attivo",
    moderate: "moderato",
    active: "attivo",
    "very-active": "molto attivo",
  };

  return labels[level] || labels.moderate;
}

function calculateProfileRecommendations(personal) {
  const age = normalizeNumber(personal.age);
  const heightCm = normalizeNumber(personal.heightCm);
  const currentWeightKg = normalizeNumber(personal.currentWeightKg);
  const targetWeightKg = normalizeNumber(personal.targetWeightKg);
  const gender = personal.gender || "male";

  if (!age || !heightCm || !currentWeightKg) {
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

  if (targetWeightKg && targetWeightKg < currentWeightKg) {
    recommendedCalories = Math.round(tdee - 500);
    calorieNote = "Deficit moderato per supportare la perdita di peso.";
  } else if (targetWeightKg && targetWeightKg > currentWeightKg) {
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
  form.elements.bloodType.value = medical.bloodType;

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

  if (bmiDisplay) {
    bmiDisplay.innerHTML = bmi
      ? `${bmi.toFixed(1)} <em>${getBmiLabel(bmi)}</em>`
      : `-- <em>${getBmiLabel(bmi)}</em>`;
  }

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

  if (!form || !applyButton) {
    return;
  }

  bindFormValidationFeedback(form);

  document.querySelectorAll("[data-diet-type]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.profile.personal.dietType = button.dataset.dietType;
      renderProfile();
      setProfileFeedback("Salva per conservare le preferenze alimentari.");
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

      if (bmiDisplay) {
        bmiDisplay.innerHTML = bmi
          ? `${bmi.toFixed(1)} <em>${getBmiLabel(bmi)}</em>`
          : `-- <em>${getBmiLabel(bmi)}</em>`;
      }

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
    setProfileFeedback("Obiettivi consigliati applicati. Salva il profilo per mantenerli.");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const nextProfile = {
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
        bloodType: form.elements.bloodType.value,
      },
      goals: {
        calories: normalizeNumber(form.elements.goalCalories.value),
        protein: normalizeNumber(form.elements.goalProtein.value),
        carbs: normalizeNumber(form.elements.goalCarbs.value),
        fats: normalizeNumber(form.elements.goalFats.value),
        water: normalizeNumber(form.elements.goalWater.value),
      },
    };

    const requiredValues = [
      nextProfile.personal.fullName,
      nextProfile.personal.age,
      nextProfile.personal.heightCm,
      nextProfile.personal.currentWeightKg,
      nextProfile.personal.targetWeightKg,
      nextProfile.personal.activityLevel,
      nextProfile.goals.calories,
      nextProfile.goals.protein,
      nextProfile.goals.carbs,
      nextProfile.goals.fats,
      nextProfile.goals.water,
    ];

    if (requiredValues.some((value) => value === null || value === "")) {
      setProfileFeedback("Completa i campi obbligatori.");
      return;
    }

    appState.profile = nextProfile;
    syncNutritionGoalsFromProfile();
    captureTodayProgressSnapshot({
      weightKg: nextProfile.personal.currentWeightKg,
    });
    saveState();
    renderProfile();
    renderNutrition();
    resetFormValidationState(form);
    setProfileFeedback("Profilo salvato e sincronizzato.");
  });

  renderProfile();
}

setupProfileSection();
