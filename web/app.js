// web/app.js
"use strict";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const REQUEST_TIMEOUT = 45_000;
const HEALTH_TIMEOUT = 8_000;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const API_ENDPOINT = "https://facebot-gemini.snow4lyt.workers.dev/api/analyze";
const HEALTH_ENDPOINT = "https://facebot-gemini.snow4lyt.workers.dev/api/health";
const HISTORY_KEY = "facemetric_history_v2";

const tg = window.Telegram?.WebApp || null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const screens = $$(".screen");

const fileInput = $("#file-input");
const uploadButton = $("#upload-btn");
const uploadZone = $("#upload-zone");
const uploadName = $("#upload-name");

const analysisImage = $("#analysis-image");
const analysisFrame = $("#analysis-frame");
const landmarkCanvas = $("#landmark-canvas");
const featureCount = $("#feature-count");
const resultFeatureCount = $("#result-feature-count");
const analysisState = $("#analysis-state");
const analysisScore = $("#analysis-score");
const analysisScoreValue = analysisScore
  ? $("strong", analysisScore)
  : null;

const loadingContent = $("#loading-content");
const loadingTitle = $("#loading-title");
const loadingText = $("#loading-text");
const loadingProgressBar = $("#loading-progress-bar");
const loadingSteps = $$(".loading-step");

const resultScore = $("#result-score");
const scoreProgress = $("#score-progress");
const scoreStatus = $("#score-status");

const statsGrid = $("#stats-grid");
const overviewGrid = $("#overview-grid");

const harmonyContent = $("#harmony-content");
const metricsContent = $("#metrics-content");
const angularityContent = $("#angularity-content");
const symmetryContent = $("#symmetry-content");
const dimorphismContent = $("#dimorphism-content");
const healthContent = $("#health-content");

const reportTabs = $("#report-tabs");
const historyCount = $("#history-count");
const historyList = $("#history-list");

const newAnalysisButton = $("#new-analysis");
const toast = $("#toast");

let selectedFile = null;
let selectedObjectUrl = null;

let currentAnalysis = null;
let currentScreen = "home";

let analysisRequestId = 0;
let activeAbortController = null;

let toastTimer = null;
let resultAnimationTimer = null;

let activeResultView = "front";
let activeMetric = null;


/* ============================================================
   LABELS
============================================================ */

const LABELS = {
  face_geometry: "Геометрия лица",
  facial_width_height_balance: "Баланс ширины и высоты",
  face_aspect_ratio: "Соотношение лица",
  facial_width_height: "Баланс ширины и высоты",
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
  profile_harmony: "Гармония профиля",

  proportions: "Пропорции",
  facial_definition: "Выраженность черт",
  angularity: "Угловатость",
  confidence: "Уверенность анализа",
  dimorphism: "Визуальная выраженность черт",

  rotation: "Поворот лица",
  alignment: "Выравнивание лица",
  face_orientation: "Ориентация лица"
};


/* ============================================================
   METRIC ZONES
============================================================ */

const METRIC_ZONES = {
  eyes: {
    label: "Область глаз",
    description:
      "Глаза, расстояние между ними и их взаимное выравнивание."
  },

  eyebrows: {
    label: "Брови",
    description:
      "Положение, форма и симметрия бровей."
  },

  nose: {
    label: "Нос",
    description:
      "Ширина, длина и соотношение носа с остальной геометрией лица."
  },

  jaw: {
    label: "Челюсть",
    description:
      "Ширина, форма и визуальная выраженность линии челюсти."
  },

  chin: {
    label: "Подбородок",
    description:
      "Выраженность и пропорции подбородка."
  },

  cheeks: {
    label: "Скулы",
    description:
      "Положение и выраженность скуловой области."
  },

  lips_mouth: {
    label: "Рот и губы",
    description:
      "Ширина рта, пропорции губ и симметрия."
  },

  midface: {
    label: "Средняя треть",
    description:
      "Баланс области между глазами, носом и ртом."
  },

  face_geometry: {
    label: "Геометрия лица",
    description:
      "Общие пропорции, ширина, высота и форма лица."
  },

  symmetry: {
    label: "Обе стороны лица",
    description:
      "Сравнение левой и правой стороны лица."
  },

  overall_harmony: {
    label: "Всё лицо",
    description:
      "Обобщённая оценка гармонии видимых черт."
  },

  frontal_harmony: {
    label: "Анфас",
    description:
      "Гармония лица при фронтальном ракурсе."
  },

  profile_harmony: {
    label: "Профиль",
    description:
      "Гармония лица при боковом ракурсе."
  },

  angularity: {
    label: "Контуры лица",
    description:
      "Выраженность углов и структурных контуров лица."
  },

  facial_definition: {
    label: "Выраженность черт",
    description:
      "Насколько отчётливо видны основные контуры и черты."
  },

  dimorphism: {
    label: "Диморфизм",
    description:
      "Визуальная выраженность черт, которую backend явно вернул для анализа."
  }
};


/* ============================================================
   TELEGRAM
============================================================ */

function initTelegram() {
  if (!tg) return;

  try {
    tg.ready();
    tg.expand?.();

    tg.setHeaderColor?.("#07080a");
    tg.setBackgroundColor?.("#07080a");
  } catch (error) {
    console.warn("Telegram:", error);
  }
}


/* ============================================================
   SCREENS
============================================================ */

function showScreen(name) {
  const target = document.getElementById(`screen-${name}`);

  if (!target) return;

  screens.forEach(screen => {
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
  }
}


function updateNavigation(name) {
  $$(".nav-item").forEach(item => {
    const target = item.dataset.screen;

    item.classList.toggle(
      "active",
      target === name ||
      (
        target === "home" &&
        (
          name === "analysis" ||
          name === "result"
        )
      )
    );
  });
}


/* ============================================================
   FILE
============================================================ */

function openFilePicker() {
  if (!fileInput) {
    showToast("Не найден загрузчик фотографии.");
    return;
  }

  fileInput.value = "";
  fileInput.click();
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


function handleFileSelected(file) {
  const validation = validateFile(file);

  if (!validation.valid) {
    showToast(validation.message);
    return;
  }

  cancelActiveAnalysis();

  analysisRequestId++;

  selectedFile = file;

  revokeSelectedObjectUrl();

  selectedObjectUrl = URL.createObjectURL(file);

  if (uploadName) {
    uploadName.textContent =
      `${file.name} · ${formatBytes(file.size)}`;
  }

  if (analysisImage) {
    analysisImage.src = selectedObjectUrl;
    analysisImage.alt = "Фотография для анализа";
  }

  clearAnalysisError();

  resetAnalysisPreview();

  showScreen("analysis");

  startAnalysis(file);
}


/* ============================================================
   ANALYSIS PREVIEW
============================================================ */

function resetAnalysisPreview() {
  analysisScore?.classList.remove(
    "show",
    "float",
    "is-final"
  );

  if (analysisScoreValue) {
    analysisScoreValue.textContent = "—";
  }

  const small =
    analysisScore?.querySelector("small");

  if (small) {
    small.textContent = "/ 10";
  }

  if (analysisState) {
    analysisState.textContent = "АНАЛИЗ";
  }

  if (featureCount) {
    featureCount.textContent = "—";
  }

  loadingContent?.classList.remove("is-hidden");

  if (loadingProgressBar) {
    loadingProgressBar.style.width = "0%";
  }

  clearLandmarks();
}


/* ============================================================
   START ANALYSIS
============================================================ */

async function startAnalysis(file) {
  const requestId =
    ++analysisRequestId;

  cancelActiveAnalysis();

  activeAbortController =
    new AbortController();

  setLoadingState(
    "Подготовка",
    "Проверяем фотографию перед отправкой…",
    8
  );

  try {
    await runHealthCheck(
      activeAbortController.signal
    );

    if (requestId !== analysisRequestId) {
      return;
    }

    setLoadingState(
      "Загрузка",
      "Передаём фотографию на анализ…",
      22
    );

    const result =
      await requestAnalysis(
        file,
        activeAbortController.signal
      );

    if (requestId !== analysisRequestId) {
      return;
    }

    setLoadingState(
      "Обработка",
      "Получаем и нормализуем результаты анализа…",
      70
    );

    const normalized =
      normalizeAnalysisResult(result);

    currentAnalysis =
      normalized;

    updateAnalysisPreview(
      normalized
    );

    setLoadingState(
      "Готово",
      "Анализ завершён.",
      100
    );

    await wait(500);

    if (requestId !== analysisRequestId) {
      return;
    }

    saveHistoryItem(
      normalized
    );

    renderResult(
      normalized
    );

    showScreen("result");

  } catch (error) {
    if (
      requestId !== analysisRequestId ||
      error?.name === "AbortError"
    ) {
      return;
    }

    console.error(
      "Analysis failed:",
      error
    );

    showAnalysisError(
      getErrorMessage(error)
    );

  } finally {
    if (
      requestId === analysisRequestId
    ) {
      activeAbortController = null;
    }
  }
}
