"use strict";

/*
 * FaceBot — Telegram Mini App
 * Frontend for FaceBot Gemini Worker
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const API_ENDPOINT =
  "https://facebot-gemini.snow4lyt.workers.dev/api/analyze";

const HISTORY_KEY = "facebot_history_v1";

const tg =
  window.Telegram &&
  window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;


// ======================================================
// DOM
// ======================================================

const screens = document.querySelectorAll(".screen");

const fileInput =
  document.getElementById("fileInput");

const choosePhotoBtn =
  document.getElementById("choosePhotoBtn");

const chooseAnotherBtn =
  document.getElementById("chooseAnotherBtn");

const analyzeBtn =
  document.getElementById("analyzeBtn");

const previewImage =
  document.getElementById("previewImage");

const fileFormat =
  document.getElementById("fileFormat");

const fileSize =
  document.getElementById("fileSize");

const loadingTitle =
  document.getElementById("loadingTitle");

const loadingSubtitle =
  document.getElementById("loadingSubtitle");

const resultScore =
  document.getElementById("resultScore");

const resultProgress =
  document.getElementById("resultProgress");

const resultCaption =
  document.getElementById("resultCaption");

const scoreRange =
  document.getElementById("scoreRange");

const statFaces =
  document.getElementById("statFaces");

const statLandmarks =
  document.getElementById("statLandmarks");

const statFeatures =
  document.getElementById("statFeatures");

const statModel =
  document.getElementById("statModel");

const metricCount =
  document.getElementById("metricCount");

const analyzerCount =
  document.getElementById("analyzerCount");

const featureCount =
  document.getElementById("featureCount");

const overviewGrid =
  document.getElementById("overviewGrid");

const metricsContainer =
  document.getElementById("metrics");

const featureGroups =
  document.getElementById("featureGroups");

const historyCount =
  document.getElementById("historyCount");

const historySummaryCount =
  document.getElementById("historySummaryCount");

const historyList =
  document.getElementById("historyList");

const newAnalysisBtn =
  document.getElementById("newAnalysisBtn");

const toast =
  document.getElementById("toast");


// ======================================================
// STATE
// ======================================================

let selectedFile = null;
let selectedObjectUrl = null;
let currentAnalysis = null;
let currentScreen = "home";
let analysisInProgress = false;
let toastTimer = null;


// ======================================================
// TELEGRAM
// ======================================================

function initTelegram() {
  if (!tg) {
    return;
  }

  try {
    tg.ready();
    tg.expand();

    if (typeof tg.setHeaderColor === "function") {
      tg.setHeaderColor("#08090b");
    }

    if (typeof tg.setBackgroundColor === "function") {
      tg.setBackgroundColor("#08090b");
    }

    if (
      typeof tg.enableClosingConfirmation === "function"
    ) {
      tg.enableClosingConfirmation();
    }
  } catch (error) {
    console.warn(
      "Telegram WebApp initialization warning:",
      error
    );
  }
}


// ======================================================
// NAVIGATION
// ======================================================

function showScreen(name) {
  const target = document.querySelector(
    `.screen[data-screen="${CSS.escape(name)}"]`
  );

  if (!target) {
    return;
  }

  screens.forEach((screen) => {
    screen.classList.toggle(
      "active",
      screen === target
    );
  });

  currentScreen = name;

  updateNavigation(name);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (name === "history") {
    renderHistory();
  }
}


function updateNavigation(name) {
  const navItems =
    document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    const target = item.dataset.go;

    const active =
      target === name ||
      (
        name === "result" &&
        target === "home"
      );

    item.classList.toggle(
      "active",
      active
    );
  });
}


function goBack() {
  if (currentScreen === "photo") {
    showScreen("home");
    return;
  }

  if (currentScreen === "history") {
    showScreen("home");
    return;
  }

  if (currentScreen === "about") {
    showScreen("home");
    return;
  }

  if (currentScreen === "result") {
    showScreen("home");
    return;
  }

  showScreen("home");
}


// ======================================================
// FILE PICKER
// ======================================================

function openFilePicker() {
  if (!fileInput) {
    return;
  }

  fileInput.value = "";
  fileInput.click();
}


function handleFileSelected(file) {
  if (!file) {
    return;
  }

  const validation = validateFile(file);

  if (!validation.valid) {
    showToast(validation.message);
    return;
  }

  selectedFile = file;

  if (selectedObjectUrl) {
    URL.revokeObjectURL(selectedObjectUrl);
  }

  selectedObjectUrl =
    URL.createObjectURL(file);

  if (previewImage) {
    previewImage.src =
      selectedObjectUrl;

    previewImage.alt =
      "Selected photo preview";
  }

  if (fileFormat) {
    fileFormat.textContent =
      getFileFormat(file);
  }

  if (fileSize) {
    fileSize.textContent =
      formatBytes(file.size);
  }

  showScreen("photo");
}


function validateFile(file) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      message:
        "Only JPG, PNG and WEBP images are supported."
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message:
        "Image is too large. Maximum size is 15 MB."
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      message:
        "The selected image is empty."
    };
  }

  return {
    valid: true
  };
}


function getFileFormat(file) {
  if (file.type === "image/jpeg") {
    return "JPEG";
  }

  if (file.type === "image/png") {
    return "PNG";
  }

  if (file.type === "image/webp") {
    return "WEBP";
  }

  return "IMAGE";
}


// ======================================================
// ANALYSIS
// ======================================================

async function startAnalysis() {
  if (analysisInProgress) {
    return;
  }

  if (!selectedFile) {
    showToast("Choose a photo first.");
    return;
  }

  analysisInProgress = true;

  setAnalyzeButtonLoading(true);

  showScreen("loading");

  resetLoadingSteps();

  try {
    await runLoadingSequence();

    const result =
      await analyzePhoto(selectedFile);

    if (!result.success) {
      throw new Error(
        result.detail ||
        "Analysis failed."
      );
    }

    currentAnalysis =
      normalizeClientResult(result);

    saveHistory(currentAnalysis);

    renderResult(currentAnalysis);

    showScreen("result");

  } catch (error) {
    console.error(
      "FaceBot analysis error:",
      error
    );

    showToast(
      error?.message ||
      "Analysis failed. Please try again."
    );

    showScreen("photo");

  } finally {
    analysisInProgress = false;
    setAnalyzeButtonLoading(false);
  }
}


// ======================================================
// API REQUEST
// ======================================================

async function analyzePhoto(file) {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
    file.name || "photo.jpg"
  );

  const response =
    await fetch(
      API_ENDPOINT,
      {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json"
        }
      }
    );

  const responseText =
    await response.text();

  let data = null;

  try {
    data =
      responseText
        ? JSON.parse(responseText)
        : null;
  } catch (error) {
    throw new Error(
      `Server returned invalid JSON (${response.status}): ${responseText}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
      `Analysis request failed (${response.status}).`
    );
  }

  if (!data) {
    throw new Error(
      "Server returned an empty response."
    );
  }

  return data;
}


// ======================================================
// LOADING
// ======================================================

async function runLoadingSequence() {
  const steps = [
    {
      number: 1,
      title: "Analyzing photo",
      subtitle:
        "Detecting the visible face…"
    },
    {
      number: 2,
      title: "Reading facial structure",
      subtitle:
        "Extracting visible geometry…"
    },
    {
      number: 3,
      title: "Preparing feature set",
      subtitle:
        "Organizing the analyzer response…"
    },
    {
      number: 4,
      title: "Running production analysis",
      subtitle:
        "Generating the final report…"
    }
  ];

  for (
    let index = 0;
    index < steps.length;
    index++
  ) {
    const step = steps[index];

    setLoadingStep(step.number);

    if (loadingTitle) {
      loadingTitle.textContent =
        step.title;
    }

    if (loadingSubtitle) {
      loadingSubtitle.textContent =
        step.subtitle;
    }

    await sleep(
      index === steps.length - 1
        ? 250
        : 420
    );
  }
}


function resetLoadingSteps() {
  const steps =
    document.querySelectorAll(
      ".loading-step"
    );

  steps.forEach((step) => {
    step.classList.remove(
      "active",
      "done"
    );
  });

  const first =
    document.querySelector(
      '.loading-step[data-step="1"]'
    );

  if (first) {
    first.classList.add("active");
  }

  if (loadingTitle) {
    loadingTitle.textContent =
      "Analyzing photo";
  }

  if (loadingSubtitle) {
    loadingSubtitle.textContent =
      "Detecting the face…";
  }
}


function setLoadingStep(number) {
  const steps =
    document.querySelectorAll(
      ".loading-step"
    );

  steps.forEach((step) => {
    const stepNumber =
      Number(step.dataset.step);

    step.classList.toggle(
      "active",
      stepNumber === number
    );

    step.classList.toggle(
      "done",
      stepNumber < number
    );
  });
}


function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}


// ======================================================
// RESULT
// ======================================================

function normalizeClientResult(data) {
  const analysis =
    data?.analysis &&
    typeof data.analysis === "object"
      ? data.analysis
      : data;

  return {
    success: true,

    score:
      normalizeScore(analysis.score),

    face_count:
      toNumberOrZero(analysis.face_count),

    landmarks_count:
      nullableNumber(analysis.landmarks_count),

    detected_features:
      toNumberOrZero(
        analysis.detected_features
      ),

    feature_count:
      toNumberOrZero(
        analysis.feature_count
      ),

    model:
      cleanText(data.model || analysis.model) ||
      "Gemini",

    metrics:
      isObject(analysis.metrics)
        ? analysis.metrics
        : {},

    production_features:
      isObject(analysis.production_features)
        ? analysis.production_features
        : {},

    generated_at:
      data.generated_at ||
      analysis.generated_at ||
      new Date().toISOString()
  };
}


function renderResult(result) {
  renderScore(result.score);

  if (statFaces) {
    statFaces.textContent =
      String(result.face_count);
  }

  if (statLandmarks) {
    statLandmarks.textContent =
      result.landmarks_count === null
        ? "—"
        : formatValue(
            result.landmarks_count
          );
  }

  if (statFeatures) {
    const total =
      result.feature_count ||
      result.detected_features ||
      countLeaves(
        result.production_features
      );

    statFeatures.textContent =
      String(total);
  }

  if (statModel) {
    statModel.textContent =
      shortenModelName(
        result.model
      );
  }

  renderOverview(result.metrics);

  renderMetrics(result.metrics);

  renderProductionFeatures(
    result.production_features
  );
}


function renderScore(score) {
  if (score === null) {
    if (resultScore) {
      resultScore.textContent = "—";
    }

    if (resultProgress) {
      resultProgress.style.width = "0%";
    }

    if (resultCaption) {
      resultCaption.textContent =
        "No usable face detected";
    }

    if (scoreRange) {
      scoreRange.textContent =
        "NO SCORE";
    }

    return;
  }

  if (resultScore) {
    resultScore.textContent =
      formatScore(score);
  }

  if (resultProgress) {
    resultProgress.style.width =
      `${clamp(score * 10, 0, 100)}%`;
  }

  if (resultCaption) {
    resultCaption.textContent =
      "Production analysis result";
  }

  if (scoreRange) {
    scoreRange.textContent =
      "REAL RESULT";
  }
}


// ======================================================
// OVERVIEW
// ======================================================

function renderOverview(metrics) {
  if (!overviewGrid) {
    return;
  }

  overviewGrid.innerHTML = "";

  const leaves =
    flattenObject(metrics);

  const entries =
    leaves.slice(0, 8);

  if (metricCount) {
    metricCount.textContent =
      String(leaves.length);
  }

  if (analyzerCount) {
    analyzerCount.textContent =
      String(leaves.length);
  }

  if (!entries.length) {
    overviewGrid.appendChild(
      emptyBlock(
        "No measured structure returned."
      )
    );

    return;
  }

  entries.forEach(
    ([key, value]) => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "overview-card";

      const label =
        document.createElement(
          "div"
        );

      label.className =
        "overview-card__label";

      label.textContent =
        prettifyKey(key);

      const valueElement =
        document.createElement(
          "div"
        );

      valueElement.className =
        "overview-card__value";

      valueElement.textContent =
        formatValue(value);

      const source =
        document.createElement(
          "div"
        );

      source.className =
        "overview-card__source";

      source.textContent =
        "returned by analyzer";

      card.append(
        label,
        valueElement,
        source
      );

      overviewGrid.appendChild(card);
    }
  );
}


// ======================================================
// METRICS
// ======================================================

function renderMetrics(metrics) {
  if (!metricsContainer) {
    return;
  }

  metricsContainer.innerHTML = "";

  const groups =
    Object.entries(metrics || {});

  const leaves =
    flattenObject(metrics);

  if (analyzerCount) {
    analyzerCount.textContent =
      String(leaves.length);
  }

  if (!groups.length) {
    metricsContainer.appendChild(
      emptyBlock(
        "No measurements returned."
      )
    );

    return;
  }

  groups.forEach(
    ([groupName, groupValue]) => {
      if (isObject(groupValue)) {
        Object.entries(groupValue)
          .forEach(
            ([key, value]) => {
              metricsContainer.appendChild(
                createMetricCard(
                  groupName,
                  key,
                  value
                )
              );
            }
          );
      } else {
        metricsContainer.appendChild(
          createMetricCard(
            "",
            groupName,
            groupValue
          )
        );
      }
    }
  );
}


function createMetricCard(
  groupName,
  key,
  value
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "metric-card";

  const header =
    document.createElement(
      "button"
    );

  header.type = "button";
  header.className =
    "metric-header";

  const main =
    document.createElement(
      "div"
    );

  main.className =
    "metric-main";

  const name =
    document.createElement(
      "div"
    );

  name.className =
    "metric-name";

  name.textContent =
    prettifyKey(key);

  const metricKey =
    document.createElement(
      "div"
    );

  metricKey.className =
    "metric-key";

  metricKey.textContent =
    groupName
      ? `${groupName}.${key}`
      : key;

  main.append(
    name,
    metricKey
  );

  const metricValue =
    document.createElement(
      "div"
    );

  metricValue.className =
    "metric-value";

  metricValue.textContent =
    formatValue(value);

  const arrow =
    document.createElement(
      "span"
    );

  arrow.className =
    "metric-arrow";

  arrow.textContent = "+";

  header.append(
    main,
    metricValue,
    arrow
  );

  const content =
    document.createElement(
      "div"
    );

  content.className =
    "metric-content";

  const contentInner =
    document.createElement(
      "div"
    );

  const detail =
    document.createElement(
      "div"
    );

  detail.className =
    "metric-detail";

  const detailLabel =
    document.createElement(
      "span"
    );

  detailLabel.textContent =
    groupName
      ? prettifyKey(groupName)
      : "VALUE";

  const detailValue =
    document.createElement(
      "strong"
    );

  detailValue.textContent =
    formatValue(value);

  detail.append(
    detailLabel,
    detailValue
  );

  contentInner.appendChild(detail);

  content.appendChild(contentInner);

  card.append(
    header,
    content
  );

  header.addEventListener(
    "click",
    () => {
      card.classList.toggle("open");
    }
  );

  return card;
}


// ======================================================
// PRODUCTION FEATURES
// ======================================================

function renderProductionFeatures(
  production
) {
  if (!featureGroups) {
    return;
  }

  featureGroups.innerHTML = "";

  const groups =
    Object.entries(
      production || {}
    );

  const total =
    countLeaves(production);

  if (featureCount) {
    featureCount.textContent =
      String(total);
  }

  if (!groups.length) {
    featureGroups.appendChild(
      emptyBlock(
        "No production features returned."
      )
    );

    return;
  }

  groups.forEach(
    ([groupName, groupValue]) => {
      const group =
        document.createElement(
          "article"
        );

      group.className =
        "feature-group";

      const header =
        document.createElement(
          "button"
        );

      header.type = "button";

      header.className =
        "feature-group__header";

      const title =
        document.createElement(
          "span"
        );

      title.className =
        "feature-group__title";

      title.textContent =
        prettifyKey(groupName);

      const count =
        document.createElement(
          "span"
        );

      count.className =
        "feature-group__count";

      count.textContent =
        `${countLeaves(groupValue)} VALUES`;

      const arrow =
        document.createElement(
          "span"
        );

      arrow.className =
        "feature-group__arrow";

      arrow.textContent = "+";

      header.append(
        title,
        count,
        arrow
      );

      const list =
        document.createElement(
          "div"
        );

      list.className =
        "feature-list";

      const listWrapper =
        document.createElement(
          "div"
        );

      const inner =
        document.createElement(
          "div"
        );

      inner.className =
        "feature-list-inner";

      const leaves =
        flattenObject(groupValue);

      if (isObject(groupValue)) {
        leaves.forEach(
          ([key, value]) => {
            const row =
              document.createElement(
                "div"
              );

            row.className =
              "feature-row";

            const name =
              document.createElement(
                "span"
              );

            name.className =
              "feature-row__name";

            name.textContent =
              prettifyKey(key);

            const valueElement =
              document.createElement(
                "span"
              );

            valueElement.className =
              "feature-row__value";

            valueElement.textContent =
              formatValue(value);

            row.append(
              name,
              valueElement
            );

            inner.appendChild(row);
          }
        );
      } else {
        const row =
          document.createElement(
            "div"
          );

        row.className =
          "feature-row";

        const name =
          document.createElement(
            "span"
          );

        name.className =
          "feature-row__name";

        name.textContent =
          prettifyKey(groupName);

        const value =
          document.createElement(
            "span"
          );

        value.className =
          "feature-row__value";

        value.textContent =
          formatValue(groupValue);

        row.append(
          name,
          value
        );

        inner.appendChild(row);
      }

      listWrapper.appendChild(inner);

      list.appendChild(listWrapper);

      group.append(
        header,
        list
      );

      header.addEventListener(
        "click",
        () => {
          group.classList.toggle("open");
        }
      );

      featureGroups.appendChild(group);
    }
  );
}


// ======================================================
// HISTORY
// ======================================================

function getHistory() {
  try {
    const raw =
      localStorage.getItem(
        HISTORY_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {
    console.warn(
      "History read error:",
      error
    );

    return [];
  }
}


function saveHistory(result) {
  try {
    const history =
      getHistory();

    const entry = {
      id:
        `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`,

      created_at:
        result.generated_at ||
        new Date().toISOString(),

      score:
        result.score,

      face_count:
        result.face_count,

      feature_count:
        result.feature_count,

      detected_features:
        result.detected_features,

      model:
        result.model
    };

    history.unshift(entry);

    const limited =
      history.slice(0, 50);

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(limited)
    );

    updateHistoryCounters();

  } catch (error) {
    console.warn(
      "History save error:",
      error
    );
  }
}


function renderHistory() {
  if (!historyList) {
    return;
  }

  const history =
    getHistory();

  updateHistoryCounters(
    history.length
  );

  historyList.innerHTML = "";

  if (!history.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        No analyses saved yet.
      </div>
    `;

    return;
  }

  history.forEach(
    (entry) => {
      const item =
        document.createElement(
          "article"
        );

      item.className =
        "history-item";

      const left =
        document.createElement(
          "div"
        );

      const date =
        document.createElement(
          "div"
        );

      date.className = "date";

      date.textContent =
        formatDate(
          entry.created_at
        );

      const meta =
        document.createElement(
          "div"
        );

      meta.className = "meta";

      meta.textContent =
        `${entry.face_count || 0} face · ` +
        `${entry.feature_count || entry.detected_features || 0} features`;

      left.append(
        date,
        meta
      );

      const score =
        document.createElement(
          "div"
        );

      score.className = "score";

      score.textContent =
        entry.score === null ||
        entry.score === undefined
          ? "—"
          : formatScore(
              entry.score
            );

      item.append(
        left,
        score
      );

      historyList.appendChild(item);
    }
  );
}


function updateHistoryCounters(
  explicitCount = null
) {
  const count =
    explicitCount === null
      ? getHistory().length
      : explicitCount;

  if (historyCount) {
    historyCount.textContent =
      `${count} ${
        count === 1
          ? "analysis"
          : "analyses"
      }`;
  }

  if (historySummaryCount) {
    historySummaryCount.textContent =
      String(count);
  }
}


// ======================================================
// RESET
// ======================================================

function startNewAnalysis() {
  selectedFile = null;
  currentAnalysis = null;

  if (selectedObjectUrl) {
    URL.revokeObjectURL(
      selectedObjectUrl
    );

    selectedObjectUrl = null;
  }

  if (fileInput) {
    fileInput.value = "";
  }

  if (previewImage) {
    previewImage.removeAttribute("src");
  }

  if (fileFormat) {
    fileFormat.textContent = "—";
  }

  if (fileSize) {
    fileSize.textContent = "—";
  }

  showScreen("home");
}


// ======================================================
// UI
// ======================================================

function setAnalyzeButtonLoading(
  loading
) {
  if (!analyzeBtn) {
    return;
  }

  analyzeBtn.disabled =
    loading;

  analyzeBtn.style.opacity =
    loading ? "0.6" : "";

  const spans =
    analyzeBtn.querySelectorAll("span");

  if (!spans.length) {
    return;
  }

  if (loading) {
    spans[0].textContent =
      "Analyzing…";

    if (spans[1]) {
      spans[1].textContent = "…";
    }
  } else {
    spans[0].textContent =
      "Analyze photo";

    if (spans[1]) {
      spans[1].textContent = "→";
    }
  }
}


function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent =
    String(message);

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(
      () => {
        toast.classList.remove("show");
      },
      3000
    );
}


function emptyBlock(message) {
  const div =
    document.createElement("div");

  div.className =
    "history-empty";

  div.textContent =
    message;

  return div;
}


// ======================================================
// FORMATTING
// ======================================================

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}


function formatScore(score) {
  const number =
    Number(score);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number
    .toFixed(2)
    .replace(/\.00$/, "");
}


function formatValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "—";
    }

    if (Number.isInteger(value)) {
      return String(value);
    }

    return String(
      Math.round(value * 100) / 100
    );
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }

  return String(value);
}


function formatDate(value) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown date";
  }

  return date.toLocaleString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


function prettifyKey(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2"
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^./,
      (char) =>
        char.toUpperCase()
    );
}


function shortenModelName(model) {
  const value =
    String(model || "");

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 16)}…`;
}


// ======================================================
// OBJECT HELPERS
// ======================================================

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function flattenObject(
  object,
  prefix = ""
) {
  const result = [];

  if (!isObject(object)) {
    return result;
  }

  Object.entries(object).forEach(
    ([key, value]) => {
      const path =
        prefix
          ? `${prefix}.${key}`
          : key;

      if (isObject(value)) {
        result.push(
          ...flattenObject(
            value,
            path
          )
        );
      } else {
        result.push([
          path,
          value
        ]);
      }
    }
  );

  return result;
}


function countLeaves(object) {
  return flattenObject(object).length;
}


function toNumberOrZero(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function nullableNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function normalizeScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return (
    Math.round(
      clamp(
        number,
        0,
        10
      ) * 100
    ) / 100
  );
}


function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}


function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}


// ======================================================
// EVENTS
// ======================================================

function bindEvents() {
  if (choosePhotoBtn) {
    choosePhotoBtn.addEventListener(
      "click",
      openFilePicker
    );
  }

  if (chooseAnotherBtn) {
    chooseAnotherBtn.addEventListener(
      "click",
      openFilePicker
    );
  }

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      () => {
        const file =
          fileInput.files?.[0];

        handleFileSelected(file);
      }
    );
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener(
      "click",
      startAnalysis
    );
  }

  if (newAnalysisBtn) {
    newAnalysisBtn.addEventListener(
      "click",
      startNewAnalysis
    );
  }

  document
    .querySelectorAll("[data-go]")
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          () => {
            const target =
              element.dataset.go;

            if (target) {
              showScreen(target);
            }
          }
        );
      }
    );

  document
    .querySelectorAll("[data-back]")
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          goBack
        );
      }
    );
}


// ======================================================
// START
// ======================================================

function init() {
  initTelegram();

  bindEvents();

  updateHistoryCounters();

  showScreen("home");
}

init();
