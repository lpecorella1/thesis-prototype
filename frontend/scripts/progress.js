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

function formatProgressMetricValue(value, decimals = 0, suffix = "") {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }

  const roundedValue =
    decimals > 0 ? value.toFixed(decimals).replace(".", ",") : String(Math.round(value));

  return `${roundedValue}${suffix ? ` ${suffix}` : ""}`;
}

function getChartLabelIndexes(total, maxLabels = 5) {
  if (total <= 1) {
    return [0];
  }

  if (total <= maxLabels) {
    return Array.from({ length: total }, (_, index) => index);
  }

  const interiorSlots = Math.max(0, maxLabels - 2);
  const step = interiorSlots > 0 ? Math.max(1, Math.ceil((total - 1) / (interiorSlots + 1))) : total;
  const indexes = new Set([0, total - 1]);

  for (let index = step; index < total - 1 && indexes.size < maxLabels; index += step) {
    indexes.add(index);
  }

  return [...indexes].sort((left, right) => left - right);
}

function getProgressChartLayout() {
  const isMobileViewport = window.matchMedia("(max-width: 640px)").matches;
  const isCompactViewport = window.matchMedia("(max-width: 840px)").matches;

  if (isMobileViewport) {
    return {
      paddingLeft: 44,
      paddingRight: 10,
      top: 18,
      bottom: 176,
      xLabelY: 204,
      tickCount: 3,
      maxLabels: 4,
      badgeHeight: 22,
    };
  }

  if (isCompactViewport) {
    return {
      paddingLeft: 50,
      paddingRight: 14,
      top: 20,
      bottom: 186,
      xLabelY: 214,
      tickCount: 4,
      maxLabels: 5,
      badgeHeight: 24,
    };
  }

  return {
    paddingLeft: 58,
    paddingRight: 18,
    top: 24,
    bottom: 194,
    xLabelY: 226,
    tickCount: 4,
    maxLabels: 5,
    badgeHeight: 24,
  };
}

function buildLineChartMarkup(values, labels, options) {
  const width = 760;
  const height = 260;
  const layout = getProgressChartLayout();
  const { paddingLeft, paddingRight, top, bottom, xLabelY } = layout;
  const usableWidth = width - paddingLeft - paddingRight;
  const filteredValues = values.filter((value) => value != null);
  const numericValues = values.map((value) => (value == null ? null : Number(value)));
  const labelIndexes = new Set(getChartLabelIndexes(labels.length, layout.maxLabels));

  if (filteredValues.length === 0) {
    const emptyTicks = [top, 80.5, 137, bottom];
    const gridLines = emptyTicks
      .map((y) => `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}"></line>`)
      .join("");
    const xLabels = labels
      .map((label, index) =>
        labelIndexes.has(index)
          ? `<text class="axis-label x-axis-label" x="${paddingLeft + (usableWidth * index) / Math.max(labels.length - 1, 1)}" y="${xLabelY}" text-anchor="middle">${escapeHtml(label)}</text>`
          : ""
      )
      .join("");

    return `
      <g class="grid">${gridLines}</g>
      <g class="x-axis-labels">${xLabels}</g>
      <text class="chart-empty-label" x="${width / 2}" y="${height / 2}" text-anchor="middle">Nessun dato disponibile</text>
    `;
  }

  const minValue = Math.min(...filteredValues);
  const maxValue = Math.max(...filteredValues);
  const chartPadding = Math.max((maxValue - minValue) * 0.16, maxValue === minValue ? Math.max(maxValue * 0.06, 1) : 1);
  const domainMin = Math.max(0, minValue - chartPadding);
  const domainMax = maxValue + chartPadding;
  const range = domainMax - domainMin || 1;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;
  const gradientId = `progressGradient${options.color}${values.length}`;
  const strokeClass = options.color === "purple" ? "line-purple" : "line-green";
  const areaClass = options.color === "purple" ? "area-purple" : "area-green";
  const pointClass = options.color === "purple" ? "point-purple" : "point-green";

  const points = numericValues.map((value, index) => {
    if (value == null) {
      return null;
    }

    const x = paddingLeft + stepX * index;
    const y = bottom - ((value - domainMin) / range) * (bottom - top);
    return { x, y };
  });

  const tickCount = layout.tickCount;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    const value = domainMax - ratio * (domainMax - domainMin);
    const y = top + ratio * (bottom - top);

    return {
      y,
      value,
    };
  });

  const gridLines = ticks
    .map((tick) => `<line x1="${paddingLeft}" y1="${tick.y}" x2="${width - paddingRight}" y2="${tick.y}"></line>`)
    .join("");
  const yAxisLabels = ticks
    .map(
      (tick) =>
        `<text class="axis-label" x="${paddingLeft - 10}" y="${tick.y + 4}" text-anchor="end">${escapeHtml(formatProgressMetricValue(tick.value, options.decimals, options.unit))}</text>`
    )
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
    .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${layout.maxLabels <= 4 ? 4 : 5}"></circle>`)
    .join("");
  const largestSegment = pathSegments.reduce(
    (largest, segment) => (segment.length > largest.length ? segment : largest),
    []
  );
  const areaPath =
    largestSegment.length >= 2
      ? `${largestSegment.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")} L${largestSegment[largestSegment.length - 1].x} ${bottom} L${largestSegment[0].x} ${bottom} Z`
      : "";
  const xAxisLabels = labels
    .map((label, index) => {
      if (!labelIndexes.has(index)) {
        return "";
      }

      const x = paddingLeft + stepX * index;
      return `<text class="axis-label x-axis-label" x="${x}" y="${xLabelY}" text-anchor="middle">${escapeHtml(label)}</text>`;
    })
    .join("");
  const lastPointIndex = points.reduce((latestIndex, point, index) => (point ? index : latestIndex), -1);
  const lastPoint = lastPointIndex >= 0 ? points[lastPointIndex] : null;
  const lastValue = lastPointIndex >= 0 ? numericValues[lastPointIndex] : null;
  const badgeWidth = Math.max(54, `${formatProgressMetricValue(lastValue, options.decimals, options.unit)}`.length * 7.2);
  const badgeX = lastPoint ? Math.min(width - paddingRight - badgeWidth, Math.max(paddingLeft, lastPoint.x - badgeWidth / 2)) : 0;
  const badgeY = lastPoint ? Math.max(8, lastPoint.y - (layout.badgeHeight + 10)) : 0;

  return `
    <defs>
      <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${options.color === "purple" ? "#7d58ff" : "#14a16d"}" stop-opacity="0.16" />
        <stop offset="100%" stop-color="${options.color === "purple" ? "#7d58ff" : "#14a16d"}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <g class="grid">${gridLines}</g>
    <g class="y-axis-labels">${yAxisLabels}</g>
    ${areaPath ? `<path class="area ${areaClass}" style="fill:url(#${gradientId})" d="${areaPath}"></path>` : ""}
    <path class="line ${strokeClass}" d="${linePath}"></path>
    <g class="points ${pointClass}">${circles}</g>
    ${
      lastPoint
        ? `<g class="point-value-badge"><rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${layout.badgeHeight}" rx="${layout.badgeHeight / 2}" ry="${layout.badgeHeight / 2}"></rect><text x="${badgeX + badgeWidth / 2}" y="${badgeY + layout.badgeHeight / 2 + 4}" text-anchor="middle">${escapeHtml(formatProgressMetricValue(lastValue, options.decimals, options.unit))}</text></g>`
        : ""
    }
    <g class="x-axis-labels">${xAxisLabels}</g>
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
  const visibleLabelIndexes = new Set(getChartLabelIndexes(values.length, getProgressChartLayout().maxLabels));

  bars.style.setProperty("--bar-count", values.length);
  labels.style.setProperty("--bar-count", values.length);

  bars.innerHTML = values
    .map((entry) => {
      const height = Math.max(16, Math.round(((entry.value ?? 0) / maxValue) * 118));
      return `
        <div class="bar-chart-item" title="${escapeHtml(`${entry.label}: ${entry.value ?? 0}`)}">
          <strong class="bar-value">${entry.value ?? 0}</strong>
          <span style="height:${height}px"></span>
        </div>
      `;
    })
    .join("");

  labels.innerHTML = values
    .map((entry, index) => `<span class="${visibleLabelIndexes.has(index) ? "" : "is-muted"}">${escapeHtml(entry.label)}</span>`)
    .join("");
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

function renderProgressCharts(series) {
  const calorieChart = document.querySelector("[data-progress-calorie-chart]");
  const weightChart = document.querySelector("[data-progress-weight-chart]");
  const labels = series.map((entry) => formatShortDayLabel(entry.date));

  if (calorieChart) {
    calorieChart.innerHTML = buildLineChartMarkup(series.map((entry) => entry.calories), labels, {
      color: "green",
      unit: "kcal",
      decimals: 0,
    });
  }

  if (weightChart) {
    weightChart.innerHTML = buildLineChartMarkup(series.map((entry) => entry.weightKg), labels, {
      color: "purple",
      unit: "kg",
      decimals: 1,
    });
  }

  renderBarChart(
    series.map((entry) => ({ label: formatShortDayLabel(entry.date), value: entry.waterGlasses })),
    "[data-progress-water-bars]",
    "[data-progress-water-labels]"
  );
}

function syncProgressChartViewport() {
  return;
}

let progressResizeFrame = 0;
let progressResizeBound = false;

function scheduleProgressResizeRender() {
  if (progressResizeFrame) {
    cancelAnimationFrame(progressResizeFrame);
  }

  progressResizeFrame = requestAnimationFrame(() => {
    progressResizeFrame = 0;
    renderProgress();
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

  if (!progressResizeBound) {
    window.addEventListener("resize", scheduleProgressResizeRender);
    progressResizeBound = true;
  }

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
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    markFormValidationAttempt(form);

    const date = String(form.elements.date.value || "").trim();

    if (!date) {
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
  });

  deleteButton.addEventListener("click", () => {
    const date = String(form.elements.date.value || "").trim();

    if (!date) {
      return;
    }

    const initialLength = appState.progress.dailyLogs.length;
    appState.progress.dailyLogs = appState.progress.dailyLogs.filter((entry) => entry.date !== date);

    if (initialLength === appState.progress.dailyLogs.length) {
      return;
    }

    saveState();
    renderProgress();
    populateProgressForm(date);
  });

  populateProgressForm(getTodayDateKey());
  renderProgress();
}
