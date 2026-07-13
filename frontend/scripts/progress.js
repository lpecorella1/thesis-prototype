function setProgressFeedback(message) {
  const feedback = document.querySelector("[data-progress-feedback]");

  if (feedback) {
    feedback.textContent = message;
  }
}

function getProgressLogByDate(dateKey) {
  return appState.progress.dailyLogs.find((entry) => entry.date === dateKey) || null;
}

function getResolvedProgressEntry(dateKey) {
  const log = getProgressLogByDate(dateKey);
  const todayKey = getTodayDateKey();
  const nutritionTotals = getNutritionTotalsForDate(dateKey);
  const autoSnapshot = getProgressAutoSnapshot(dateKey);
  const currentWeight = normalizeNumber(appState.profile.personal.currentWeightKg);
  const autoCalories = nutritionTotals.count > 0 ? nutritionTotals.calories : autoSnapshot?.calories ?? null;
  const autoProtein = nutritionTotals.count > 0 ? nutritionTotals.protein : autoSnapshot?.protein ?? null;
  const autoWeight = dateKey === todayKey ? currentWeight : autoSnapshot?.weightKg ?? null;

  return {
    date: dateKey,
    calories: log?.calories ?? autoCalories,
    protein: log?.protein ?? autoProtein,
    waterGlasses: log?.waterGlasses ?? null,
    weightKg: log?.weightKg ?? autoWeight,
    hasManualLog: Boolean(log),
    nutritionMealCount: nutritionTotals.count,
    isAutoNutrition: (log?.calories == null || log?.protein == null) && (autoCalories != null || autoProtein != null),
    isAutoWeight: log?.weightKg == null && autoWeight != null,
    hasAutoSnapshot: Boolean(autoSnapshot),
  };
}

function getProgressSeries() {
  return getRecentDateKeys(getProgressRangeDays()).map(getResolvedProgressEntry);
}

function getLastKnownWeight(series) {
  const reversed = [...series].reverse();
  const entry = reversed.find((item) => item.weightKg != null);
  return entry?.weightKg ?? normalizeNumber(appState.profile.personal.currentWeightKg);
}

function calculateAverage(values) {
  const filteredValues = values.filter((value) => value != null);

  if (filteredValues.length === 0) {
    return null;
  }

  return filteredValues.reduce((sum, value) => sum + value, 0) / filteredValues.length;
}

function buildLineChartMarkup(values, color) {
  const width = 760;
  const height = 250;
  const paddingX = 85;
  const top = 45;
  const bottom = 210;
  const usableWidth = width - paddingX * 2;
  const filteredValues = values.filter((value) => value != null);
  const numericValues = values.map((value) => (value == null ? null : Number(value)));

  if (filteredValues.length === 0) {
    const gridLines = [top, 86, 127, 168, bottom]
      .map((y) => `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>`)
      .join("");

    return `
      <g class="grid">${gridLines}</g>
      <text class="chart-empty-label" x="${width / 2}" y="${height / 2}" text-anchor="middle">Nessun dato disponibile</text>
    `;
  }

  const minValue = Math.min(...filteredValues);
  const maxValue = Math.max(...filteredValues);
  const range = maxValue - minValue || 1;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;
  const gradientId = `progressGradient${color}${values.length}`;
  const strokeClass = color === "purple" ? "line-purple" : "line-green";
  const areaClass = color === "purple" ? "area-purple" : "area-green";
  const pointClass = color === "purple" ? "point-purple" : "point-green";

  const points = numericValues.map((value, index) => {
    if (value == null) {
      return null;
    }

    const x = paddingX + stepX * index;
    const y = bottom - ((value - minValue) / range) * (bottom - top);
    return { x, y };
  });

  const gridLines = [top, 86, 127, 168, bottom]
    .map((y) => `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>`)
    .join("");
  const pathSegments = [];
  let activeSegment = [];

  points.forEach((point) => {
    if (!point) {
      if (activeSegment.length > 0) {
        pathSegments.push(activeSegment);
        activeSegment = [];
      }
      return;
    }

    activeSegment.push(point);
  });

  if (activeSegment.length > 0) {
    pathSegments.push(activeSegment);
  }

  const linePath = pathSegments
    .map((segment) => segment.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" "))
    .join(" ");
  const circles = points
    .filter(Boolean)
    .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5"></circle>`)
    .join("");
  const largestSegment = pathSegments.reduce(
    (largest, segment) => (segment.length > largest.length ? segment : largest),
    []
  );
  const areaPath =
    largestSegment.length >= 2
      ? `${largestSegment.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")} L${largestSegment[largestSegment.length - 1].x} ${bottom} L${largestSegment[0].x} ${bottom} Z`
      : "";

  return `
    <defs>
      <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color === "purple" ? "#7d58ff" : "#14a16d"}" stop-opacity="0.16" />
        <stop offset="100%" stop-color="${color === "purple" ? "#7d58ff" : "#14a16d"}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <g class="grid">${gridLines}</g>
    ${areaPath ? `<path class="area ${areaClass}" style="fill:url(#${gradientId})" d="${areaPath}"></path>` : ""}
    <path class="line ${strokeClass}" d="${linePath}"></path>
    <g class="points ${pointClass}">${circles}</g>
  `;
}

function renderBarChart(values, barsSelector, labelsSelector) {
  const bars = document.querySelector(barsSelector);
  const labels = document.querySelector(labelsSelector);

  if (!bars || !labels) {
    return;
  }

  const numericValues = values.map((entry) => entry.value ?? 0);
  const maxValue = Math.max(...numericValues, 1);
  const minChartWidth = Math.max(320, values.length * 62);

  bars.style.minWidth = `${minChartWidth}px`;
  labels.style.minWidth = `${minChartWidth}px`;

  bars.innerHTML = values
    .map((entry) => {
      const height = Math.max(16, Math.round(((entry.value ?? 0) / maxValue) * 110));
      return `<span style="height:${height}px" title="${escapeHtml(`${entry.label}: ${entry.value ?? 0}`)}"></span>`;
    })
    .join("");

  labels.innerHTML = values.map((entry) => `<span>${escapeHtml(entry.label)}</span>`).join("");
}

function setLineChartMinWidth(chartElement, pointCount, pixelsPerPoint = 84) {
  if (!chartElement) {
    return;
  }

  const minChartWidth = Math.max(320, pointCount * pixelsPerPoint);
  chartElement.style.minWidth = `${minChartWidth}px`;
}

function renderProgressStats(series) {
  const container = document.querySelector("[data-progress-stats]");

  if (!container) {
    return;
  }

  const weights = series.map((entry) => entry.weightKg).filter((value) => value != null);
  const firstWeight = weights[0] ?? normalizeNumber(appState.profile.personal.currentWeightKg);
  const currentWeight = getLastKnownWeight(series);
  const weightDelta = firstWeight != null && currentWeight != null ? currentWeight - firstWeight : null;
  const avgCalories = calculateAverage(series.map((entry) => entry.calories));
  const avgProtein = calculateAverage(series.map((entry) => entry.protein));

  container.innerHTML = `
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-weight-delta">
      <span class="progress-mini-stat-accent">Trend</span>
      <h3>Variazione peso</h3>
      <strong>${weightDelta == null ? "--" : `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`}</strong>
    </article>
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-weight-current">
      <span class="progress-mini-stat-accent">Oggi</span>
      <h3>Peso attuale</h3>
      <strong>${currentWeight == null ? "--" : `${currentWeight.toFixed(1)} kg`}</strong>
    </article>
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-calories">
      <span class="progress-mini-stat-accent">Media</span>
      <h3>Calorie</h3>
      <strong>${avgCalories == null ? "--" : `${Math.round(avgCalories)} kcal`}</strong>
    </article>
    <article class="mini-stat-card progress-mini-stat progress-mini-stat-protein">
      <span class="progress-mini-stat-accent">Media</span>
      <h3>Proteine</h3>
      <strong>${avgProtein == null ? "--" : `${Math.round(avgProtein)} g`}</strong>
    </article>
  `;
}

function renderProgressCurrentDayCard() {
  const container = document.querySelector("[data-progress-current-day]");

  if (!container) {
    return;
  }

  const todayEntry = getResolvedProgressEntry(getTodayDateKey());
  const waterGoal = normalizeNumber(appState.profile.goals.water) || 0;
  const nutritionSourceLabel =
    todayEntry.nutritionMealCount > 0
      ? `${todayEntry.nutritionMealCount} ${todayEntry.nutritionMealCount === 1 ? "pasto registrato" : "pasti registrati"}`
      : todayEntry.hasAutoSnapshot
        ? "snapshot automatico salvato"
        : "nessun pasto registrato";

  container.innerHTML = `
    <div class="progress-current-day-card">
      <strong>Oggi</strong>
      <span>Calorie: ${todayEntry.calories ?? "--"} kcal</span>
      <span>Proteine: ${todayEntry.protein ?? "--"} g</span>
      <span>Peso: ${todayEntry.weightKg == null ? "--" : `${todayEntry.weightKg.toFixed(1)} kg`}</span>
      <span>Acqua: ${todayEntry.waterGlasses ?? "--"} / ${waterGoal || "--"} bicchieri</span>
      <span>Dieta: ${nutritionSourceLabel}</span>
    </div>
  `;
}

function renderProgressSourceList() {
  const container = document.querySelector("[data-progress-source-list]");

  if (!container) {
    return;
  }

  const todayEntry = getResolvedProgressEntry(getTodayDateKey());
  const snapshot = getProgressAutoSnapshot(getTodayDateKey());
  const items = [
    {
      title: "Dieta",
      body:
        todayEntry.nutritionMealCount > 0
          ? `${todayEntry.nutritionMealCount} ${todayEntry.nutritionMealCount === 1 ? "pasto contribuisce" : "pasti contribuiscono"} ai grafici di oggi.`
          : snapshot?.calories != null || snapshot?.protein != null
            ? "Uso l'ultimo snapshot giornaliero salvato in automatico."
            : "Nessun dato nutrizionale storico disponibile per oggi.",
    },
    {
      title: "Dati",
      body:
        todayEntry.weightKg != null
          ? `Peso corrente disponibile: ${todayEntry.weightKg.toFixed(1)} kg.`
          : "Nessun peso disponibile dall'area Dati per oggi.",
    },
  ];

  container.innerHTML = items
    .map(
      (item) => `
        <article class="progress-source-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.body)}</span>
        </article>
      `
    )
    .join("");
}

function renderProgressCharts(series) {
  const calorieChart = document.querySelector("[data-progress-calorie-chart]");
  const weightChart = document.querySelector("[data-progress-weight-chart]");

  if (calorieChart) {
    setLineChartMinWidth(calorieChart, series.length);
    calorieChart.innerHTML = buildLineChartMarkup(series.map((entry) => entry.calories), "green");
  }

  if (weightChart) {
    setLineChartMinWidth(weightChart, series.length);
    weightChart.innerHTML = buildLineChartMarkup(series.map((entry) => entry.weightKg), "purple");
  }

  renderBarChart(
    series.map((entry) => ({ label: formatShortDayLabel(entry.date), value: entry.waterGlasses })),
    "[data-progress-water-bars]",
    "[data-progress-water-labels]"
  );
}

function syncProgressChartViewport() {
  const shells = document.querySelectorAll("[data-progress-section] .chart-scroll-shell");

  if (!shells.length) {
    return;
  }

  const isCompactViewport = window.matchMedia("(max-width: 840px)").matches;

  requestAnimationFrame(() => {
    shells.forEach((shell) => {
      if (!isCompactViewport) {
        shell.scrollLeft = 0;
        return;
      }

      shell.scrollLeft = shell.scrollWidth - shell.clientWidth;
    });
  });
}

function renderProgress() {
  const series = getProgressSeries();
  const form = document.querySelector("[data-progress-log-form]");

  document.querySelectorAll("[data-progress-range]").forEach((button) => {
    button.classList.toggle("range-btn-active", button.dataset.progressRange === appState.progress.selectedRange);
  });

  if (form && !form.elements.date.value) {
    form.elements.date.value = getTodayDateKey();
  }

  renderProgressStats(series);
  renderProgressCurrentDayCard();
  renderProgressSourceList();
  renderProgressCharts(series);
  syncProgressChartViewport();
}

function populateProgressForm(dateKey) {
  const form = document.querySelector("[data-progress-log-form]");
  const log = getProgressLogByDate(dateKey);

  if (!form) {
    return;
  }

  form.elements.date.value = dateKey;
  form.elements.weightKg.value = log?.weightKg ?? "";
  form.elements.waterGlasses.value = log?.waterGlasses ?? "";
  form.elements.calories.value = log?.calories ?? "";
  form.elements.protein.value = log?.protein ?? "";
}

function setupProgressSection() {
  const form = document.querySelector("[data-progress-log-form]");
  const deleteButton = document.querySelector("[data-progress-delete-log]");

  if (!form || !deleteButton) {
    return;
  }

  bindFormValidationFeedback(form);

  document.querySelectorAll("[data-progress-range]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.progress.selectedRange = button.dataset.progressRange;
      saveState();
      renderProgress();
    });
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "date") {
      populateProgressForm(form.elements.date.value);
      setProgressFeedback("");
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const date = String(form.elements.date.value || "").trim();

    if (!date) {
      setProgressFeedback("Seleziona una data valida.");
      return;
    }

    const nextLog = {
      date,
      weightKg: normalizeNumber(form.elements.weightKg.value),
      waterGlasses: normalizeNumber(form.elements.waterGlasses.value),
      calories: normalizeNumber(form.elements.calories.value),
      protein: normalizeNumber(form.elements.protein.value),
    };

    const hasAnyValue = [nextLog.weightKg, nextLog.waterGlasses, nextLog.calories, nextLog.protein].some(
      (value) => value != null
    );

    if (!hasAnyValue) {
      setProgressFeedback("Inserisci almeno un valore manuale oppure usa il pulsante di rimozione.");
      return;
    }

    appState.progress.dailyLogs = [
      ...appState.progress.dailyLogs.filter((entry) => entry.date !== date),
      nextLog,
    ].sort((firstEntry, secondEntry) => firstEntry.date.localeCompare(secondEntry.date));

    saveState();
    renderProgress();
    populateProgressForm(date);
    resetFormValidationState(form);
    setProgressFeedback("Progressi salvati.");
  });

  deleteButton.addEventListener("click", () => {
    const date = String(form.elements.date.value || "").trim();

    if (!date) {
      setProgressFeedback("Seleziona la data dei dati da rimuovere.");
      return;
    }

    const initialLength = appState.progress.dailyLogs.length;
    appState.progress.dailyLogs = appState.progress.dailyLogs.filter((entry) => entry.date !== date);

    if (initialLength === appState.progress.dailyLogs.length) {
      setProgressFeedback("Non ci sono dati da rimuovere.");
      return;
    }

    saveState();
    renderProgress();
    populateProgressForm(date);
    setProgressFeedback("Progressi rimossi.");
  });

  populateProgressForm(getTodayDateKey());
  renderProgress();
}
