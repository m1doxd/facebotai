/* app.js */

"use strict";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const API_TIMEOUT_MS = 45_000;
const HEALTH_TIMEOUT_MS = 8_000;
const HISTORY_LIMIT = 50;

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

const tg =
  window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

/* ============================================================
   DOM
   ============================================================ */

const screens = document.querySelectorAll(".screen");
const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload-btn");
const uploadName = document.getElementById("upload-name");

const analysisImage = document.getElementById("analysis-image");
const analysisFrame = document.getElementById("analysis-frame");
const landmarkCanvas = document.getElementById("landmark-canvas");
const analysisState = document.getElementById("analysis-state");
const analysisScore = document.getElementById("analysis-score");
const analysisScoreValue =
  analysisScore?.querySelector("strong") ?? null;

const loadingTitle = document.getElementById("loading-title");
const loadingText = document.getElementById("loading-text");
const loadingSteps = document.querySelectorAll(".loading-step");
const loadingProgressBar =
  document.getElementById("loading-progress-bar");

const resultScreen = document.getElementById("screen-result");
const resultScore = document.getElementById("result-score");
const scoreProgress = document.getElementById("score-progress");
const scoreStatus = document.getElementById("score-status");

const statsGrid = document.getElementById("stats-grid");
const overviewGrid = document.getElementById("overview-grid");
const harmonyContent = document.getElementById("harmony-content");
const metricsContent = document.getElementById("metrics-content");
const angularityContent =
  document.getElementById("angularity-content");
const symmetryContent =
  document.getElementById("symmetry-content");
const dimorphismContent =
  document.getElementById("dimorphism-content");
const healthContent = document.getElementById("health-content");

const reportTabs = document.getElementById("report-tabs");
const historyCount = document.getElementById("history-count");
const historyList = document.getElementById("history-list");
const newAnalysisButton = document.getElementById("new-analysis");
const toast = document.getElementById("toast");

/* ============================================================
   STATE
   ============================================================ */

let selectedFile = null;
let selectedObjectUrl = null;
let currentAnalysis = null;
let currentScreen = "home";
let analysisInProgress = false;
let toastTimer = null;
let analysisRequestId = 0;
let analysisController = null;
let resultFaceHost = null;

/* ============================================================
   LABELS
   ============================================================ */

const LABELS = {
  face_geometry: "Геометрия лица",
  face_aspect_ratio: "Соотношение лица",
  facial_width_height: "Баланс ширины и высоты",
  facial_width_height_balance: "Баланс ширины и высоты",
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

/* ============================================================
   TELEGRAM
   ============================================================ */

function initTelegram() {
  if (!tg) return;

  try {
    tg.ready();
    tg.expand?.();
    tg.setHeaderColor?.("#f6f6f3");
    tg.setBackgroundColor?.("#f6f6f3");
    tg.enableClosingConfirmation?.();
  } catch (error) {
    console.warn("Telegram initialization warning:", error);
  }
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function showScreen(name) {
  const target = document.getElementById(`screen-${name}`);

  if (!target) {
    console.warn(`Screen not found: screen-${name}`);
    return;
  }

  screens.forEach((screen) => {
    const active = screen === target;

    screen.classList.toggle("active", active);

    if (active) {
      screen.classList.remove("screen-enter");
      void screen.offsetWidth;
      screen.classList.add("screen-enter");
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
    ensureResultFace();
  }
}

function updateNavigation(name) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    const target = item.dataset.screen;

    const active =
      target === name ||
      ((name === "result" || name === "analysis") &&
        target === "home");

    item.classList.toggle("active", active);
  });
}

function goBack() {
  showScreen("home");
}

/* ============================================================
   STATIC LOCALIZATION
   ============================================================ */

function localizeStaticUi() {
  const replacements = [
    [".brand-subtitle", "анализ лица"],
    [".status span", "СИСТЕМА ГОТОВА"],
    ["#analysis-title", "Сканирование"],
    [".analysis-preview .preview-status", "АНАЛИЗ"],
    [".preview-processing span", "ОБРАБОТКА"],
    ["#loading-title", "Обрабатываем фотографию"],
    ["#loading-text", "Подготавливаем изображение"],
    [".result-title .eyebrow", "АНАЛИЗ ЗАВЕРШЁН"],
    ["#result-title", "Результат"],
    [".result-score-label", "ИТОГОВАЯ ОЦЕНКА"],
    [".section-header .eyebrow", "ОТЧЁТ"],
    [".section-header h3", "Разделы анализа"],
    ['.tab[data-tab="overview"]', "Обзор"],
    ['.tab[data-tab="harmony"]', "Гармония"],
    ['.tab[data-tab="features"]', "Черты и детали"],
    ['.tab[data-tab="angularity"]', "Угловатость"],
    ['.tab[data-tab="symmetry"]', "Симметрия"],
    ['.tab[data-tab="dimorphism"]', "Диморфизм"],
    ['.tab[data-tab="health"]', "Здоровье"],
    ["#history-title", "История"],
    ["#about-title", "Методология"],
    [".bottom-nav .nav-item:nth-child(1) small", "Главная"],
    [".bottom-nav .nav-item:nth-child(2) small", "История"],
    [".bottom-nav .nav-item:nth-child(3) small", "О системе"]
  ];

  replacements.forEach(([selector, text]) => {
    const node = document.querySelector(selector);

    if (node) {
      node.textContent = text;
    }
  });

  document
    .querySelectorAll(".loading-step")
    .forEach((step, index) => {
      const labels = [
        "Обработка изображения",
        "Определение лица",
        "Измерение пропорций",
        "Анализ симметрии",
        "Формирование отчёта"
      ];

      const em = step.querySelector("em");
      const number = step.querySelector("b");

      if (number) {
        number.textContent =
          String(index + 1).padStart(2, "0");
      }

      if (em) {
        em.textContent = labels[index];
      }
    });

  const homeEyebrow =
    document.querySelector("#screen-home .eyebrow");

  if (homeEyebrow) {
    homeEyebrow.textContent = "АНАЛИЗ ЛИЦА";
  }

  const uploadStrong =
    document.querySelector("#upload-btn strong");

  if (uploadStrong) {
    uploadStrong.textContent = "Загрузить фотографию";
  }

  const dropHint =
    document.querySelector(".drop-hint");

  if (dropHint) {
    dropHint.textContent =
      "или перетащи изображение сюда";
  }

  const miniCards =
    document.querySelectorAll(".mini-card");

  if (miniCards[0]) {
    const strong =
      miniCards[0].querySelector("strong");

    if (strong) {
      strong.textContent = "История";
    }
  }

  if (miniCards[1]) {
    const strong =
      miniCards[1].querySelector("strong");

    if (strong) {
      strong.textContent = "Методология";
    }
  }

  const trust =
    document.querySelectorAll(".trust-row span");

  [
    "ИЗМЕРЕНИЯ",
    "ТОЧКИ ЛИЦА",
    "БЕЗ ДОГАДОК"
  ].forEach((text, index) => {
    if (trust[index]) {
      trust[index].textContent = text;
    }
  });

  const homeFootnote =
    document.querySelector(".home-footnote strong");

  if (homeFootnote) {
    homeFootnote.textContent = "Что измеряется";
  }

  const capabilityTexts = [
    "01  ТОЧКИ",
    "02  ГЕОМЕТРИЯ",
    "03  СИММЕТРИЯ",
    "04  ОТЧЁТ"
  ];

  document
    .querySelectorAll(".home-capabilities span")
    .forEach((node, index) => {
      if (capabilityTexts[index]) {
        node.textContent = capabilityTexts[index];
      }
    });

  document
    .querySelectorAll("#screen-about .about-card strong")
    .forEach((node, index) => {
      const labels = [
        "Точки лица",
        "Геометрия",
        "Симметрия",
        "Текстовый анализ",
        "Без выдуманной оценки"
      ];

      if (labels[index]) {
        node.textContent = labels[index];
      }
    });
}

/* ============================================================
   FILE PICKER
   ============================================================ */

function openFilePicker() {
  if (!fileInput) {
    showToast("Не найден загрузчик фотографии.");
    return;
  }

  fileInput.value = "";

  try {
    fileInput.click();
  } catch (error) {
    console.error("Could not open file picker:", error);
    showToast("Не удалось открыть выбор фотографии.");
  }
}

function handleFileSelected(file) {
  if (!file) return;

  const validation = validateFile(file);

  if (!validation.valid) {
    showToast(validation.message);
    return;
  }

  cancelCurrentAnalysis();
  analysisRequestId++;

  selectedFile = file;
  currentAnalysis = null;

  moveAnalysisFrameBack();
  revokeSelectedObjectUrl();

  selectedObjectUrl = URL.createObjectURL(file);

  if (uploadName) {
    uploadName.textContent =
      `${file.name} · ${formatBytes(file.size)}`;
  }

  if (analysisImage) {
    analysisImage.src = selectedObjectUrl;
    analysisImage.alt = "Фотография для анализа";

    analysisImage.style.animation = "none";
    void analysisImage.offsetWidth;
    analysisImage.style.animation = "";
  }

  resetAnalysisPreview();

  showScreen("analysis");

  startAnalysis(file);
}

function validateFile(file) {
  if (!file) {
    return {
      valid: false,
      message: "Фотография не выбрана."
    };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      message: "Поддерживаются только JPG, PNG и WEBP."
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      message: "Файл фотографии пустой."
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

function revokeSelectedObjectUrl() {
  if (!selectedObjectUrl) return;

  URL.revokeObjectURL(selectedObjectUrl);
  selectedObjectUrl = null;
}

/* ============================================================
   ANALYSIS PREVIEW
   ============================================================ */

function resetAnalysisPreview() {
  analysisScore?.classList.remove("show", "float");

  if (analysisScoreValue) {
    analysisScoreValue.textContent = "—";
  }

  setAnalysisState("АНАЛИЗ");

  setLandmarkCounter(null);
  setAxisStatus("—");

  clearLandmarks();
  resetLoadingProgress();
}

function setAnalysisState(text) {
  if (analysisState) {
    analysisState.textContent = text;
  }
}

function showAnalysisPreviewScore(score) {
  if (!Number.isFinite(Number(score))) {
    return;
  }

  const normalized =
    clamp(Number(score), 0, 10);

  if (analysisScoreValue) {
    analysisScoreValue.textContent =
      formatScore(normalized);
  }

  if (analysisScore) {
    analysisScore.classList.add("show");

    window.setTimeout(() => {
      if (currentScreen === "analysis") {
        analysisScore.classList.add("float");
      }
    }, 900);
  }
}

function clearLandmarks() {
  if (!landmarkCanvas) return;

  const context =
    landmarkCanvas.getContext("2d");

  context?.clearRect(
    0,
    0,
    landmarkCanvas.width,
    landmarkCanvas.height
  );
}

function setLandmarkCounter(value) {
  const node =
    document.getElementById("landmark-count");

  if (!node) return;

  node.textContent =
    value === null ||
    value === undefined
      ? "—"
      : String(Math.round(Number(value)));
}

function setAxisStatus(value) {
  const node =
    document.getElementById("axis-status");

  if (!node) return;

  node.textContent = value || "—";
}

function drawAnalysisGuides(result) {
  setLandmarkCounter(result?.landmarks_count);

  if (Number(result?.face_count) > 0) {
    setAxisStatus("OK");
  } else {
    setAxisStatus("—");
  }

  drawDecorativeLandmarks();
}

function drawDecorativeLandmarks() {
  if (!landmarkCanvas || !analysisImage) {
    return;
  }

  const rect =
    analysisImage.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const dpr =
    window.devicePixelRatio || 1;

  landmarkCanvas.width =
    Math.round(rect.width * dpr);

  landmarkCanvas.height =
    Math.round(rect.height * dpr);

  const context =
    landmarkCanvas.getContext("2d");

  if (!context) return;

  context.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  const w = rect.width;
  const h = rect.height;

  context.clearRect(
    0,
    0,
    w,
    h
  );

  context.save();

  context.strokeStyle =
    "rgba(255,255,255,.38)";

  context.lineWidth = 1;

  context.setLineDash([
    3,
    6
  ]);

  context.beginPath();

  context.moveTo(
    w * 0.5,
    h * 0.16
  );

  context.lineTo(
    w * 0.5,
    h * 0.84
  );

  context.stroke();

  context.setLineDash([]);

  context.restore();
}

/* ============================================================
   ANALYSIS
   ============================================================ */

async function startAnalysis(file) {
  if (!file) {
    showToast("Фотография не выбрана.");
    return;
  }

  const requestId =
    ++analysisRequestId;

  analysisInProgress = true;
  analysisController =
    new AbortController();

  resetLoadingSteps();
  setAnalysisState("АНАЛИЗ");

  try {
    const analysisPromise =
      analyzePhoto(
        file,
        analysisController.signal
      );

    await runLoadingSequence(
      analysisPromise,
      requestId
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
      normalizeClientResult(result);

    completeLoadingSteps();

    setAnalysisState("ГОТОВО");

    drawAnalysisGuides(
      currentAnalysis
    );

    showAnalysisPreviewScore(
      currentAnalysis.score
    );

    saveHistory(
      currentAnalysis
    );

    await sleep(750);

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

    if (isAbortError(error)) {
      return;
    }

    console.error(
      "FaceMetric analysis error:",
      error
    );

    setAnalysisState("ОШИБКА");

    showToast(
      getFriendlyErrorMessage(error)
    );

    showScreen("home");
  } finally {
    if (
      requestId ===
      analysisRequestId
    ) {
      analysisInProgress = false;
      analysisController = null;
    }
  }
}

function cancelCurrentAnalysis() {
  analysisController?.abort();

  analysisController = null;
  analysisInProgress = false;
}

/* ============================================================
   API
   ============================================================ */

async function analyzePhoto(
  file,
  signal
) {
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

  const response =
    await fetchWithTimeout(
      API_ENDPOINT,
      {
        method: "POST",
        body: formData,
        headers: {
          Accept:
            "application/json"
        },
        cache: "no-store",
        signal
      },
      API_TIMEOUT_MS,
      signal
    );

  const responseText =
    await response.text();

  console.log(
    "FaceMetric API status:",
    response.status
  );

  console.log(
    "FaceMetric API response:",
    responseText.slice(
      0,
      3000
    )
  );

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

async function fetchWithTimeout(
  url,
  options,
  timeoutMs,
  externalSignal
) {
  const controller =
    new AbortController();

  let timedOut = false;

  const onExternalAbort =
    () => {
      controller.abort();
    };

  externalSignal?.addEventListener(
    "abort",
    onExternalAbort,
    {
      once: true
    }
  );

  const timer =
    window.setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      timeoutMs
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );
  } catch (error) {
    if (timedOut) {
      throw new Error(
        "Сервер анализа не ответил вовремя. Попробуй ещё раз."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timer);

    externalSignal?.removeEventListener(
      "abort",
      onExternalAbort
    );
  }
}

/* ============================================================
   HEALTH
   ============================================================ */

async function checkWorkerHealth() {
  const controller =
    new AbortController();

  const timer =
    window.setTimeout(
      () => controller.abort(),
      HEALTH_TIMEOUT_MS
    );

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
          },
          signal:
            controller.signal
        }
      );

    if (!response.ok) {
      return false;
    }

    const data =
      await response.json();

    console.log(
      "FaceMetric Worker health:",
      data
    );

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
  } finally {
    window.clearTimeout(
      timer
    );
  }
}

/* ============================================================
   LOADING
   ============================================================ */

async function runLoadingSequence(
  analysisPromise,
  requestId
) {
  const steps = [
    [
      0,
      "Обрабатываем фотографию",
      "Подготавливаем изображение"
    ],
    [
      1,
      "Определяем лицо",
      "Ищем основные точки и контуры лица"
    ],
    [
      2,
      "Измеряем пропорции",
      "Анализируем геометрию и черты"
    ],
    [
      3,
      "Анализируем симметрию",
      "Сравниваем левую и правую стороны"
    ],
    [
      4,
      "Формируем результат",
      "Собираем итоговые показатели"
    ]
  ];

  for (
    let i = 0;
    i < steps.length;
    i++
  ) {
    if (
      requestId !==
      analysisRequestId
    ) {
      return;
    }

    const [
      index,
      title,
      text
    ] = steps[i];

    setLoadingStep(
      index
    );

    if (loadingTitle) {
      loadingTitle.textContent =
        title;
    }

    if (loadingText) {
      loadingText.textContent =
        text;
    }

    setLoadingProgress(
      Math.round(
        (index /
          (steps.length - 1)) *
          100
      )
    );

    if (
      i <
      steps.length - 1
    ) {
      await sleep(430);
    } else {
      await Promise.race([
        analysisPromise.catch(
          () => null
        ),
        sleep(1200)
      ]);
    }
  }
}

function resetLoadingSteps() {
  loadingSteps.forEach(
    (step) => {
      step.classList.remove(
        "active",
        "done"
      );
    }
  );

  document
    .querySelector(
      '.loading-step[data-step="0"]'
    )
    ?.classList.add(
      "active"
    );

  if (loadingTitle) {
    loadingTitle.textContent =
      "Обрабатываем фотографию";
  }

  if (loadingText) {
    loadingText.textContent =
      "Подготавливаем изображение";
  }

  resetLoadingProgress();
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

  setLoadingProgress(100);
}

function setLoadingProgress(
  percent
) {
  if (!loadingProgressBar) {
    return;
  }

  loadingProgressBar.style.width =
    `${clamp(
      percent,
      0,
      100
    )}%`;
}

function resetLoadingProgress() {
  if (loadingProgressBar) {
    loadingProgressBar.style.width =
      "0%";
  }
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      window.setTimeout(
        resolve,
        ms
      )
  );
}

/* ============================================================
   NORMALIZATION
   ============================================================ */

function normalizeClientResult(
  data
) {
  return {
    success: true,

    score:
      normalizeScore(
        data?.score
      ),

    face_count:
      toNumberOrZero(
        data?.face_count
      ),

    landmarks_count:
      nullableNumber(
        data?.landmarks_count
      ),

    detected_features:
      toNumberOrZero(
        data?.detected_features
      ),

    feature_count:
      toNumberOrZero(
        data?.feature_count
      ),

    metrics:
      isObject(
        data?.metrics
      )
        ? data.metrics
        : {},

    production_features:
      isObject(
        data?.production_features
      )
        ? data.production_features
        : {},

    generated_at:
      data?.generated_at ||
      new Date().toISOString()
  };
}

/* ============================================================
   RESULT
   ============================================================ */

function renderResult(
  result
) {
  normalizeStaticResultText();

  renderScore(
    result.score
  );

  renderStats(
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
    result.metrics
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

  updateResultSummary(
    result
  );

  ensureResultFace();
}

function normalizeStaticResultText() {
  document
    .querySelectorAll(
      ".result-score small, #analysis-score small"
    )
    .forEach(
      (node) => {
        node.textContent =
          "/10";
      }
    );

  const modelSummary =
    document.querySelector(
      ".score-summary-item:nth-child(3)"
    );

  if (modelSummary) {
    modelSummary.remove();
  }

  const scoreData =
    document.getElementById(
      "score-data-status"
    );

  if (scoreData) {
    scoreData.textContent =
      "ПОДТВЕРЖДЕНО";
  }

  const scoreDataLabel =
    scoreData
      ?.parentElement
      ?.querySelector(
        "span"
      );

  if (scoreDataLabel) {
    scoreDataLabel.textContent =
      "ДАННЫЕ";
  }

  const scoreLandmark =
    document.getElementById(
      "result-landmark-count"
    );

  if (scoreLandmark) {
    const label =
      scoreLandmark
        .previousElementSibling;

    if (label) {
      label.textContent =
        "ТОЧКИ";
    }
  }
}

function updateResultSummary(
  result
) {
  const landmarkCount =
    document.getElementById(
      "result-landmark-count"
    );

  if (landmarkCount) {
    landmarkCount.textContent =
      result.landmarks_count ===
      null
        ? "—"
        : String(
            Math.round(
              result.landmarks_count
            )
          );
  }

  const scoreMeta =
    document.querySelector(
      ".score-meta span:last-child"
    );

  if (scoreMeta) {
    scoreMeta.textContent =
      "ИЗМЕРЕННЫЙ РЕЗУЛЬТАТ";
  }
}

function renderScore(
  score
) {
  if (
    !Number.isFinite(
      Number(score)
    )
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
        "Итоговая оценка не была получена.";
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
}

function getScoreStatus(
  score
) {
  if (score < 4) {
    return "Низкий результат";
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

/* ============================================================
   RESULT FACE
   ============================================================ */

function ensureResultFace() {
  if (
    !resultScreen ||
    !analysisFrame
  ) {
    return;
  }

  if (!resultFaceHost) {
    resultFaceHost =
      resultScreen.querySelector(
        ".result-face"
      );

    if (!resultFaceHost) {
      resultFaceHost =
        document.createElement(
          "div"
        );

      resultFaceHost.className =
        "result-face";

      const title =
        document.createElement(
          "div"
        );

      title.className =
        "result-face__heading";

      const eyebrow =
        document.createElement(
          "span"
        );

      eyebrow.textContent =
        "ФОТОГРАФИЯ";

      const caption =
        document.createElement(
          "strong"
        );

      caption.textContent =
        "Результат на исходном изображении";

      title.append(
        eyebrow,
        caption
      );

      resultFaceHost.appendChild(
        title
      );

      const hero =
        resultScreen.querySelector(
          ".result-hero"
        );

      if (hero) {
        hero.before(
          resultFaceHost
        );
      } else {
        resultScreen.appendChild(
          resultFaceHost
        );
      }
    }
  }

  if (
    analysisFrame.parentElement !==
    resultFaceHost
  ) {
    resultFaceHost.appendChild(
      analysisFrame
    );
  }

  analysisFrame.classList.add(
    "result-face-visible"
  );

  analysisFrame.hidden = false;
  analysisFrame.style.display = "";
  analysisFrame.style.visibility =
    "visible";
  analysisFrame.style.opacity =
    "1";

  window.requestAnimationFrame(
    () => {
      drawDecorativeLandmarks();
    }
  );
}

function moveAnalysisFrameBack() {
  if (!analysisFrame) {
    return;
  }

  const analysisPreview =
    document.querySelector(
      ".analysis-preview"
    );

  if (
    analysisPreview &&
    analysisFrame.parentElement !==
      analysisPreview
  ) {
    analysisPreview.appendChild(
      analysisFrame
    );
  }

  analysisFrame.classList.remove(
    "result-face-visible"
  );
}

/* ============================================================
   STATS
   ============================================================ */

function renderStats(
  result
) {
  if (!statsGrid) {
    return;
  }

  statsGrid.replaceChildren();

  const stats = [
    [
      "ЛИЦО",
      String(
        result.face_count
      ),
      "обнаружено"
    ],
    [
      "ТОЧКИ",
      result.landmarks_count ===
      null
        ? "—"
        : formatValue(
            result.landmarks_count
          ),
      "геометрии лица"
    ],
    [
      "ИЗМЕРЕНИЯ",
      String(
        result.feature_count ||
          result.detected_features ||
          countLeaves(
            result.metrics
          )
      ),
      "показателей"
    ]
  ];

  stats.forEach(
    ([
      labelText,
      valueText,
      detailText
    ]) => {
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
        labelText;

      const value =
        document.createElement(
          "strong"
        );

      value.textContent =
        valueText;

      const detail =
        document.createElement(
          "small"
        );

      detail.textContent =
        detailText;

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

/* ============================================================
   OVERVIEW
   ============================================================ */

function renderOverview(
  metrics,
  production
) {
  if (!overviewGrid) {
    return;
  }

  overviewGrid.replaceChildren();

  const sections = [
    {
      title: "Гармония",
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
      title: "Геометрия лица",
      values:
        getGroup(
          metrics,
          ["face_geometry"]
        )
    },
    {
      title: "Симметрия",
      values:
        getGroup(
          metrics,
          ["symmetry"]
        )
    }
  ];

  let rendered = 0;

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
    overviewGrid.appendChild(
      createEmptyBlock(
        "Измерения не были получены."
      )
    );
  }
}

/* ============================================================
   HARMONY
   ============================================================ */

function renderHarmony(
  metrics,
  production
) {
  if (!harmonyContent) {
    return;
  }

  harmonyContent.replaceChildren();

  const values = [
    ...getProductionValues(
      production,
      [
        "overall_harmony",
        "frontal_harmony",
        "proportions"
      ]
    ),
    ...getGroup(
      metrics,
      ["face_geometry"]
    ),
    ...getGroup(
      metrics,
      ["midface"]
    )
  ];

  if (!values.length) {
    harmonyContent.appendChild(
      createEmptyBlock(
        "Показатели гармонии не были получены."
      )
    );

    return;
  }

  appendSectionIntro(
    harmonyContent,
    "Гармония лица",
    "Показатели соответствуют данным, которые вернул сервер."
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

/* ============================================================
   METRICS
   ============================================================ */

function renderMetrics(
  metrics
) {
  if (!metricsContent) {
    return;
  }

  metricsContent.replaceChildren();

  const entries =
    flattenObject(
      metrics
    );

  if (!entries.length) {
    metricsContent.appendChild(
      createEmptyBlock(
        "Подробные измерения не были получены."
      )
    );

    return;
  }

  const grouped =
    groupMetricEntries(
      entries
    );

  Object.entries(
    grouped
  ).forEach(
    ([group, values]) => {
      const section =
        document.createElement(
          "section"
        );

      section.className =
        "metric-group";

      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        getRussianLabel(
          group
        );

      section.appendChild(
        title
      );

      values.forEach(
        ([path, value]) => {
          section.appendChild(
            createScaleCard(
              path,
              value
            )
          );
        }
      );

      metricsContent.appendChild(
        section
      );
    }
  );
}

function groupMetricEntries(
  entries
) {
  const grouped = {};

  entries.forEach(
    ([path, value]) => {
      const parts =
        String(path).split(".");

      const group =
        parts.length > 1
          ? parts[0]
          : "metrics";

      if (!grouped[group]) {
        grouped[group] = [];
      }

      grouped[group].push([
        path,
        value
      ]);
    }
  );

  return grouped;
}

/* ============================================================
   ANGULARITY
   ============================================================ */

function renderAngularity(
  metrics,
  production
) {
  if (!angularityContent) {
    return;
  }

  angularityContent.replaceChildren();

  const values = [
    ...getGroup(
      metrics,
      ["jaw"]
    ),
    ...getGroup(
      metrics,
      ["cheeks"]
    ),
    ...getProductionValues(
      production,
      [
        "angularity",
        "facial_definition"
      ]
    )
  ];

  if (!values.length) {
    angularityContent.appendChild(
      createEmptyBlock(
        "Показатели угловатости не были получены."
      )
    );

    return;
  }

  appendSectionIntro(
    angularityContent,
    "Угловатость и выраженность",
    "Визуальная шкала выраженности соответствующих характеристик."
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

/* ============================================================
   SYMMETRY
   ============================================================ */

function renderSymmetry(
  metrics,
  production
) {
  if (!symmetryContent) {
    return;
  }

  symmetryContent.replaceChildren();

  const values = [
    ...getGroup(
      metrics,
      ["symmetry"]
    ),
    ...getGroup(
      metrics,
      ["eyes"]
    ).filter(
      ([key]) =>
        key ===
        "eye_alignment"
    ),
    ...getProductionValues(
      production,
      ["symmetry"]
    )
  ];

  if (!values.length) {
    symmetryContent.appendChild(
      createEmptyBlock(
        "Показатели симметрии не были получены."
      )
    );

    return;
  }

  appendSectionIntro(
    symmetryContent,
    "Симметрия",
    "Показатели баланса между сторонами лица."
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

/* ============================================================
   DIMORPHISM
   ============================================================ */

function renderDimorphism(
  metrics,
  production
) {
  if (!dimorphismContent) {
    return;
  }

  dimorphismContent.replaceChildren();

  const values =
    getProductionValues(
      production,
      ["dimorphism"]
    );

  if (!values.length) {
    dimorphismContent.appendChild(
      createEmptyBlock(
        "Отдельный показатель визуальной выраженности черт не был возвращён."
      )
    );

    return;
  }

  appendSectionIntro(
    dimorphismContent,
    "Диморфизм",
    "Отдельный визуальный показатель, если он был возвращён сервером."
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

/* ============================================================
   HEALTH
   ============================================================ */

function renderHealth() {
  if (!healthContent) {
    return;
  }

  healthContent.replaceChildren();

  const icon =
    document.createElement(
      "div"
    );

  icon.className =
    "note-icon";

  icon.textContent = "i";

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

/* ============================================================
   SCALE CARD
   ============================================================ */

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
      ? formatMetricRaw(value)
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

  track.setAttribute(
    "role",
    "meter"
  );

  track.setAttribute(
    "aria-valuemin",
    "0"
  );

  track.setAttribute(
    "aria-valuemax",
    "10"
  );

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

    fill.style.setProperty(
      "--metric-value",
      `${percent}%`
    );

    fill.dataset.level =
      getMetricLevel(
        numeric
      );

    track.setAttribute(
      "aria-valuenow",
      String(numeric)
    );
  } else {
    fill.style.width =
      "0%";

    track.setAttribute(
      "aria-valuetext",
      "Нет числовой оценки"
    );
  }

  track.appendChild(
    fill
  );

  const scale =
    document.createElement(
      "div"
    );

  scale.className =
    "metric-scale__labels";

  [
    "Слабее",
    "Средне",
    "Выражено"
  ].forEach(
    (text) => {
      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        text;

      scale.appendChild(
        label
      );
    }
  );

  card.append(
    top,
    track,
    scale
  );

  return card;
}

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
    !Number.isFinite(number)
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

function formatMetricRaw(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  return formatValue(
    value
  );
}

/* ============================================================
   HISTORY
   ============================================================ */

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

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (entry) =>
          isObject(entry)
      )
      .slice(
        0,
        HISTORY_LIMIT
      );
  } catch (error) {
    console.warn(
      "History read error:",
      error
    );

    return [];
  }
}

function saveHistory(
  result
) {
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
        result.detected_features
    };

    history.unshift(
      entry
    );

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        history.slice(
          0,
          HISTORY_LIMIT
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

  historyList.replaceChildren();

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

      meta.textContent =
        `${entry.face_count || 0} лицо · ` +
        `${
          entry.feature_count ||
          entry.detected_features ||
          0
        } измерений`;

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

/* ============================================================
   RESULT TABS
   ============================================================ */

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
          selectResultTab(
            tab,
            tabs,
            panels
          );
        }
      );

      tab.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key ===
              "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            selectResultTab(
              tab,
              tabs,
              panels
            );
          }
        }
      );
    }
  );
}

function selectResultTab(
  tab,
  tabs,
  panels
) {
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
        String(active)
      );

      item.tabIndex =
        active ? 0 : -1;
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

  selectResultTab(
    firstTab,
    reportTabs.querySelectorAll(
      ".tab"
    ),
    document.querySelectorAll(
      ".tab-panel"
    )
  );
}

/* ============================================================
   NEW ANALYSIS
   ============================================================ */

function startNewAnalysis() {
  analysisRequestId++;

  cancelCurrentAnalysis();

  selectedFile = null;
  currentAnalysis = null;

  revokeSelectedObjectUrl();

  if (fileInput) {
    fileInput.value = "";
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

  moveAnalysisFrameBack();

  resetAnalysisPreview();
  resetLoadingSteps();

  showScreen("home");
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(
  message
) {
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

  window.clearTimeout(
    toastTimer
  );

  toastTimer =
    window.setTimeout(
      () => {
        toast.classList.remove(
          "show"
        );
      },
      4000
    );
}

/* ============================================================
   ERRORS
   ============================================================ */

function isAbortError(
  error
) {
  return (
    error?.name ===
    "AbortError"
  );
}

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
    return "Фотография слишком большая.";
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
      "Сервер анализа вернул ошибку авторизации."
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
    return "Некорректный запрос к серверу анализа.";
  }

  if (status === 401) {
    return "Ошибка авторизации сервера.";
  }

  if (status === 403) {
    return "Доступ к серверу анализа запрещён.";
  }

  if (status === 413) {
    return "Фотография слишком большая.";
  }

  if (status === 429) {
    return "Слишком много запросов. Попробуй позже.";
  }

  if (status >= 500) {
    return "Ошибка сервера анализа.";
  }

  return `Ошибка сервера (${status}).`;
}

/* ============================================================
   FORMATTING
   ============================================================ */

function formatBytes(
  bytes
) {
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

function formatScore(
  score
) {
  const number =
    Number(score);

  if (!Number.isFinite(number)) {
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

function formatValue(
  value
) {
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
    if (!Number.isFinite(value)) {
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

  return String(value);
}

function formatDate(
  value
) {
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

/* ============================================================
   LABEL HELPERS
   ============================================================ */

function getRussianLabel(
  key
) {
  const raw =
    String(key || "");

  const lastPart =
    raw.includes(".")
      ? raw.split(".").pop()
      : raw;

  return (
    LABELS[lastPart] ||
    LABELS[raw] ||
    prettifyKey(lastPart)
  );
}

function prettifyKey(
  key
) {
  return String(key || "")
    .replace(
      /[\_-]+/g,
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

/* ============================================================
   OBJECT HELPERS
   ============================================================ */

function isObject(
  value
) {
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

function countLeaves(
  object
) {
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

function appendSectionIntro(
  container,
  titleText,
  descriptionText
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
    titleText;

  const span =
    document.createElement(
      "span"
    );

  span.textContent =
    descriptionText;

  heading.append(
    strong,
    span
  );

  container.appendChild(
    heading
  );
}

/* ============================================================
   METRIC GROUP HELPERS
   ============================================================ */

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

      if (isObject(group)) {
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
  if (!isObject(production)) {
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

/* ============================================================
   EVENTS
   ============================================================ */

function bindEvents() {
  uploadButton?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      openFilePicker();
    }
  );

  fileInput?.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files?.[0];

      handleFileSelected(file);
    }
  );

  document
    .querySelectorAll(
      "[data-screen]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          () => {
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

  newAnalysisButton?.addEventListener(
    "click",
    startNewAnalysis
  );

  bindResultTabs();

  window.addEventListener(
    "resize",
    () => {
      if (
        currentScreen ===
        "analysis"
      ) {
        drawDecorativeLandmarks();
      }
    }
  );

  window.addEventListener(
    "pagehide",
    () => {
      cancelCurrentAnalysis();
      revokeSelectedObjectUrl();
    }
  );
}

/* ============================================================
   STARTUP
   ============================================================ */

function init() {
  initTelegram();

  localizeStaticUi();

  bindEvents();

  normalizeStaticResultText();

  updateHistoryCount();

  activateDefaultResultTab();

  showScreen("home");

  checkWorkerHealth().then(
    (healthy) => {
      if (!healthy) {
        console.warn(
          "FaceMetric: Worker health check failed."
        );
      }
    }
  );
}

init();
