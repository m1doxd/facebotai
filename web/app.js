// app.js
"use strict";

/*
 * ============================================================
 * FaceMetric / FaceBot
 * Frontend renderer
 * ============================================================
 *
 * - Русский интерфейс
 * - Score 1–10
 * - Фото сохраняется на экране результата
 * - Score показывается поверх фотографии
 * - Gemini / model не показывается пользователю
 * - Шкалы показателей: красный → жёлтый → зелёный
 * - История сохраняется локально
 * - POST /api/analyze
 * - GET /api/health
 * - JPG / PNG / WEBP до 15 MB
 * - Telegram WebApp
 * - Drag & Drop
 * ============================================================
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const API_ENDPOINT =
  "https://facebot-gemini.snow4lyt.workers.dev/api/analyze";

const HEALTH_ENDPOINT =
  "https://facebot-gemini.snow4lyt.workers.dev/api/health";

const HISTORY_KEY = "facemetric_history_v1";
const OLD_HISTORY_KEY = "facebot_history_v1";

const tg =
  window.Telegram &&
  window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

// ============================================================
// DOM
// ============================================================

const screens =
  document.querySelectorAll(".screen");

const fileInput =
  document.getElementById("file-input");

const uploadButton =
  document.getElementById("upload-btn");

const uploadZone =
  document.getElementById("upload-zone");

const uploadName =
  document.getElementById("upload-name");

const analysisPreview =
  document.querySelector(".analysis-preview");

const analysisFrame =
  document.getElementById("analysis-frame");

const analysisImage =
  document.getElementById("analysis-image");

const landmarkCanvas =
  document.getElementById("landmark-canvas");

const analysisState =
  document.getElementById("analysis-state");

const landmarkCount =
  document.getElementById("landmark-count");

const axisStatus =
  document.getElementById("axis-status");

const analysisScore =
  document.getElementById("analysis-score");

const analysisScoreValue =
  analysisScore
    ? analysisScore.querySelector("strong")
    : null;

const loadingContent =
  document.getElementById("loading-content");

const loadingTitle =
  document.getElementById("loading-title");

const loadingText =
  document.getElementById("loading-text");

const loadingProgressBar =
  document.getElementById("loading-progress-bar");

const loadingSteps =
  document.querySelectorAll(".loading-step");

const resultScreen =
  document.getElementById("screen-result");

const resultScore =
  document.getElementById("result-score");

const scoreProgress =
  document.getElementById("score-progress");

const scoreStatus =
  document.getElementById("score-status");

const scoreDataStatus =
  document.getElementById("score-data-status");

const resultLandmarkCount =
  document.getElementById("result-landmark-count");

const statsGrid =
  document.getElementById("stats-grid");

const overviewGrid =
  document.getElementById("overview-grid");

const harmonyContent =
  document.getElementById("harmony-content");

const metricsContent =
  document.getElementById("metrics-content");

const angularityContent =
  document.getElementById("angularity-content");

const symmetryContent =
  document.getElementById("symmetry-content");

const dimorphismContent =
  document.getElementById("dimorphism-content");

const healthContent =
  document.getElementById("health-content");

const reportTabs =
  document.getElementById("report-tabs");

const historyCount =
  document.getElementById("history-count");

const historyList =
  document.getElementById("history-list");

const newAnalysisButton =
  document.getElementById("new-analysis");

const toast =
  document.getElementById("toast");

// ============================================================
// STATE
// ============================================================

let selectedFile = null;
let selectedObjectUrl = null;
let currentAnalysis = null;
let currentScreen = "home";
let analysisInProgress = false;
let toastTimer = null;
let analysisRequestId = 0;
let loadingAnimationId = 0;

// ============================================================
// RUSSIAN LABELS
// ============================================================

const LABELS = {
  face_geometry: "Геометрия лица",
  facial_width_height_balance: "Баланс ширины и высоты",
  face_aspect_ratio: "Соотношение лица",
  midface_proportion: "Пропорции средней трети",

  symmetry: "Симметрия",
  overall_symmetry: "Общая симметрия",
  left_right_balance: "Баланс левой и правой стороны",

  eyes: "Глаза",
  eye_spacing: "Расстояние между глазами",
  eye_aspect_ratio: "Форма глаз",
  eye_alignment: "Выравнивание глаз",
  eye_area_balance: "Баланс области глаз",

  eyebrows: "Брови",
  brow_position: "Положение бровей",
  brow_shape: "Форма бровей",
  brow_symmetry: "Симметрия бровей",

  nose: "Нос",
  nose_width: "Ширина носа",
  nose_length: "Длина носа",
  nose_proportion: "Пропорции носа",

  jaw: "Челюсть",
  jaw_width: "Ширина челюсти",
  jaw_definition: "Выраженность челюсти",
  jaw_shape: "Форма челюсти",

  chin: "Подбородок",
  chin_prominence: "Выраженность подбородка",
  chin_proportion: "Пропорции подбородка",

  cheeks: "Скулы",
  cheek_prominence: "Выраженность скул",
  cheek_definition: "Определённость скул",

  lips_mouth: "Губы и рот",
  mouth_width: "Ширина рта",
  lip_proportion: "Пропорции губ",
  mouth_symmetry: "Симметрия рта",

  midface: "Средняя треть",
  midface_balance: "Баланс средней трети",

  overall_harmony: "Общая гармония",
  frontal_harmony: "Гармония анфас",
  proportions: "Пропорции",

  facial_definition: "Выраженность черт",
  angularity: "Угловатость",

  confidence: "Уверенность анализа",
  dimorphism: "Визуальная выраженность черт",

  face_count: "Количество лиц",
  feature_count: "Количество измерений",
  detected_features: "Обнаруженные признаки",
  landmarks_count: "Точки лица"
};

const GROUP_LABELS = {
  face_geometry: "Геометрия лица",
  symmetry: "Симметрия",
  eyes: "Глаза",
  eyebrows: "Брови",
  nose: "Нос",
  jaw: "Челюсть",
  chin: "Подбородок",
  cheeks: "Скулы",
  lips_mouth: "Губы и рот",
  midface: "Средняя треть"
};

// ============================================================
// TELEGRAM
// ============================================================

function initTelegram() {
  if (!tg) {
    return;
  }

  try {
    if (typeof tg.ready === "function") {
      tg.ready();
    }

    if (typeof tg.expand === "function") {
      tg.expand();
    }

    if (typeof tg.setHeaderColor === "function") {
      tg.setHeaderColor("#08090b");
    }

    if (typeof tg.setBackgroundColor === "function") {
      tg.setBackgroundColor("#08090b");
    }

    if (
      typeof tg.enableClosingConfirmation ===
      "function"
    ) {
      tg.enableClosingConfirmation();
    }
  } catch (error) {
    console.warn(
      "Telegram initialization warning:",
      error
    );
  }
}

// ============================================================
// NAVIGATION
// ============================================================

function showScreen(name) {
  const target =
    document.getElementById(
      `screen-${name}`
    );

  if (!target) {
    console.warn(
      `Screen not found: screen-${name}`
    );
    return;
  }

  screens.forEach((screen) => {
    const active =
      screen === target;

    screen.classList.toggle(
      "active",
      active
    );

    if (active) {
      screen.classList.remove(
        "screen-enter"
      );

      void screen.offsetWidth;

      screen.classList.add(
        "screen-enter"
      );
    }
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

  if (name === "result") {
    activateDefaultResultTab();
  }
}

function updateNavigation(name) {
  document
    .querySelectorAll(".nav-item")
    .forEach((item) => {
      const target =
        item.dataset.screen;

      const active =
        target === name ||
        (
          name === "analysis" &&
          target === "home"
        ) ||
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
  if (
    currentScreen === "analysis" ||
    currentScreen === "result" ||
    currentScreen === "history" ||
    currentScreen === "about"
  ) {
    showScreen("home");
    return;
  }

  showScreen("home");
}

// ============================================================
// FILE PICKER
// ============================================================

function openFilePicker() {
  if (!fileInput) {
    showToast(
      "Не найден загрузчик фотографии."
    );
    return;
  }

  fileInput.value = "";

  try {
    fileInput.click();
  } catch (error) {
    console.error(
      "Could not open file picker:",
      error
    );

    showToast(
      "Не удалось открыть выбор фотографии."
    );
  }
}

function handleFileSelected(file) {
  if (!file) {
    return;
  }

  const validation =
    validateFile(file);

  if (!validation.valid) {
    showToast(
      validation.message
    );
    return;
  }

  analysisRequestId++;

  selectedFile = file;

  currentAnalysis = null;

  if (selectedObjectUrl) {
    URL.revokeObjectURL(
      selectedObjectUrl
    );
  }

  selectedObjectUrl =
    URL.createObjectURL(file);

  if (uploadName) {
    uploadName.textContent =
      `${file.name} · ${formatBytes(file.size)}`;
  }

  if (analysisImage) {
    analysisImage.src =
      selectedObjectUrl;

    analysisImage.alt =
      "Фотография для анализа";

    analysisImage.style.animation =
      "none";

    void analysisImage.offsetWidth;

    analysisImage.style.animation =
      "";
  }

  resetAnalysisPreview();
  resetLoadingSteps();
  removeResultFace();

  showScreen("analysis");

  startAnalysis(file);
}

function validateFile(file) {
  if (!file) {
    return {
      valid: false,
      message:
        "Фотография не выбрана."
    };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      message:
        "Поддерживаются только JPG, PNG и WEBP."
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      message:
        "Файл фотографии пустой."
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message:
        "Фотография слишком большая. Максимум — 15 MB."
    };
  }

  return {
    valid: true
  };
}

// ============================================================
// DRAG & DROP
// ============================================================

function bindUploadDropzone() {
  if (!uploadZone) {
    return;
  }

  const events = [
    "dragenter",
    "dragover"
  ];

  events.forEach((eventName) => {
    uploadZone.addEventListener(
      eventName,
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        uploadZone.classList.add(
          "drag-active"
        );
      }
    );
  });

  [
    "dragleave",
    "drop"
  ].forEach((eventName) => {
    uploadZone.addEventListener(
      eventName,
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        uploadZone.classList.remove(
          "drag-active"
        );
      }
    );
  });

  uploadZone.addEventListener(
    "drop",
    (event) => {
      const file =
        event.dataTransfer &&
        event.dataTransfer.files
          ? event.dataTransfer.files[0]
          : null;

      handleFileSelected(file);
    }
  );
}

// ============================================================
// ANALYSIS PREVIEW
// ============================================================

function resetAnalysisPreview() {
  if (analysisScore) {
    analysisScore.classList.remove(
      "show",
      "float"
    );
  }

  if (analysisScoreValue) {
    analysisScoreValue.textContent =
      "—";
  }

  if (analysisState) {
    analysisState.textContent =
      "АНАЛИЗ";
  }

  if (landmarkCount) {
    landmarkCount.textContent =
      "0";
  }

  if (axisStatus) {
    axisStatus.textContent =
      "—";
  }

  if (loadingProgressBar) {
    loadingProgressBar.style.width =
      "0%";
  }

  clearLandmarks();
}

function setAnalysisState(text) {
  if (analysisState) {
    analysisState.textContent =
      text;
  }
}

function showAnalysisPreviewScore(score) {
  if (
    score === null ||
    score === undefined ||
    !Number.isFinite(Number(score))
  ) {
    return;
  }

  const normalized =
    clamp(
      Number(score),
      0,
      10
    );

  if (analysisScoreValue) {
    analysisScoreValue.textContent =
      formatScore(normalized);
  }

  if (analysisScore) {
    analysisScore.classList.add(
      "show"
    );

    window.setTimeout(() => {
      if (
        currentScreen ===
        "analysis"
      ) {
        analysisScore.classList.add(
          "float"
        );
      }
    }, 900);
  }
}

function clearLandmarks() {
  if (!landmarkCanvas) {
    return;
  }

  const context =
    landmarkCanvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(
    0,
    0,
    landmarkCanvas.width,
    landmarkCanvas.height
  );
}

// ============================================================
// ANALYSIS
// ============================================================

async function startAnalysis(file) {
  if (analysisInProgress) {
    return;
  }

  if (!file) {
    showToast(
      "Фотография не выбрана."
    );
    return;
  }

  analysisInProgress = true;

  const requestId =
    ++analysisRequestId;

  resetLoadingSteps();

  setAnalysisState(
    "АНАЛИЗ"
  );

  try {
    const analysisPromise =
      analyzePhoto(file);

    await runLoadingSequence(
      analysisPromise
    );

    const result =
      await analysisPromise;

    if (
      requestId !==
      analysisRequestId
    ) {
      return;
    }

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.detail ||
        result?.error ||
        "Анализ не выполнен."
      );
    }

    currentAnalysis =
      normalizeClientResult(
        result
      );

    if (
      currentAnalysis.score ===
      null
    ) {
      throw new Error(
        "Сервер не вернул корректную итоговую оценку."
      );
    }

    completeLoadingSteps();

    setAnalysisState(
      "ГОТОВО"
    );

    if (
      currentAnalysis.landmarks_count !==
      null
    ) {
      if (landmarkCount) {
        landmarkCount.textContent =
          formatValue(
            currentAnalysis.landmarks_count
          );
      }

      if (resultLandmarkCount) {
        resultLandmarkCount.textContent =
          formatValue(
            currentAnalysis.landmarks_count
          );
      }
    }

    if (axisStatus) {
      axisStatus.textContent =
        currentAnalysis.face_count > 0
          ? "OK"
          : "—";
    }

    showAnalysisPreviewScore(
      currentAnalysis.score
    );

    saveHistory(
      currentAnalysis
    );

    await sleep(650);

    if (
      requestId !==
      analysisRequestId
    ) {
      return;
    }

    renderResult(
      currentAnalysis
    );

    showScreen("result");
  } catch (error) {
    if (
      requestId !==
      analysisRequestId
    ) {
      return;
    }

    console.error(
      "FaceMetric analysis error:",
      error
    );

    setAnalysisState(
      "ОШИБКА"
    );

    showToast(
      getFriendlyErrorMessage(
        error
      )
    );

    showScreen("home");
  } finally {
    if (
      requestId ===
      analysisRequestId
    ) {
      analysisInProgress =
        false;
    }
  }
}

// ============================================================
// API
// ============================================================

async function analyzePhoto(file) {
  const validation =
    validateFile(file);

  if (!validation.valid) {
    throw new Error(
      validation.message
    );
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    file,
    file.name || "photo.jpg"
  );

  let response;

  try {
    response =
      await fetch(
        API_ENDPOINT,
        {
          method: "POST",
          body: formData,
          headers: {
            Accept:
              "application/json"
          },
          cache: "no-store"
        }
      );
  } catch (error) {
    console.error(
      "FaceMetric fetch error:",
      error
    );

    throw new Error(
      "Не удалось подключиться к серверу анализа."
    );
  }

  const responseText =
    await response.text();

  let data = null;

  if (responseText.trim()) {
    try {
      data =
        JSON.parse(
          responseText
        );
    } catch (error) {
      console.error(
        "Invalid JSON:",
        error
      );

      throw new Error(
        `Сервер вернул некорректный ответ (${response.status}).`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
      data?.error ||
      getHttpErrorMessage(
        response.status
      )
    );
  }

  if (!data) {
    throw new Error(
      "Сервер вернул пустой ответ."
    );
  }

  return data;
}

// ============================================================
// HEALTH CHECK
// ============================================================

async function checkWorkerHealth() {
  try {
    const response =
      await fetch(
        HEALTH_ENDPOINT,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!response.ok) {
      return false;
    }

    const data =
      await response.json();

    return (
      data?.success === true ||
      data?.status === "ok"
    );
  } catch (error) {
    console.warn(
      "Health check failed:",
      error
    );

    return false;
  }
}

// ============================================================
// LOADING
// ============================================================

async function runLoadingSequence(
  analysisPromise
) {
  const sequenceId =
    ++loadingAnimationId;

  const steps = [
    {
      index: 0,
      title:
        "Обрабатываем фотографию",
      text:
        "Подготавливаем изображение",
      progress: 12
    },
    {
      index: 1,
      title:
        "Определяем лицо",
      text:
        "Ищем основные точки и контуры лица",
      progress: 32
    },
    {
      index: 2,
      title:
        "Измеряем пропорции",
      text:
        "Анализируем геометрию и черты",
      progress: 55
    },
    {
      index: 3,
      title:
        "Анализируем симметрию",
      text:
        "Сравниваем левую и правую стороны",
      progress: 76
    },
    {
      index: 4,
      title:
        "Формируем результат",
      text:
        "Собираем итоговые показатели",
      progress: 92
    }
  ];

  for (
    let i = 0;
    i < steps.length;
    i++
  ) {
    if (
      sequenceId !==
      loadingAnimationId
    ) {
      return;
    }

    const step =
      steps[i];

    setLoadingStep(
      step.index
    );

    if (loadingTitle) {
      loadingTitle.textContent =
        step.title;
    }

    if (loadingText) {
      loadingText.textContent =
        step.text;
    }

    if (loadingProgressBar) {
      loadingProgressBar.style.width =
        `${step.progress}%`;
    }

    if (
      i <
      steps.length - 1
    ) {
      await Promise.race([
        sleep(480),
        analysisPromise
          .catch(() => null)
      ]);
    } else {
      await Promise.race([
        analysisPromise
          .catch(() => null),
        sleep(900)
      ]);
    }
  }
}

function resetLoadingSteps() {
  loadingAnimationId++;

  loadingSteps.forEach(
    (step) => {
      step.classList.remove(
        "active",
        "done"
      );
    }
  );

  const first =
    document.querySelector(
      '.loading-step[data-step="0"]'
    );

  if (first) {
    first.classList.add(
      "active"
    );
  }

  if (loadingTitle) {
    loadingTitle.textContent =
      "Обрабатываем фотографию";
  }

  if (loadingText) {
    loadingText.textContent =
      "Подготавливаем изображение";
  }

  if (loadingProgressBar) {
    loadingProgressBar.style.width =
      "8%";
  }
}

function setLoadingStep(index) {
  loadingSteps.forEach(
    (step) => {
      const stepIndex =
        Number(
          step.dataset.step
        );

      step.classList.toggle(
        "active",
        stepIndex === index
      );

      step.classList.toggle(
        "done",
        stepIndex < index
      );
    }
  );
}

function completeLoadingSteps() {
  loadingSteps.forEach(
    (step) => {
      step.classList.remove(
        "active"
      );

      step.classList.add(
        "done"
      );
    }
  );

  if (loadingProgressBar) {
    loadingProgressBar.style.width =
      "100%";
  }
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeClientResult(data) {
  const source =
    isObject(data?.analysis)
      ? {
          ...data,
          ...data.analysis
        }
      : data;

  return {
    success: true,

    score:
      normalizeScore(
        source?.score
      ),

    face_count:
      toNumberOrZero(
        source?.face_count
      ),

    landmarks_count:
      nullableNumber(
        source?.landmarks_count
      ),

    detected_features:
      toNumberOrZero(
        source?.detected_features
      ),

    feature_count:
      toNumberOrZero(
        source?.feature_count
      ),

    metrics:
      isObject(
        source?.metrics
      )
        ? source.metrics
        : {},

    production_features:
      isObject(
        source?.production_features
      )
        ? source.production_features
        : {},

    generated_at:
      source?.generated_at ||
      new Date().toISOString()
  };
}

// ============================================================
// RESULT
// ============================================================

function renderResult(result) {
  renderScore(
    result.score
  );

  renderStats(
    result
  );

  renderResultFace(
    result
  );

  renderOverview(
    result.metrics,
    result.production_features
  );

  renderHarmony(
    result.metrics,
    result.production_features
  );

  renderMetrics(
    result.metrics,
    result.production_features
  );

  renderAngularity(
    result.metrics,
    result.production_features
  );

  renderSymmetry(
    result.metrics,
    result.production_features
  );

  renderDimorphism(
    result.metrics,
    result.production_features
  );

  renderHealth();

  if (resultLandmarkCount) {
    resultLandmarkCount.textContent =
      result.landmarks_count === null
        ? "—"
        : formatValue(
            result.landmarks_count
          );
  }
}

// ============================================================
// RESULT SCORE
// ============================================================

function renderScore(score) {
  if (
    score === null ||
    score === undefined ||
    !Number.isFinite(Number(score))
  ) {
    if (resultScore) {
      resultScore.textContent =
        "—";
    }

    if (scoreProgress) {
      scoreProgress.style.width =
        "0%";
    }

    if (scoreStatus) {
      scoreStatus.textContent =
        "Итоговая оценка не получена";
    }

    if (scoreDataStatus) {
      scoreDataStatus.textContent =
        "НЕТ ДАННЫХ";
    }

    return;
  }

  const normalized =
    clamp(
      Number(score),
      0,
      10
    );

  if (resultScore) {
    resultScore.textContent =
      formatScore(
        normalized
      );
  }

  if (scoreProgress) {
    scoreProgress.style.width =
      `${normalized * 10}%`;
  }

  if (scoreStatus) {
    scoreStatus.textContent =
      getScoreStatus(
        normalized
      );
  }

  if (scoreDataStatus) {
    scoreDataStatus.textContent =
      "ПОЛУЧЕНО";
  }
}

function getScoreStatus(score) {
  if (score < 4) {
    return "Низкая выраженность положительных показателей";
  }

  if (score < 5.5) {
    return "Средний результат";
  }

  if (score < 7) {
    return "Сбалансированный результат";
  }

  if (score < 8.5) {
    return "Высокий результат";
  }

  if (score < 9.5) {
    return "Очень высокий результат";
  }

  return "Исключительно высокий результат";
}

// ============================================================
// RESULT FACE
// ============================================================

function renderResultFace(result) {
  if (!resultScreen) {
    return;
  }

  removeResultFace();

  if (
    !selectedObjectUrl &&
    !analysisImage?.src
  ) {
    return;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "result-face";

  wrapper.id =
    "result-face";

  const frame =
    document.createElement(
      "div"
    );

  frame.className =
    "result-face-frame";

  const image =
    document.createElement(
      "img"
    );

  image.className =
    "result-face-image";

  image.src =
    selectedObjectUrl ||
    analysisImage.src;

  image.alt =
    "Фотография после анализа";

  image.draggable =
    false;

  const overlay =
    document.createElement(
      "div"
    );

  overlay.className =
    "result-face-overlay";

  const label =
    document.createElement(
      "span"
    );

  label.textContent =
    "РЕЗУЛЬТАТ АНАЛИЗА";

  const score =
    document.createElement(
      "strong"
    );

  score.textContent =
    formatScore(
      result.score
    );

  const scoreSuffix =
    document.createElement(
      "small"
    );

  scoreSuffix.textContent =
    "/10";

  score.appendChild(
    scoreSuffix
  );

  overlay.append(
    label,
    score
  );

  const cornerLayer =
    document.createElement(
      "div"
    );

  cornerLayer.className =
    "result-face-corners";

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    cornerLayer.appendChild(
      document.createElement(
        "span"
      )
    );
  }

  frame.append(
    image,
    cornerLayer,
    overlay
  );

  wrapper.appendChild(
    frame
  );

  const resultTitle =
    resultScreen.querySelector(
      ".result-title"
    );

  const resultHero =
    resultScreen.querySelector(
      ".result-hero"
    );

  if (
    resultTitle &&
    resultHero
  ) {
    resultScreen.insertBefore(
      wrapper,
      resultHero
    );
  }
}

function removeResultFace() {
  const existing =
    document.getElementById(
      "result-face"
    );

  if (existing) {
    existing.remove();
  }
}

// ============================================================
// STATS
// ============================================================

function renderStats(result) {
  if (!statsGrid) {
    return;
  }

  statsGrid.innerHTML =
    "";

  const totalFeatures =
    result.feature_count ||
    result.detected_features ||
    countLeaves(
      result.production_features
    );

  const stats = [
    {
      label:
        "ЛИЦО",
      value:
        String(
          result.face_count
        ),
      detail:
        "обнаружено"
    },
    {
      label:
        "ТОЧКИ",
      value:
        result.landmarks_count ===
        null
          ? "—"
          : formatValue(
              result.landmarks_count
            ),
      detail:
        "лицевой геометрии"
    },
    {
      label:
        "ИЗМЕРЕНИЯ",
      value:
        String(
          totalFeatures
        ),
      detail:
        "показателей"
    }
  ];

  stats.forEach(
    (stat) => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "stat";

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        stat.label;

      const value =
        document.createElement(
          "strong"
        );

      value.textContent =
        stat.value;

      const detail =
        document.createElement(
          "small"
        );

      detail.textContent =
        stat.detail;

      card.append(
        label,
        value,
        detail
      );

      statsGrid.appendChild(
        card
      );
    }
  );
}

// ============================================================
// OVERVIEW
// ============================================================

function renderOverview(
  metrics,
  production
) {
  if (!overviewGrid) {
    return;
  }

  overviewGrid.innerHTML =
    "";

  const sections = [
    {
      title:
        "Гармония",
      values:
        getProductionValues(
          production,
          [
            "overall_harmony",
            "frontal_harmony",
            "proportions"
          ]
        )
    },
    {
      title:
        "Геометрия лица",
      values:
        getGroup(
          metrics,
          [
            "face_geometry"
          ]
        )
    },
    {
      title:
        "Симметрия",
      values:
        getGroup(
          metrics,
          [
            "symmetry"
          ]
        )
    }
  ];

  let rendered =
    0;

  sections.forEach(
    (section) => {
      if (
        !section.values.length
      ) {
        return;
      }

      const wrapper =
        document.createElement(
          "section"
        );

      wrapper.className =
        "overview-section";

      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        section.title;

      wrapper.appendChild(
        title
      );

      section.values.forEach(
        ([key, value]) => {
          wrapper.appendChild(
            createScaleCard(
              key,
              value
            )
          );

          rendered++;
        }
      );

      overviewGrid.appendChild(
        wrapper
      );
    }
  );

  if (!rendered) {
    const fallback =
      flattenObject(
        metrics
      ).slice(
        0,
        8
      );

    if (fallback.length) {
      fallback.forEach(
        ([key, value]) => {
          overviewGrid.appendChild(
            createScaleCard(
              key,
              value
            )
          );
        }
      );
    } else {
      overviewGrid.appendChild(
        createEmptyBlock(
          "Измерения не были получены."
        )
      );
    }
  }
}

// ============================================================
// HARMONY
// ============================================================

function renderHarmony(
  metrics,
  production
) {
  if (!harmonyContent) {
    return;
  }

  harmonyContent.innerHTML =
    "";

  const values = [];

  values.push(
    ...getProductionValues(
      production,
      [
        "overall_harmony",
        "frontal_harmony",
        "proportions"
      ]
    )
  );

  values.push(
    ...getGroup(
      metrics,
      [
        "face_geometry"
      ]
    )
  );

  values.push(
    ...getGroup(
      metrics,
      [
        "midface"
      ]
    )
  );

  if (!values.length) {
    harmonyContent.appendChild(
      createEmptyBlock(
        "Показатели гармонии не были получены."
      )
    );

    return;
  }

  const heading =
    createSectionIntro(
      "Гармония лица",
      "Показатели отображаются только по данным, которые реально вернул сервер."
    );

  harmonyContent.appendChild(
    heading
  );

  values.forEach(
    ([key, value]) => {
      harmonyContent.appendChild(
        createScaleCard(
          key,
          value
        )
      );
    }
  );
}

// ============================================================
// METRICS
// ============================================================

function renderMetrics(
  metrics,
  production
) {
  if (!metricsContent) {
    return;
  }

  metricsContent.innerHTML =
    "";

  const metricEntries =
    flattenObject(
      metrics
    );

  const productionEntries =
    flattenObject(
      production
    );

  if (
    !metricEntries.length &&
    !productionEntries.length
  ) {
    metricsContent.appendChild(
      createEmptyBlock(
        "Подробные измерения не были получены."
      )
    );

    return;
  }

  if (metricEntries.length) {
    metricsContent.appendChild(
      createSectionIntro(
        "Измерения лица",
        "Геометрические значения, полученные анализатором."
      )
    );

    metricEntries.forEach(
      ([path, value]) => {
        metricsContent.appendChild(
          createScaleCard(
            path,
            value
          )
        );
      }
    );
  }

  if (productionEntries.length) {
    metricsContent.appendChild(
      createSectionIntro(
        "Производственные признаки",
        "Числовые признаки, использованные серверной системой анализа."
      )
    );

    productionEntries.forEach(
      ([path, value]) => {
        metricsContent.appendChild(
          createScaleCard(
            path,
            value
          )
        );
      }
    );
  }
}

// ============================================================
// ANGULARITY
// ============================================================

function renderAngularity(
  metrics,
  production
) {
  if (!angularityContent) {
    return;
  }

  angularityContent.innerHTML =
    "";

  const values = [];

  values.push(
    ...getGroup(
      metrics,
      [
        "jaw"
      ]
    )
  );

  values.push(
    ...getGroup(
      metrics,
      [
        "cheeks"
      ]
    )
  );

  values.push(
    ...getProductionValues(
      production,
      [
        "angularity",
        "facial_definition"
      ]
    )
  );

  if (!values.length) {
    angularityContent.appendChild(
      createEmptyBlock(
        "Показатели угловатости не были получены."
      )
    );

    return;
  }

  angularityContent.appendChild(
    createSectionIntro(
      "Угловатость и выраженность",
      "Визуальная шкала выраженности соответствующих измеряемых признаков."
    )
  );

  values.forEach(
    ([key, value]) => {
      angularityContent.appendChild(
        createScaleCard(
          key,
          value
        )
      );
    }
  );
}

// ============================================================
// SYMMETRY
// ============================================================

function renderSymmetry(
  metrics,
  production
) {
  if (!symmetryContent) {
    return;
  }

  symmetryContent.innerHTML =
    "";

  const values = [];

  values.push(
    ...getGroup(
      metrics,
      [
        "symmetry"
      ]
    )
  );

  const eyeValues =
    getGroup(
      metrics,
      [
        "eyes"
      ]
    ).filter(
      ([key]) =>
        key ===
        "eye_alignment"
    );

  values.push(
    ...eyeValues
  );

  values.push(
    ...getProductionValues(
      production,
      [
        "symmetry"
      ]
    )
  );

  if (!values.length) {
    symmetryContent.appendChild(
      createEmptyBlock(
        "Показатели симметрии не были получены."
      )
    );

    return;
  }

  symmetryContent.appendChild(
    createSectionIntro(
      "Симметрия",
      "Показатели баланса между сторонами лица."
    )
  );

  values.forEach(
    ([key, value]) => {
      symmetryContent.appendChild(
        createScaleCard(
          key,
          value
        )
      );
    }
  );
}

// ============================================================
// DIMORPHISM
// ============================================================

function renderDimorphism(
  metrics,
  production
) {
  if (!dimorphismContent) {
    return;
  }

  dimorphismContent.innerHTML =
    "";

  const values =
    getProductionValues(
      production,
      [
        "dimorphism"
      ]
    );

  if (!values.length) {
    dimorphismContent.appendChild(
      createEmptyBlock(
        "Отдельный показатель визуальной выраженности черт не был возвращён."
      )
    );

    return;
  }

  dimorphismContent.appendChild(
    createSectionIntro(
      "Визуальная выраженность",
      "Показатель отображается только при наличии соответствующего значения в ответе сервера."
    )
  );

  values.forEach(
    ([key, value]) => {
      dimorphismContent.appendChild(
        createScaleCard(
          key,
          value
        )
      );
    }
  );
}

// ============================================================
// HEALTH
// ============================================================

function renderHealth() {
  if (!healthContent) {
    return;
  }

  healthContent.innerHTML =
    "";

  const icon =
    document.createElement(
      "div"
    );

  icon.className =
    "note-icon";

  icon.textContent =
    "i";

  const text =
    document.createElement(
      "p"
    );

  text.textContent =
    "Этот раздел не является медицинской диагностикой. Система не определяет заболевания или состояние здоровья. Здесь отображаются только визуальные характеристики, полученные из изображения.";

  healthContent.append(
    icon,
    text
  );
}

// ============================================================
// SCALE CARD
// ============================================================

function createScaleCard(
  key,
  value
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "scale-card";

  const numeric =
    normalizeMetricValue(
      value
    );

  const top =
    document.createElement(
      "div"
    );

  top.className =
    "scale-card__top";

  const name =
    document.createElement(
      "span"
    );

  name.className =
    "scale-card__name";

  name.textContent =
    getRussianLabel(
      key
    );

  const score =
    document.createElement(
      "strong"
    );

  score.className =
    "scale-card__score";

  score.textContent =
    numeric === null
      ? "—"
      : `${formatMetricScore(
          numeric
        )}/10`;

  top.append(
    name,
    score
  );

  const track =
    document.createElement(
      "div"
    );

  track.className =
    "metric-scale";

  const fill =
    document.createElement(
      "div"
    );

  fill.className =
    "metric-scale__fill";

  if (numeric !== null) {
    const percent =
      clamp(
        numeric * 10,
        0,
        100
      );

    fill.style.width =
      `${percent}%`;

    fill.dataset.level =
      getMetricLevel(
        numeric
      );
  } else {
    fill.style.width =
      "0%";
  }

  track.appendChild(
    fill
  );

  const labels =
    document.createElement(
      "div"
    );

  labels.className =
    "metric-scale__labels";

  const low =
    document.createElement(
      "span"
    );

  low.textContent =
    "Слабее";

  const medium =
    document.createElement(
      "span"
    );

  medium.textContent =
    "Средне";

  const high =
    document.createElement(
      "span"
    );

  high.textContent =
    "Выражено";

  labels.append(
    low,
    medium,
    high
  );

  card.append(
    top,
    track,
    labels
  );

  return card;
}

function createSectionIntro(
  title,
  text
) {
  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "section-intro";

  const strong =
    document.createElement(
      "strong"
    );

  strong.textContent =
    title;

  const span =
    document.createElement(
      "span"
    );

  span.textContent =
    text;

  heading.append(
    strong,
    span
  );

  return heading;
}

// ============================================================
// METRIC LEVEL
// ============================================================

function getMetricLevel(
  value
) {
  if (value < 4) {
    return "low";
  }

  if (value < 7) {
    return "medium";
  }

  return "high";
}

function normalizeMetricValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return clamp(
    number,
    0,
    10
  );
}

function formatMetricScore(
  value
) {
  const rounded =
    Math.round(
      value * 10
    ) / 10;

  return String(
    rounded
  ).replace(
    ".",
    ","
  );
}

// ============================================================
// HISTORY
// ============================================================

function getHistory() {
  try {
    let raw =
      localStorage.getItem(
        HISTORY_KEY
      );

    if (!raw) {
      raw =
        localStorage.getItem(
          OLD_HISTORY_KEY
        );
    }

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(
        raw
      );

    return Array.isArray(
      parsed
    )
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

      landmarks_count:
        result.landmarks_count
    };

    history.unshift(
      entry
    );

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        history.slice(
          0,
          50
        )
      )
    );

    updateHistoryCount();
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

  updateHistoryCount(
    history.length
  );

  historyList.innerHTML =
    "";

  if (!history.length) {
    historyList.appendChild(
      createEmptyBlock(
        "Пока нет сохранённых анализов."
      )
    );

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

      date.className =
        "date";

      date.textContent =
        formatDate(
          entry.created_at
        );

      const meta =
        document.createElement(
          "div"
        );

      meta.className =
        "meta";

      const faces =
        entry.face_count ||
        0;

      const features =
        entry.feature_count ||
        entry.detected_features ||
        0;

      meta.textContent =
        `${faces} лицо · ${features} измерений`;

      left.append(
        date,
        meta
      );

      const score =
        document.createElement(
          "div"
        );

      score.className =
        "score";

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

      historyList.appendChild(
        item
      );
    }
  );
}

function updateHistoryCount(
  explicitCount = null
) {
  const count =
    explicitCount === null
      ? getHistory().length
      : explicitCount;

  if (historyCount) {
    historyCount.textContent =
      String(count);
  }
}

// ============================================================
// RESULT TABS
// ============================================================

function bindResultTabs() {
  if (!reportTabs) {
    return;
  }

  const tabs =
    reportTabs.querySelectorAll(
      ".tab"
    );

  const panels =
    document.querySelectorAll(
      ".tab-panel"
    );

  tabs.forEach(
    (tab) => {
      tab.addEventListener(
        "click",
        () => {
          const target =
            tab.dataset.tab;

          if (!target) {
            return;
          }

          tabs.forEach(
            (item) => {
              const active =
                item === tab;

              item.classList.toggle(
                "active",
                active
              );

              item.setAttribute(
                "aria-selected",
                active
                  ? "true"
                  : "false"
              );
            }
          );

          panels.forEach(
            (panel) => {
              panel.classList.toggle(
                "active",
                panel.dataset.panel ===
                  target
              );
            }
          );
        }
      );
    }
  );
}

function activateDefaultResultTab() {
  if (!reportTabs) {
    return;
  }

  const firstTab =
    reportTabs.querySelector(
      '.tab[data-tab="overview"]'
    );

  if (!firstTab) {
    return;
  }

  const tabs =
    reportTabs.querySelectorAll(
      ".tab"
    );

  const panels =
    document.querySelectorAll(
      ".tab-panel"
    );

  tabs.forEach(
    (tab) => {
      const active =
        tab === firstTab;

      tab.classList.toggle(
        "active",
        active
      );

      tab.setAttribute(
        "aria-selected",
        active
          ? "true"
          : "false"
      );
    }
  );

  panels.forEach(
    (panel) => {
      panel.classList.toggle(
        "active",
        panel.dataset.panel ===
          "overview"
      );
    }
  );
}

// ============================================================
// NEW ANALYSIS
// ============================================================

function startNewAnalysis() {
  analysisRequestId++;
  loadingAnimationId++;

  analysisInProgress =
    false;

  selectedFile = null;
  currentAnalysis = null;

  if (selectedObjectUrl) {
    URL.revokeObjectURL(
      selectedObjectUrl
    );

    selectedObjectUrl =
      null;
  }

  if (fileInput) {
    fileInput.value =
      "";
  }

  if (uploadName) {
    uploadName.textContent =
      "JPG, PNG или WEBP · до 15 MB";
  }

  if (analysisImage) {
    analysisImage.removeAttribute(
      "src"
    );
  }

  resetAnalysisPreview();
  resetLoadingSteps();
  removeResultFace();

  showScreen("home");
}

// ============================================================
// TOAST
// ============================================================

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent =
    String(
      message ||
      "Произошла ошибка."
    );

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {
        toast.classList.remove(
          "show"
        );
      },
      4000
    );
}

// ============================================================
// ERRORS
// ============================================================

function getFriendlyErrorMessage(
  error
) {
  const message =
    String(
      error?.message ||
      ""
    );

  if (
    message.includes(
      "Failed to fetch"
    )
  ) {
    return (
      "Не удалось подключиться к серверу анализа. Проверь Worker и CORS."
    );
  }

  if (
    message.includes(
      "NetworkError"
    )
  ) {
    return (
      "Сетевая ошибка при подключении к серверу анализа."
    );
  }

  if (
    message.includes("413")
  ) {
    return (
      "Фотография слишком большая."
    );
  }

  if (
    message.includes("429")
  ) {
    return (
      "Слишком много запросов. Попробуй немного позже."
    );
  }

  if (
    message.includes("401") ||
    message.includes("403")
  ) {
    return (
      "Сервер не смог выполнить авторизацию."
    );
  }

  if (
    /no face detected/i.test(
      message
    )
  ) {
    return (
      "Лицо на фотографии не удалось определить. Попробуй более чёткое фронтальное фото."
    );
  }

  return (
    message ||
    "Анализ не выполнен. Попробуй ещё раз."
  );
}

function getHttpErrorMessage(
  status
) {
  if (status === 400) {
    return (
      "Некорректный запрос к серверу анализа."
    );
  }

  if (status === 401) {
    return (
      "Ошибка авторизации сервера."
    );
  }

  if (status === 403) {
    return (
      "Доступ к серверу анализа запрещён."
    );
  }

  if (status === 413) {
    return (
      "Фотография слишком большая."
    );
  }

  if (status === 429) {
    return (
      "Слишком много запросов. Попробуй позже."
    );
  }

  if (status >= 500) {
    return (
      "Ошибка сервера анализа."
    );
  }

  return (
    `Ошибка сервера (${status}).`
  );
}

// ============================================================
// FORMATTING
// ============================================================

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
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

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "—";
  }

  const normalized =
    clamp(
      number,
      0,
      10
    );

  return String(
    Math.round(
      normalized * 10
    ) / 10
  ).replace(
    ".",
    ","
  );
}

function formatValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value ===
    "number"
  ) {
    if (
      !Number.isFinite(
        value
      )
    ) {
      return "—";
    }

    return String(
      Math.round(
        value * 100
      ) / 100
    ).replace(
      ".",
      ","
    );
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Да"
      : "Нет";
  }

  if (
    typeof value ===
    "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return "—";
    }
  }

  return String(
    value
  );
}

function formatDate(value) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Неизвестная дата";
  }

  return date.toLocaleString(
    "ru-RU",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

// ============================================================
// LABEL HELPERS
// ============================================================

function getRussianLabel(key) {
  const raw =
    String(
      key || ""
    );

  const lastPart =
    raw.includes(".")
      ? raw
          .split(".")
          .pop()
      : raw;

  return (
    LABELS[lastPart] ||
    LABELS[raw] ||
    prettifyPath(raw)
  );
}

function prettifyKey(key) {
  return String(
    key || ""
  )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /^./,
      (char) =>
        char.toUpperCase()
    );
}

function prettifyPath(path) {
  const parts =
    String(
      path || ""
    ).split(".");

  return parts
    .map(
      (part) =>
        LABELS[part] ||
        prettifyKey(part)
    )
    .join(" · ");
}

// ============================================================
// OBJECT HELPERS
// ============================================================

function isObject(value) {
  return (
    value !== null &&
    typeof value ===
      "object" &&
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

  Object.entries(
    object
  ).forEach(
    ([key, value]) => {
      const path =
        prefix
          ? `${prefix}.${key}`
          : key;

      if (
        isObject(value)
      ) {
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
  return flattenObject(
    object
  ).length;
}

function toNumberOrZero(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function nullableNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function normalizeScore(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
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

function createEmptyBlock(
  message
) {
  const div =
    document.createElement(
      "div"
    );

  div.className =
    "history-empty";

  div.textContent =
    message;

  return div;
}

// ============================================================
// METRIC GROUP HELPERS
// ============================================================

function getGroup(
  object,
  names
) {
  if (!isObject(object)) {
    return [];
  }

  const result = [];

  names.forEach(
    (name) => {
      const group =
        object[name];

      if (
        isObject(group)
      ) {
        result.push(
          ...Object.entries(
            group
          )
        );
      }
    }
  );

  return result;
}

function getProductionValues(
  production,
  names
) {
  if (
    !isObject(production)
  ) {
    return [];
  }

  const result = [];

  names.forEach(
    (name) => {
      if (
        production[name] !==
        undefined
      ) {
        result.push([
          name,
          production[name]
        ]);
      }
    }
  );

  return result;
}

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {
  if (uploadButton) {
    uploadButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        openFilePicker();
      }
    );
  }

  if (fileInput) {
    fileInput.addEventListener(
      "change",
      (event) => {
        const file =
          event.target.files?.[0];

        handleFileSelected(
          file
        );
      }
    );
  }

  document
    .querySelectorAll(
      "[data-screen]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          (event) => {
            if (
              element ===
              uploadButton
            ) {
              return;
            }

            const target =
              element.dataset.screen;

            if (target) {
              showScreen(
                target
              );
            }
          }
        );
      }
    );

  document
    .querySelectorAll(
      ".back-btn"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const target =
              button.dataset.screen;

            if (target) {
              showScreen(
                target
              );
            } else {
              goBack();
            }
          }
        );
      }
    );

  if (newAnalysisButton) {
    newAnalysisButton.addEventListener(
      "click",
      startNewAnalysis
    );
  }

  bindUploadDropzone();
  bindResultTabs();
}

// ============================================================
// CANVAS RESIZE
// ============================================================

function resizeLandmarkCanvas() {
  if (
    !landmarkCanvas ||
    !analysisFrame
  ) {
    return;
  }

  const rect =
    analysisFrame.getBoundingClientRect();

  const dpr =
    Math.max(
      1,
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      )
    );

  landmarkCanvas.width =
    Math.round(
      rect.width * dpr
    );

  landmarkCanvas.height =
    Math.round(
      rect.height * dpr
    );

  landmarkCanvas.style.width =
    `${rect.width}px`;

  landmarkCanvas.style.height =
    `${rect.height}px`;
}

window.addEventListener(
  "resize",
  resizeLandmarkCanvas
);

// ============================================================
// STARTUP
// ============================================================

function init() {
  initTelegram();

  bindEvents();

  updateHistoryCount();

  activateDefaultResultTab();

  showScreen("home");

  window.setTimeout(
    resizeLandmarkCanvas,
    100
  );

  checkWorkerHealth()
    .then(
      (healthy) => {
        if (!healthy) {
          console.warn(
            "FaceMetric: Worker health check failed."
          );
        }
      }
    )
    .catch(
      (error) => {
        console.warn(
          "Background health check failed:",
          error
        );
      }
    );
}

init();
