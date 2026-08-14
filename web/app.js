// ============================================================
// FACE METRIC APP - UNIFIED FRONTEND v2026.08.15-gender-modal-fix
// ============================================================

window.__FACEMETRIC_APP_VERSION__ = "2026-08-15-final-ux-v1";


// ============================================================
// GEMINI BYOK
// ============================================================

const GEMINI_STORAGE_KEY = "facemetric_gemini_key";
const LEGACY_GEMINI_STORAGE_KEY = "gemini_api_key";
const CLASSIFICATION_STORAGE_KEY = "facemetric_classification_settings_v1";

function readStorage(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (error) {
    console.warn("FaceMetric: localStorage is unavailable.", error);
    return "";
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("FaceMetric: could not save Gemini API key.", error);
    return false;
  }
}

function getClassificationSettings() {
  try {
    const raw = window.localStorage.getItem(CLASSIFICATION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (data.gender !== "male" && data.gender !== "female")) return null;
    return {
      gender: data.gender,
      adultConfirmed: data.adultConfirmed === true
    };
  } catch (error) {
    console.warn("FaceMetric: classification settings are unavailable.", error);
    return null;
  }
}

function saveClassificationSettings(gender, adultConfirmedValue) {
  try {
    window.localStorage.setItem(
      CLASSIFICATION_STORAGE_KEY,
      JSON.stringify({
        gender: gender === "female" ? "female" : "male",
        adultConfirmed: adultConfirmedValue === true
      })
    );
    return true;
  } catch (error) {
    console.warn("FaceMetric: could not save classification settings.", error);
    return false;
  }
}

function clearClassificationSettings() {
  try {
    window.localStorage.removeItem(CLASSIFICATION_STORAGE_KEY);
  } catch (error) {
    console.warn("FaceMetric: could not clear classification settings.", error);
  }
}

function openClassificationModal(options = {}) {
  const modal = document.getElementById("classificationModal");
  const gender = document.getElementById("classificationGender");
  const adult = document.getElementById("classificationAdult");
  const error = document.getElementById("classificationModalError");

  if (!modal || !gender || !adult) {
    console.error("FaceMetric: classification modal is missing from index.html.");
    return false;
  }

  const saved = getClassificationSettings();
  gender.value = selectedGender === "female" ? "female" : (saved?.gender || "male");
  adult.checked = adultConfirmed === true;
  if (error) { error.hidden = true; error.textContent = ""; }

  modal.hidden = false;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  if (options.focus !== false) {
    window.setTimeout(() => gender.focus(), 0);
  }
  return true;
}

function closeClassificationModal() {
  const modal = document.getElementById("classificationModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function initClassificationModal() {
  const modal = document.getElementById("classificationModal");
  const form = document.getElementById("classificationForm");
  const gender = document.getElementById("classificationGender");
  const adult = document.getElementById("classificationAdult");
  const error = document.getElementById("classificationModalError");

  if (!modal || !form || !gender || !adult) {
    console.error("FaceMetric: classification modal elements were not found.");
    return;
  }

  // Make the wording explicit: the answer is about the person in the photo.
  const title = modal.querySelector("[data-classification-title], h2, h3, .modal-title");
  if (title) {
    title.textContent = "Параметры человека на фото";
  }

  const genderLabel = modal.querySelector('label[for="classificationGender"]');
  if (genderLabel) {
    genderLabel.textContent = "Кто на фото?";
  }

  const adultLabel = modal.querySelector('label[for="classificationAdult"]');
  if (adultLabel) {
    adultLabel.textContent = "Человеку на фото 18 лет или больше";
  }

  const submitButton =
    form.querySelector('button[type="submit"], input[type="submit"]');
  if (submitButton) {
    submitButton.textContent = "Продолжить анализ";
  }

  const saved = getClassificationSettings();

  // The modal is hidden until a photo is uploaded. Saved values are
  // only convenient defaults; they never count as a fresh confirmation.
  selectedGender =
    saved?.gender === "female"
      ? "female"
      : "male";
  adultConfirmed = false;

  if (genderSelect) {
    genderSelect.value = selectedGender;
  }

  if (adultConfirm) {
    adultConfirm.checked = false;
  }

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");

  form.addEventListener("submit", event => {
    event.preventDefault();

    const nextGender =
      gender.value === "female"
        ? "female"
        : "male";

    selectedGender = nextGender;
    adultConfirmed = Boolean(adult.checked);

    if (genderSelect) {
      genderSelect.value = selectedGender;
    }

    if (adultConfirm) {
      adultConfirm.checked = adultConfirmed;
    }

    if (!saveClassificationSettings(selectedGender, adultConfirmed)) {
      if (error) {
        error.textContent =
          "Не удалось сохранить настройки в браузере.";
        error.hidden = false;
      }
      return;
    }

    closeClassificationModal();
    updateAnalysisButtonState();

    if (selectedFile) {
      showToast(
        "Параметры фото подтверждены. Начинаем анализ…"
      );
      startAnalysis(selectedFile, selectedProfileFile);
    }
  });

  modal.addEventListener("keydown", event => {
    if (event.key === "Escape") event.preventDefault();
  });
}

function maybeOpenClassificationModal() {
  // Classification is intentionally requested only after a photo is uploaded.
  return false;
}

function getGeminiApiKey() {
  return (
    readStorage(GEMINI_STORAGE_KEY) ||
    readStorage(LEGACY_GEMINI_STORAGE_KEY) ||
    ""
  ).trim();
}

function setGeminiApiKey(key) {
  const value = String(key || "").trim();

  if (!value) {
    return false;
  }

  return writeStorage(GEMINI_STORAGE_KEY, value);
}

function clearGeminiApiKey() {
  try {
    window.localStorage.removeItem(GEMINI_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_GEMINI_STORAGE_KEY);
  } catch (error) {
    console.warn("FaceMetric: could not remove Gemini API key.", error);
  }
}

function openGeminiKeyModal(options = {}) {
  const modal = document.getElementById("apiKeyModal");
  const input = document.getElementById("geminiApiKeyInput");
  const error = document.getElementById("geminiApiKeyError");

  if (!modal || !input) {
    console.error("FaceMetric: Gemini API key modal is missing from index.html.");
    showToast("Не найдено окно для Gemini API ключа.");
    return false;
  }

  const currentKey = getGeminiApiKey();

  input.value = currentKey;

  if (error) {
    error.textContent = "";
    error.hidden = true;
  }

  modal.hidden = false;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  // Prevent accidental analysis while the key is missing.
  if (options.focus !== false) {
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  return true;
}

function closeGeminiKeyModal() {
  const modal = document.getElementById("apiKeyModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function initGeminiKeyModal() {
  const modal = document.getElementById("apiKeyModal");
  const input = document.getElementById("geminiApiKeyInput");
  const saveButton = document.getElementById("saveGeminiKeyBtn");
  const form = document.getElementById("geminiApiKeyForm");
  const error = document.getElementById("geminiApiKeyError");

  if (!modal || !input || !saveButton) {
    console.error(
      "FaceMetric: Gemini API key modal elements were not found."
    );
    return;
  }

  const savedKey = getGeminiApiKey();

  modal.hidden = Boolean(savedKey);
  modal.classList.toggle("show", !savedKey);
  modal.setAttribute("aria-hidden", savedKey ? "true" : "false");

  const showKeyError = message => {
    if (!error) {
      showToast(message);
      return;
    }

    error.textContent = message;
    error.hidden = false;
  };

  const saveKey = async event => {
    event?.preventDefault();

    const key = input.value.trim();

    if (!key) {
      showKeyError("Введите Gemini API ключ.");
      input.focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Проверяем ключ…";

    try {
      const response = await fetchWithTimeout(
        VALIDATE_KEY_ENDPOINT,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Gemini-Key": key
          },
          cache: "no-store"
        },
        HEALTH_TIMEOUT
      );

      const text = await response.text();
      let data = null;

      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }

      if (!response.ok || data?.success !== true) {
        const validationError = new Error(
          data?.detail ||
          getHttpErrorMessage(response.status)
        );
        validationError.code = data?.code || "GEMINI_API_ERROR";
        validationError.status = response.status;
        throw validationError;
      }

      if (!setGeminiApiKey(key)) {
        showKeyError(
          "Не удалось сохранить ключ в браузере. Проверь разрешение localStorage."
        );
        return;
      }

      if (error) {
        error.textContent = "";
        error.hidden = true;
      }

      closeGeminiKeyModal();

      // If the user selected a photo before entering the key, resume the
      // same upload flow instead of making them pick the file again.
      const pendingFile = fileInput?.files?.[0];
      if (pendingFile) {
        handleFileSelected(pendingFile);
      } else {
        showToast("Gemini API ключ проверен и сохранён.");
      }
    } catch (validationError) {
      console.error("FaceMetric Gemini key validation:", validationError);

      if (validationError?.code === "GEMINI_QUOTA_EXCEEDED") {
        showKeyError(
          "Лимит этого Gemini API ключа исчерпан. Введи другой ключ."
        );
      } else if (validationError?.code === "GEMINI_INVALID_KEY") {
        showKeyError(
          "Gemini API ключ недействителен или не имеет доступа к Gemini API."
        );
      } else if (isAbortError(validationError)) {
        showKeyError("Проверка ключа заняла слишком много времени. Попробуй ещё раз.");
      } else {
        showKeyError(
          validationError?.message ||
          "Не удалось проверить Gemini API ключ."
        );
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Подключить и сохранить";
    }
  };

  saveButton.addEventListener("click", saveKey);
  form?.addEventListener("submit", saveKey);

  input.addEventListener("input", () => {
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  });

  // Do not allow the mandatory BYOK modal to be dismissed without
  // entering a key. Escape is intentionally ignored while it is required.
  modal.addEventListener("keydown", event => {
    if (event.key === "Escape" && getGeminiApiKey()) {
      closeGeminiKeyModal();
    }
  });

  if (!savedKey) {
    window.setTimeout(() => openGeminiKeyModal(), 0);
  }
}

window.openGeminiKeyModal = openGeminiKeyModal;
window.clearGeminiApiKey = clearGeminiApiKey;

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
const VALIDATE_KEY_ENDPOINT = "https://facebot-gemini.snow4lyt.workers.dev/api/validate-key";
const HISTORY_KEY = "facemetric_history_v2";

const tg = window.Telegram?.WebApp || null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const screens = $$(".screen");

const fileInput = $("#file-input");
const uploadButton = $("#upload-btn");
const uploadZone = $("#upload-zone");
const uploadName = $("#upload-name");
const profileFileInput = $("#profile-file-input");
const profileUploadButton = $("#profile-upload-btn");
const profileUploadName = $("#profile-upload-name");
const startAnalysisButton = $("#start-analysis-btn");
const genderSelect = $("#gender-select");
const adultConfirm = $("#adult-confirm");

const analysisImage = $("#analysis-image");
const analysisFrame = $("#analysis-frame");
const landmarkCanvas = $("#landmark-canvas");
const featureCount = $("#feature-count");
const resultFeatureCount = $("#result-feature-count");
const analysisState = $("#analysis-state");
const alignmentStatus = $("#alignment-status");
const analysisScanHud = $("#analysis-scan-hud");
const analysisScanTitle = $("#analysis-scan-title");
const analysisScanDetail = $("#analysis-scan-detail");
const analysisScanProgress = $("#analysis-scan-progress");
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
let selectedProfileFile = null;
let selectedProfileObjectUrl = null;

// Classification settings. Geometric measurements remain independent.
let selectedGender = "male";
let adultConfirmed = false;

// Expose read-only diagnostics for debugging the deployed frontend.
window.FaceMetricClassification = {
  get gender() { return selectedGender === "female" ? "female" : "male"; },
  get adultConfirmed() { return adultConfirmed === true; }
};

let currentAnalysis = null;
let currentScreen = "home";

let analysisRequestId = 0;
let activeAbortController = null;

let toastTimer = null;
let resultAnimationTimer = null;
let analysisScanTimer = null;
let analysisScanStartedAt = 0;

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
  if (!getGeminiApiKey()) {
    openGeminiKeyModal();
    showToast("Сначала введи Gemini API ключ.");
    return;
  }

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
    uploadName.textContent = `${file.name} · ${formatBytes(file.size)}`;
  }

  if (analysisImage) {
    analysisImage.src = selectedObjectUrl;
    analysisImage.alt = "Фотография анфас для анализа";
  }

  clearAnalysisError();
  resetAnalysisPreview();

  // Classification is asked for the newly uploaded photo, every time.
  // Keep the last gender as a convenient default, but never silently
  // reuse the previous 18+ confirmation.
  const savedClassification = getClassificationSettings();
  selectedGender =
    savedClassification?.gender === "female"
      ? "female"
      : "male";
  adultConfirmed = false;

  showScreen("analysis");

  setAnalysisState("ОЖИДАЕМ КЛАССИФИКАЦИЮ ФОТО");
  showProfileUploadControl();
  updateAnalysisButtonState();

  // Let the uploaded image render first, then open the modal above it.
  window.setTimeout(() => {
    openClassificationModal({ focus: true, forPhoto: true });
  }, 120);
}

function handleProfileFileSelected(file) {
  if (!getGeminiApiKey()) {
    openGeminiKeyModal();
    showToast("Сначала введи Gemini API ключ.");
    return;
  }

  if (!selectedFile) {
    showToast("Сначала добавь фотографию анфас.");
    return;
  }

  const validation = validateFile(file);

  if (!validation.valid) {
    showToast(validation.message);
    return;
  }

  selectedProfileFile = file;
  revokeSelectedProfileObjectUrl();
  selectedProfileObjectUrl = URL.createObjectURL(file);

  if (profileUploadName) {
    profileUploadName.textContent = `${file.name} · ${formatBytes(file.size)}`;
  }

  showProfileUploadControl();
  updateAnalysisButtonState();
  showToast("Фото профиля добавлено. Теперь профиль войдёт в общий рейтинг.");
}

function showProfileUploadControl() {
  const card = document.getElementById("profile-upload-card");
  if (card) {
    card.hidden = false;
    card.classList.add("is-ready");
  }
}

function revokeSelectedProfileObjectUrl() {
  if (!selectedProfileObjectUrl) return;
  try { URL.revokeObjectURL(selectedProfileObjectUrl); } catch {}
  selectedProfileObjectUrl = null;
}


/* ============================================================
   FACIAL SCANNER EXPERIENCE
============================================================ */

const ANALYSIS_SCAN_STAGES = [
  ["Сканируем лицо", "Определяем контур и положение", 12],
  ["Находим ось симметрии", "Проверяем глаза и центральную линию", 28],
  ["Измеряем пропорции", "Сравниваем видимые расстояния", 46],
  ["Проверяем черты", "Глаза · нос · губы · челюсть", 64],
  ["Проверяем симметрию", "Сопоставляем левую и правую стороны", 79],
  ["Выравниваем кадр", "Поворот · центр · масштаб", 92]
];

function setAnalysisScannerStage(index, force = false) {
  const stage = ANALYSIS_SCAN_STAGES[
    Math.max(0, Math.min(ANALYSIS_SCAN_STAGES.length - 1, index))
  ];
  if (!stage) return;

  analysisFrame?.classList.add("scanner-active");
  analysisScanHud?.classList.add("is-visible");
  if (analysisScanTitle) analysisScanTitle.textContent = stage[0];
  if (analysisScanDetail) analysisScanDetail.textContent = stage[1];
  if (analysisScanProgress) analysisScanProgress.style.width = `${stage[2]}%`;

  if (force && analysisScanHud) {
    analysisScanHud.classList.remove("is-pulse");
    void analysisScanHud.offsetWidth;
    analysisScanHud.classList.add("is-pulse");
  }
}

function startAnalysisScanner() {
  stopAnalysisScanner();
  analysisScanStartedAt = performance.now();
  setAnalysisScannerStage(0, true);
  let index = 0;
  analysisScanTimer = window.setInterval(() => {
    index = Math.min(index + 1, ANALYSIS_SCAN_STAGES.length - 1);
    setAnalysisScannerStage(index, true);
    if (index >= ANALYSIS_SCAN_STAGES.length - 1) {
      clearInterval(analysisScanTimer);
      analysisScanTimer = null;
    }
  }, 720);
}

function stopAnalysisScanner(done = false) {
  if (analysisScanTimer) clearInterval(analysisScanTimer);
  analysisScanTimer = null;
  if (analysisScanProgress) analysisScanProgress.style.width = done ? "100%" : "0%";
  if (analysisScanTitle) analysisScanTitle.textContent = done ? "Сканирование завершено" : "Готово к анализу";
  if (analysisScanDetail) analysisScanDetail.textContent = done ? "Измерения получены · лицо выровнено" : "";
  analysisScanHud?.classList.toggle("is-visible", done);
  analysisFrame?.classList.toggle("scanner-active", !done);
}

function getMetricLandmarkNames(key, viewType = "front") {
  const k = String(key || "").split(".").pop();
  if (viewType === "profile") {
    const profileMap = {
      nasofacial_angle: ["profile_glabella","profile_nasion","profile_pronasale"],
      nasolabial_angle: ["profile_pronasale","profile_subnasale","profile_labiale_superius"],
      gonial_angle: ["profile_pogonion","profile_gonion","profile_chin_neck"],
      nose_chin_projection: ["profile_nasion","profile_pronasale","profile_pogonion"],
      profile_projection_balance: ["profile_pronasale","profile_labiale_superius","profile_pogonion"],
      profile_harmony: ["profile_glabella","profile_nasion","profile_pronasale","profile_pogonion","profile_menton"]
    };
    return profileMap[k] || ["profile_glabella","profile_nasion","profile_pronasale","profile_pogonion","profile_menton"];
  }
  const map = {
    face_aspect_ratio: ["left_cheekbone","right_cheekbone","forehead_center","chin"],
    eye_alignment: ["left_eye_inner","right_eye_inner"],
    eye_spacing: ["left_eye_inner","right_eye_inner"],
    left_eye_width: ["left_eye_inner","left_eye_outer"],
    right_eye_width: ["right_eye_inner","right_eye_outer"],
    mouth_symmetry: ["mouth_left","mouth_right"],
    mouth_width: ["mouth_left","mouth_right"],
    jaw_symmetry: ["left_jaw","right_jaw"],
    jaw_width: ["left_jaw","right_jaw"],
    cheek_symmetry: ["left_cheekbone","right_cheekbone"],
    nose_width: ["nose_left","nose_right"],
    nose_length: ["nose_bridge","nose_tip"],
    chin_width: ["left_jaw","chin","right_jaw"],
    upper_to_lower_third: ["forehead_center","left_eye_inner","right_eye_inner","chin"],
    mid_to_lower_face: ["left_eye_inner","right_eye_inner","upper_lip_center","chin"],
    jaw_angle: ["left_cheekbone","left_jaw","chin","right_jaw","right_cheekbone"],
    overall_symmetry: ["left_eye_inner","right_eye_inner","mouth_left","mouth_right","left_jaw","right_jaw"],
    symmetry: ["left_eye_inner","right_eye_inner","mouth_left","mouth_right","left_jaw","right_jaw"]
  };
  return map[k] || [];
}

function metricOverlayColor(metric) {
  const status = getMetricStatus(metric?.value);
  const score = getMetricScore(metric?.value);
  if (status === "poor" || (score !== null && score < 5)) return "#ff5368";
  if (status === "average" || (score !== null && score < 7)) return "#f2c75c";
  if (status === "good" || (score !== null && score >= 7)) return "#55d98b";
  return "#75a9ff";
}

function getOverlayPoints(view) {
  const landmarks = view?.landmarks || {};
  return Object.fromEntries(
    Object.entries(landmarks).filter(([, p]) =>
      p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
    )
  );
}

function getMetricLinePairs(key, viewType, selectedNames) {
  const k = String(key || "").split(".").pop();
  if (viewType === "profile") {
    const map = {
      nasofacial_angle: [["profile_glabella","profile_nasion"],["profile_nasion","profile_pronasale"]],
      nasolabial_angle: [["profile_pronasale","profile_subnasale"],["profile_subnasale","profile_labiale_superius"]],
      gonial_angle: [["profile_pogonion","profile_gonion"],["profile_gonion","profile_chin_neck"]],
      nose_chin_projection: [["profile_nasion","profile_pronasale"],["profile_pronasale","profile_pogonion"]],
      profile_projection_balance: [["profile_pronasale","profile_labiale_superius"],["profile_labiale_superius","profile_pogonion"]]
    };
    return map[k] || selectedNames.slice(0, -1).map((name, i) => [name, selectedNames[i + 1]]);
  }
  const map = {
    face_aspect_ratio: [["left_cheekbone","right_cheekbone"],["forehead_center","chin"]],
    eye_alignment: [["left_eye_inner","right_eye_inner"]],
    eye_spacing: [["left_eye_inner","right_eye_inner"]],
    left_eye_width: [["left_eye_inner","left_eye_outer"]],
    right_eye_width: [["right_eye_inner","right_eye_outer"]],
    mouth_symmetry: [["mouth_left","mouth_right"]],
    mouth_width: [["mouth_left","mouth_right"]],
    jaw_symmetry: [["left_jaw","right_jaw"]],
    jaw_width: [["left_jaw","right_jaw"]],
    cheek_symmetry: [["left_cheekbone","right_cheekbone"]],
    nose_width: [["nose_left","nose_right"]],
    nose_length: [["nose_bridge","nose_tip"]],
    chin_width: [["left_jaw","chin"],["chin","right_jaw"]],
    upper_to_lower_third: [["forehead_center","left_eye_inner"],["left_eye_inner","right_eye_inner"],["right_eye_inner","chin"]],
    mid_to_lower_face: [["left_eye_inner","right_eye_inner"],["right_eye_inner","upper_lip_center"],["upper_lip_center","chin"]],
    jaw_angle: [["left_cheekbone","left_jaw"],["left_jaw","chin"],["chin","right_jaw"],["right_jaw","right_cheekbone"]],
    overall_symmetry: [["left_eye_inner","right_eye_inner"],["mouth_left","mouth_right"],["left_jaw","right_jaw"]],
    symmetry: [["left_eye_inner","right_eye_inner"],["mouth_left","mouth_right"],["left_jaw","right_jaw"]]
  };
  return map[k] || selectedNames.slice(0, -1).map((name, i) => [name, selectedNames[i + 1]]);
}

function drawFaceLandmarkNetwork(canvas, view, metric = null, progress = 1) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth;
  const height = rect.height || canvas.clientHeight;
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const viewType = view?.type === "profile" ? "profile" : "front";
  const points = getOverlayPoints(view);
  const names = Object.keys(points);
  if (!names.length) return;
  const xy = name => ({x:Number(points[name].x)*width, y:Number(points[name].y)*height});

  const selectedNames = metric
    ? (Array.isArray(metric.value?.landmarks) && metric.value.landmarks.length
        ? metric.value.landmarks
        : getMetricLandmarkNames(metric.key, viewType))
    : names;

  const pairs = viewType === "profile"
    ? [["profile_forehead","profile_glabella"],["profile_glabella","profile_nasion"],["profile_nasion","profile_pronasale"],["profile_pronasale","profile_subnasale"],["profile_subnasale","profile_labiale_superius"],["profile_labiale_superius","profile_labiale_inferius"],["profile_labiale_inferius","profile_pogonion"],["profile_pogonion","profile_menton"],["profile_menton","profile_chin_neck"]]
    : [["left_eye_outer","left_eye_inner"],["left_eye_inner","right_eye_inner"],["right_eye_inner","right_eye_outer"],["left_brow_inner","left_brow_outer"],["right_brow_inner","right_brow_outer"],["nose_bridge","nose_tip"],["nose_left","nose_tip"],["nose_tip","nose_right"],["mouth_left","mouth_right"],["forehead_center","nose_bridge"],["nose_bridge","mouth_center"],["mouth_center","chin"],["left_cheekbone","left_jaw"],["left_jaw","chin"],["chin","right_jaw"],["right_jaw","right_cheekbone"]];

  const visiblePairs = (metric ? getMetricLinePairs(metric.key, viewType, selectedNames) : pairs)
    .filter(([a,b]) => points[a] && points[b]);
  const count = Math.max(0, Math.floor(visiblePairs.length * Math.max(0, Math.min(1, progress))));
  const color = metric ? metricOverlayColor(metric) : "rgba(255,255,255,.78)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = metric ? 2.8 : 1.15;
  ctx.strokeStyle = color;
  ctx.shadowColor = metric ? color : "rgba(255,255,255,.28)";
  ctx.shadowBlur = metric ? 15 : 7;
  for (let i=0;i<count;i++) {
    const [a,b]=visiblePairs[i]; const A=xy(a), B=xy(b);
    ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();
  }
  ctx.shadowBlur = 0;

  const radius = metric ? 3.4 : 2.1;
  for (const name of selectedNames) {
    if (!points[name]) continue;
    const p=xy(name);
    ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
    if (metric) {
      ctx.beginPath(); ctx.arc(p.x,p.y,radius+4.5,0,Math.PI*2);
      ctx.strokeStyle="rgba(255,255,255,.58)"; ctx.lineWidth=1; ctx.stroke();
    }
  }

  if (metric && selectedNames.some(name => points[name])) {
    const visible = selectedNames.filter(name => points[name]).map(xy);
    const cx = visible.reduce((s,p)=>s+p.x,0)/visible.length;
    const cy = visible.reduce((s,p)=>s+p.y,0)/visible.length;
    const value = getMetricScore(metric.value);
    const label = `${getRussianLabel(metric.key)}${value !== null ? ` · ${formatMetricScore(value)}/10` : ""}`;
    ctx.font = "700 10px Inter, Arial, sans-serif";
    const padX = 9, padY = 6;
    const textW = ctx.measureText(label).width;
    const boxW = textW + padX*2, boxH = 23;
    const bx = Math.max(6, Math.min(width-boxW-6, cx-boxW/2));
    const by = Math.max(8, cy-boxH-18);
    ctx.fillStyle = "rgba(5,6,8,.82)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx,by,boxW,boxH,9);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, bx+padX, by+15);
  }
}

function drawAnalysisNetwork(result, metric = null, progress = 1) {
  const canvas = landmarkCanvas;
  if (!canvas || !analysisFrame) return;
  const view = getActiveView(result) || result?.frontal || {landmarks: result?.landmarks || {}, type:"front"};
  drawFaceLandmarkNetwork(canvas, view, metric, progress);
}

function animateAnalysisNetwork(result) {
  const start = performance.now();
  const duration = 1250;
  const tick = now => {
    const p = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-p, 2);
    drawAnalysisNetwork(result, null, eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function revealAnalysisScore(score) {
  if (!analysisScoreValue || !analysisScore) return;
  const target = clamp(Number(score), 0, 10);
  if (!Number.isFinite(target)) return;
  analysisScore.dataset.level = getMetricLevel(target);
  analysisScore.classList.add("show");
  const start = performance.now();
  const duration = 780;
  const tick = now => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    analysisScoreValue.textContent = formatScore(target * eased);
    if (p < 1) requestAnimationFrame(tick);
    else analysisScore.classList.add("float", "is-final");
  };
  requestAnimationFrame(tick);
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

  if (alignmentStatus) {
    alignmentStatus.textContent = "АВТОВЫРАВНИВАНИЕ · ОЖИДАНИЕ";
    alignmentStatus.dataset.state = "waiting";
  }

  stopAnalysisScanner();

  if (featureCount) {
    featureCount.textContent = "—";
  }

  loadingContent?.classList.remove("is-hidden");

  if (loadingProgressBar) {
    loadingProgressBar.style.width = "0%";
  }

  clearLandmarks();
  clearAnalysisError();

  if (analysisImage) analysisImage.style.transform = "none";
  if (landmarkCanvas) landmarkCanvas.style.transform = "none";
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

  const value = clamp(
    Number(score),
    0,
    10
  );

  if (analysisScoreValue) {
    analysisScoreValue.textContent =
      formatScore(value);
  }

  if (analysisScore) {
    analysisScore.dataset.level =
      getMetricLevel(value);

    analysisScore.classList.add("show");

    setTimeout(() => {
      if (currentScreen === "analysis") {
        analysisScore.classList.add("float");
      }
    }, 700);
  }
}


/* ============================================================
   LANDMARK CANVAS
============================================================ */

function clearLandmarks() {
  if (!landmarkCanvas) return;

  const ctx =
    landmarkCanvas.getContext("2d");

  if (!ctx) return;

  ctx.clearRect(
    0,
    0,
    landmarkCanvas.width,
    landmarkCanvas.height
  );
}


function resizeLandmarkCanvas() {
  if (!landmarkCanvas || !analysisFrame) {
    return;
  }

  const rect =
    analysisFrame.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  landmarkCanvas.width =
    Math.max(
      1,
      Math.round(rect.width * ratio)
    );

  landmarkCanvas.height =
    Math.max(
      1,
      Math.round(rect.height * ratio)
    );

  landmarkCanvas.style.width =
    `${rect.width}px`;

  landmarkCanvas.style.height =
    `${rect.height}px`;

  const ctx =
    landmarkCanvas.getContext("2d");

  ctx?.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );
}


/* ============================================================
   START ANALYSIS
============================================================ */

async function startAnalysis(file, profileFile = null) {
  if (!file) {
    showToast("Сначала добавь фотографию анфас.");
    return;
  }

  if (!adultConfirmed && !selectedFile) {
    openClassificationModal({ focus: true, forPhoto: true });
    return;
  }

  cancelActiveAnalysis();

  const requestId =
    ++analysisRequestId;

  activeAbortController =
    new AbortController();

  resetLoadingSteps();
  startAnalysisScanner();

  setAnalysisState("АНАЛИЗ");

  try {
    const analysisPromise =
      analyzePhoto(
        file,
        activeAbortController.signal,
        profileFile
      );

    await runLoadingSequence(
      analysisPromise
    );

    const raw =
      await analysisPromise;

    if (requestId !== analysisRequestId) {
      return;
    }

    if (!raw || raw.success !== true) {
      throw new Error(
        raw?.detail ||
        raw?.error ||
        "Анализ не выполнен."
      );
    }

    const result =
      normalizeClientResult(raw);

    if (
      result.face_count <= 0 ||
      result.score === null
    ) {
      setAnalysisState(
        "ЛИЦО НЕ НАЙДЕНО"
      );

      completeLoadingSteps();

      showFaceNotFound();
      startAnalysisButton?.removeAttribute("disabled");

      return;
    }

    currentAnalysis = result;

    applyAnalysisAlignment(result);

    requestAnimationFrame(() => animateAnalysisNetwork(result));

    // Keep the alignment HUD visible long enough to show what was corrected.
    window.setTimeout(() => {
      if (currentAnalysis === result) {
        setAlignmentStatus(result?.alignment?.front, "done");
      }
    }, 720);

    stopAnalysisScanner(true);

    const visibleFeatureCount =
      result.feature_count ||
      result.detected_features ||
      countLeaves(result.metrics);

    if (featureCount) {
      featureCount.textContent = String(visibleFeatureCount || "—");
    }

    if (resultFeatureCount) {
      resultFeatureCount.textContent = String(visibleFeatureCount || "—");
    }

    activeResultView = "front";

    completeLoadingSteps();

    setAnalysisState("ГОТОВО");

    revealAnalysisScore(result.score);

    saveHistory(result);

    await sleep(900);

    if (requestId !== analysisRequestId) {
      return;
    }

    renderResult(result);

    showScreen("result");

    startResultScoreTransition();
  } catch (error) {
    if (requestId !== analysisRequestId) {
      return;
    }

    if (isAbortError(error)) {
      return;
    }

    console.error(
      "FaceMetric:",
      error
    );

    setAnalysisState("ОШИБКА");
    startAnalysisButton?.removeAttribute("disabled");

    if (
      error?.code === "GEMINI_QUOTA_EXCEEDED" ||
      error?.code === "GEMINI_INVALID_KEY"
    ) {
      clearGeminiApiKey();
      openGeminiKeyModal({ focus: true });

      showToast(
        error?.code === "GEMINI_QUOTA_EXCEEDED"
          ? "Лимит Gemini API исчерпан. Введи другой ключ."
          : "Gemini API ключ недействителен. Введи другой ключ."
      );
    } else {
      showToast(
        getFriendlyErrorMessage(error)
      );
    }

    showScreen("home");
  } finally {
    if (requestId === analysisRequestId) {
      activeAbortController = null;
    }
  }
}


function cancelActiveAnalysis() {
  if (!activeAbortController) {
    return;
  }

  try {
    activeAbortController.abort();
  } catch {}

  activeAbortController = null;
}


/* ============================================================
   API
============================================================ */

async function analyzePhoto(file, signal, profileFile = null) {
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
    file.name || "front.jpg"
  );

  if (profileFile) {
    formData.append(
      "profile",
      profileFile,
      profileFile.name || "profile.jpg"
    );
  }

  // Classification state is read only from the declared frontend state.
  // There is intentionally no standalone `gender` variable here.
  const requestGender = selectedGender === "female" ? "female" : "male";
  const requestAdultConfirmed = adultConfirmed === true;

  formData.append("gender", requestGender);
  formData.append("adult_confirmed", requestAdultConfirmed ? "true" : "false");

  const userGeminiKey = getGeminiApiKey();

  let response;

  try {
    response =
      await fetchWithTimeout(
        API_ENDPOINT,
        {
          method: "POST",
          body: formData,

          headers: {
            Accept:
              "application/json",
            ...(userGeminiKey ? {"X-Gemini-Key": userGeminiKey} : {})
          },

          cache: "no-store",
          signal
        },
        REQUEST_TIMEOUT
      );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new Error(
      "Не удалось подключиться к серверу анализа."
    );
  }

  const text =
    await response.text();

  let data = null;

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Сервер вернул некорректный ответ (${response.status}).`
      );
    }
  }

  if (!response.ok) {
    const apiError = new Error(
      data?.detail ||
      data?.error ||
      getHttpErrorMessage(response.status)
    );

    apiError.code =
      data?.code ||
      (response.status === 429
        ? "GEMINI_QUOTA_EXCEEDED"
        : response.status === 401 || response.status === 403
          ? "GEMINI_INVALID_KEY"
          : "GEMINI_API_ERROR");

    apiError.status = response.status;
    apiError.geminiStatus = data?.gemini_status;

    throw apiError;
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
  options = {},
  timeout = 30000
) {
  const controller =
    new AbortController();

  const externalSignal =
    options.signal;

  const forwardAbort =
    () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        forwardAbort,
        { once: true }
      );
    }
  }

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timer);

    externalSignal?.removeEventListener(
      "abort",
      forwardAbort
    );
  }
}


/* ============================================================
   LOADING
============================================================ */

async function runLoadingSequence(
  analysisPromise
) {
  const steps = [
    ["Обрабатываем фотографию", "Подготавливаем изображение"],
    ["Определяем лицо", "Проверяем наличие и положение лица"],
    ["Измеряем пропорции", "Анализируем видимую геометрию и черты"],
    ["Проверяем симметрию", "Сравниваем видимые стороны лица"],
    ["Выравниваем кадр", "Поворот · центр · масштаб"],
    ["Формируем результат", "Собираем фактически полученные показатели"]
  ];

  for (
    let i = 0;
    i < steps.length;
    i++
  ) {
    setLoadingStep(
      i,
      steps[i][0],
      steps[i][1]
    );
    setAnalysisScannerStage(Math.min(i, ANALYSIS_SCAN_STAGES.length - 1), true);

    if (loadingProgressBar) {
      loadingProgressBar.style.width =
        `${Math.round(
          ((i + 1) /
            steps.length) *
            100
        )}%`;
    }

    if (
      i <
      steps.length - 1
    ) {
      await Promise.race([
        sleep(430),
        analysisPromise.catch(
          () => null
        )
      ]);
    } else {
      await Promise.race([
        analysisPromise.catch(
          () => null
        ),
        sleep(900)
      ]);
    }
  }
}


function resetLoadingSteps() {
  loadingSteps.forEach(
    (step, index) => {
      step.classList.toggle(
        "active",
        index === 0
      );

      step.classList.remove(
        "done"
      );
    }
  );

  if (loadingTitle) {
    loadingTitle.textContent =
      "Анализируем";
  }

  if (loadingText) {
    loadingText.textContent =
      "Подготавливаем изображение";
  }

  if (loadingProgressBar) {
    loadingProgressBar.style.width =
      "0%";
  }
}


function setLoadingStep(
  index,
  title,
  text
) {
  loadingSteps.forEach(
    step => {
      const n =
        Number(
          step.dataset.step
        );

      step.classList.toggle(
        "active",
        n === index
      );

      step.classList.toggle(
        "done",
        n < index
      );
    }
  );

  if (loadingTitle) {
    loadingTitle.textContent =
      title;
  }

  if (loadingText) {
    loadingText.textContent =
      text;
  }
}


function completeLoadingSteps() {
  loadingSteps.forEach(
    step => {
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


/* ============================================================
   NORMALIZE RESULT
============================================================ */

function normalizeClientResult(data) {
  const source =
    isObject(data.analysis)
      ? {
          ...data,
          ...data.analysis
        }
      : data;

  const topLandmarks =
    isObject(source.landmarks)
      ? source.landmarks
      : {};

  const topMetrics =
    isObject(source.metrics)
      ? source.metrics
      : {};

  const frontSource =
    source.front ||
    source.frontal ||
    source.front_view ||
    source.views?.front ||
    null;

  const profileSource =
    source.profile ||
    source.profile_view ||
    source.views?.profile ||
    null;

  const front =
    normalizeView(
      frontSource
        ? {
            ...frontSource,
            landmarks:
              frontSource.landmarks || topLandmarks,
            metrics:
              frontSource.metrics || topMetrics
          }
        : {
            available: source.face_count > 0,
            score: source.front_score ?? source.score,
            landmarks: topLandmarks,
            metrics: topMetrics
          },
      "front"
    );

  const profile =
    normalizeView(
      profileSource,
      "profile"
    );

  const sourceMetrics =
    isObject(source.metrics)
      ? source.metrics
      : {};

  const production =
    isObject(
      source.production_features
    )
      ? source.production_features
      : {};

  const dimorphism =
    normalizeDimorphism(
      source.dimorphism ||
      source.dimorphism_score ||
      production.dimorphism ||
      sourceMetrics.dimorphism
    );

  const score =
    normalizeScore(
      source.score ??
      source.overall_score ??
      source.overall?.score ??
      front.score
    );

  const profileScore =
    normalizeScore(
      source.profile_score ??
      profile.score ??
      source.profile?.score
    );

  const frontScore =
    normalizeScore(
      source.front_score ??
      front.score ??
      source.frontal_score
    );

  const views = {
    front,
    profile
  };

  const availableViews =
    Object.values(views)
      .filter(view => view.available);

  const hasProfile =
    source.has_profile === true ||
    profile.available === true;

  return {
    success: true,

    score,

    front_score:
      frontScore,

    profile_score:
      profileScore,

    face_count:
      toNumberOrZero(
        source.face_count
      ),

    landmarks_count:
      nullableNumber(
        source.landmarks_count ??
        front.landmarks_count
      ),

    detected_features:
      toNumberOrZero(
        source.detected_features
      ) ||
      countLeaves(sourceMetrics),

    feature_count:
      toNumberOrZero(
        source.feature_count
      ) ||
      countLeaves(production),

    metrics:
      sourceMetrics,

    production_features:
      production,

    dimorphism,

    alignment: normalizeAlignmentSet(
      source.alignment,
      front.landmarks,
      profile.landmarks
    ),

    classification:
      normalizeClassification(
        source.classification ||
        source.rating ||
        source.looksmax_rating ||
        source.tier
      ),

    views,

    has_profile:
      hasProfile,

    orientation:
      normalizeOrientation(
        source.orientation ||
        source.face_orientation ||
        source.alignment
      ),

    rotation:
      normalizeRotation(
        source.rotation ??
        source.rotation_angle ??
        source.alignment?.rotation ??
        source.alignment?.front?.correction_degrees
      ),

    regions:
      normalizeRegions(
        source.regions ||
        source.face_regions ||
        front.regions
      ),

    available_views:
      availableViews.map(
        view => view.type
      ),

    generated_at:
      source.generated_at ||
      new Date().toISOString()
  };
}


function normalizeView(
  data,
  type
) {
  if (!data) {
    return {
      type,
      available: false,
      score: null,
      harmony: null,
      image: null,
      image_url: null,
      image_base64: null,
      landmarks_count: null,
      landmarks: {},
      metrics: {},
      regions: []
    };
  }

  if (
    typeof data === "boolean"
  ) {
    return {
      type,
      available: data,
      score: null,
      harmony: null,
      image: null,
      image_url: null,
      image_base64: null,
      landmarks_count: null,
      landmarks: {},
      metrics: {},
      regions: []
    };
  }

  const score =
    normalizeScore(
      data.score ??
      data.harmony ??
      data.harmony_score
    );

  const image =
    data.image ||
    data.data_url ||
    data.preview ||
    null;

  const imageUrl =
    data.image_url ||
    data.url ||
    null;

  const imageBase64 =
    data.image_base64 ||
    data.base64 ||
    null;

  const metrics =
    isObject(data.metrics)
      ? data.metrics
      : {};

  const regions =
    normalizeRegions(
      data.regions ||
      data.face_regions
    );

  return {
    type,

    available:
      data.available !== false &&
      (
        data.available === true ||
        score !== null ||
        Boolean(image) ||
        Boolean(imageUrl) ||
        Boolean(imageBase64) ||
        Object.keys(metrics).length > 0
      ),

    score,

    harmony:
      score,

    image,
    image_url:
      imageUrl,

    image_base64:
      imageBase64,

    landmarks_count:
      nullableNumber(
        data.landmarks_count
      ),

    landmarks:
      isObject(data.landmarks)
        ? data.landmarks
        : {},

    metrics,

    regions,

    alignment: isObject(data.alignment) ? data.alignment : null,

    confidence:
      normalizeScore(
        data.confidence
      )
  };
}


function normalizeDimorphism(value) {
  if (isObject(value)) {
    return {
      available: true,

      score:
        normalizeScore(
          value.score ??
          value.rating ??
          value.value
        ),

      label:
        value.label ||
        value.classification ||
        null,

      confidence:
        normalizeScore(
          value.confidence
        ),

      features:
        isObject(value.features)
          ? value.features
          : {}
    };
  }

  const score =
    normalizeScore(value);

  return {
    available:
      score !== null,

    score,

    label: null,

    confidence: null,

    features: {}
  };
}


function normalizeClassification(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      label: value,
      score: null,
      band: null
    };
  }

  if (isObject(value)) {
    return {
      label:
        value.label ||
        value.name ||
        value.tier ||
        null,

      score:
        normalizeScore(
          value.score ??
          value.value
        ),

      band:
        value.band ||
        value.range ||
        null
    };
  }

  return null;
}


function normalizeOrientation(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      label: value,
      yaw: null,
      pitch: null,
      roll: null
    };
  }

  if (isObject(value)) {
    return {
      label:
        value.label ||
        value.type ||
        value.orientation ||
        null,

      yaw:
        nullableNumber(
          value.yaw
        ),

      pitch:
        nullableNumber(
          value.pitch
        ),

      roll:
        nullableNumber(
          value.roll
        )
    };
  }

  return null;
}


function normalizeRotation(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    return nullableNumber(
      value.angle ??
      value.degrees ??
      value.rotation
    );
  }

  return nullableNumber(value);
}


function normalizeAlignment(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      label: value,
      score: null
    };
  }

  if (isObject(value)) {
    return {
      label:
        value.label ||
        value.status ||
        null,

      score:
        normalizeScore(
          value.score ??
          value.value
        )
    };
  }

  return null;
}


function normalizeRegions(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeRegion)
      .filter(Boolean);
  }

  if (isObject(value)) {
    return Object.entries(value)
      .map(([key, region]) => {
        const normalized =
          normalizeRegion(
            region
          );

        if (!normalized) {
          return null;
        }

        return {
          ...normalized,
          key:
            normalized.key ||
            key
        };
      })
      .filter(Boolean);
  }

  return [];
}


function normalizeRegion(region) {
  if (!region) {
    return null;
  }

  if (
    Array.isArray(region) &&
    region.length >= 4
  ) {
    return {
      key: null,
      x: Number(region[0]),
      y: Number(region[1]),
      width: Number(region[2]),
      height: Number(region[3]),
      score: null
    };
  }

  if (!isObject(region)) {
    return null;
  }

  const x =
    Number(
      region.x ??
      region.left
    );

  const y =
    Number(
      region.y ??
      region.top
    );

  const width =
    Number(
      region.width ??
      region.w
    );

  const height =
    Number(
      region.height ??
      region.h
    );

  return {
    key:
      region.key ||
      region.name ||
      region.zone ||
      null,

    x:
      Number.isFinite(x)
        ? x
        : null,

    y:
      Number.isFinite(y)
        ? y
        : null,

    width:
      Number.isFinite(width)
        ? width
        : null,

    height:
      Number.isFinite(height)
        ? height
        : null,

    score:
      normalizeScore(
        region.score ??
        region.value
      )
  };
}


/* ============================================================
   AUTO ALIGNMENT
============================================================ */

function normalizeAlignmentSet(raw, frontLandmarks = {}, profileLandmarks = {}) {
  const make = (value, type, landmarks) => {
    if (isObject(value) && Number.isFinite(Number(value.center_x))) {
      return {
        available: value.available !== false,
        type,
        roll_degrees: Number(value.roll_degrees) || 0,
        correction_degrees: Number(value.correction_degrees) || 0,
        center_x: Number(value.center_x),
        center_y: Number(value.center_y),
        scale: Number(value.scale) || 1,
        confidence: Number(value.confidence) || 0
      };
    }
    return calculateClientAlignment(landmarks, type);
  };

  return {
    front: make(raw?.front, "front", frontLandmarks),
    profile: make(raw?.profile, "profile", profileLandmarks)
  };
}

function calculateClientAlignment(landmarks, type) {
  const entries = Object.entries(landmarks || {}).filter(([, p]) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
  if (entries.length < 3) {
    return { available: false, type, roll_degrees: 0, correction_degrees: 0, center_x: 0.5, center_y: 0.5, scale: 1, confidence: 0 };
  }

  const lm = Object.fromEntries(entries);
  let roll = 0;
  if (type === "front") {
    const left = lm.left_eye_inner || lm.left_eye_outer;
    const right = lm.right_eye_inner || lm.right_eye_outer;
    if (left && right) roll = Math.atan2(right.y - left.y, right.x - left.x) * 180 / Math.PI;
  } else {
    const a = lm.profile_glabella || lm.profile_nasion || lm.profile_forehead;
    const b = lm.profile_pogonion || lm.profile_menton || lm.profile_chin_neck;
    if (a && b) roll = Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI;
  }

  while (roll > 90) roll -= 180;
  while (roll < -90) roll += 180;

  const axisStart = type === "front"
    ? (lm.forehead_center || lm.nose_bridge)
    : (lm.profile_glabella || lm.profile_nasion || lm.profile_forehead);
  const axisEnd = type === "front"
    ? lm.chin
    : (lm.profile_pogonion || lm.profile_menton || lm.profile_chin_neck);
  const upsideDown = Boolean(axisStart && axisEnd && Number(axisEnd.y) < Number(axisStart.y));
  let correction = -roll + (upsideDown ? 180 : 0);
  while (correction > 180) correction -= 360;
  while (correction < -180) correction += 360;

  const xs = entries.map(([, p]) => Number(p.x));
  const ys = entries.map(([, p]) => Number(p.y));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.01);
  const height = Math.max(maxY - minY, 0.01);
  const targetHeight = type === "front" ? 0.76 : 0.78;
  const targetWidth = type === "front" ? 0.68 : 0.62;
  const scale = Math.max(0.82, Math.min(1.45, Math.max(targetHeight / height, targetWidth / width)));
  const confidence = entries.reduce((sum, [, p]) => sum + (Number(p.confidence) || 0), 0) / entries.length;

  return {
    available: true,
    type,
    roll_degrees: roll,
    correction_degrees: correction,
    center_x: (minX + maxX) / 2,
    center_y: (minY + maxY) / 2,
    scale,
    confidence
  };
}

function alignmentLabel(alignment) {
  if (!alignment?.available) return "АВТОВЫРАВНИВАНИЕ · НЕДОСТАТОЧНО ДАННЫХ";
  const angle = Number(alignment.correction_degrees) || 0;
  const dx = (0.5 - Number(alignment.center_x || 0.5)) * 100;
  const dy = (0.5 - Number(alignment.center_y || 0.5)) * 100;
  const scale = Number(alignment.scale || 1);
  const sign = n => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  return `ЦЕНТРИРОВАНО · ПОВОРОТ ${sign(angle)}° · X ${sign(dx)}% · Y ${sign(dy)}% · ${Math.round(scale * 100)}%`;
}

function setAlignmentStatus(alignment, state = "done") {
  if (!alignmentStatus) return;
  alignmentStatus.textContent = alignmentLabel(alignment);
  alignmentStatus.dataset.state = state;
}

function normalizeAlignmentRotation(value) {
  let angle = Number(value);
  if (!Number.isFinite(angle)) return 0;

  // Roll correction is a small tilt correction. Never allow a noisy
  // landmark estimate to flip the entire photo upside down.
  angle = ((angle + 180) % 360) - 180;

  if (Math.abs(angle) > 90) {
    angle = 0;
  }

  return clamp(angle, -45, 45);
}

function applyImageAlignment(image, alignment, frameElement = null) {
  if (!image || !alignment?.available) return;

  const rect =
    (frameElement || image.parentElement || image).getBoundingClientRect();

  const centerX = Number(alignment.center_x);
  const centerY = Number(alignment.center_y);
  const scaleValue = Number(alignment.scale);

  const tx =
    (0.5 - (Number.isFinite(centerX) ? centerX : 0.5)) *
    rect.width;

  const ty =
    (0.5 - (Number.isFinite(centerY) ? centerY : 0.5)) *
    rect.height;

  const rotate = normalizeAlignmentRotation(alignment.correction_degrees);
  const scale =
    Number.isFinite(scaleValue)
      ? clamp(scaleValue, 1, 2.2)
      : 1;

  image.style.transformOrigin = "50% 50%";
  image.style.transition =
    "transform 620ms cubic-bezier(.2,.8,.2,1)";

  image.style.transform =
    `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) ` +
    `rotate(${rotate.toFixed(2)}deg) ` +
    `scale(${scale.toFixed(3)})`;
}

function applyAnalysisAlignment(result) {
  const alignment = result?.alignment?.front;
  if (!alignment?.available) {
    if (alignmentStatus) {
      alignmentStatus.textContent = "АВТОВЫРАВНИВАНИЕ · НЕДОСТАТОЧНО ДАННЫХ";
      alignmentStatus.dataset.state = "uncertain";
    }
    return;
  }

  if (alignmentStatus) {
    alignmentStatus.textContent = "ВЫРАВНИВАЕМ · ПОВОРОТ + ЦЕНТР + МАСШТАБ";
    alignmentStatus.dataset.state = "active";
  }

  requestAnimationFrame(() => {
    applyImageAlignment(analysisImage, alignment, analysisFrame);
    setTimeout(() => setAlignmentStatus(alignment, "done"), 450);
  });
}


/* ============================================================
   RESULT
============================================================ */

function renderResult(result) {
  ensureResultFace(result);

  renderScore(result.score);

  renderStats(result);
  renderProfileSummary(result);

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

  renderViewSelector(result);

  renderClassification(result);

  renderMetricInspector(result);
  requestAnimationFrame(() => drawResultMetricOverlay(activeMetric));

  injectStageTwoStyles();
}


/* ============================================================
   RESULT FACE
============================================================ */

function ensureResultFace(result) {
  const resultScreen =
    $("#screen-result");

  const resultHero =
    $(".result-hero", resultScreen);

  if (!resultScreen || !resultHero) {
    return;
  }

  let visual =
    $("#result-visual", resultScreen);

  if (!visual) {
    visual =
      document.createElement("div");

    visual.id =
      "result-visual";

    visual.className =
      "result-visual";

    visual.innerHTML = `
      <div class="result-visual__media">

        <img
          class="result-visual__image"
          alt="Результат анализа"
        >

        <canvas
          id="result-landmark-canvas"
          class="result-landmark-canvas"
          aria-hidden="true"
        ></canvas>

        <div class="result-visual__shade"></div>

        <div
          class="result-visual__corners"
          aria-hidden="true"
        >
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </div>

        <div class="result-visual__top">
          <span>ANALYSIS COMPLETE</span>
          <span class="result-visual__status">
            READY
          </span>
        </div>

        <div class="result-visual__score">
          <small>MEASURED SCORE</small>
          <strong>—</strong>
          <span>/ 10</span>
        </div>

        <div class="result-visual__bottom">
          <span>FACE</span>
          <b class="result-visual__faces">—</b>

          <span>FEATURES</span>
          <b class="result-visual__features">—</b>
        </div>

        <div
          class="result-visual__region-layer"
          aria-hidden="true"
        ></div>

      </div>
    `;

    resultHero.parentNode.insertBefore(
      visual,
      resultHero
    );
  }

  const image =
    $(".result-visual__image", visual);

  const score =
    $(".result-visual__score strong", visual);

  const faces =
    $(".result-visual__faces", visual);

  const features =
    $(".result-visual__features", visual);

  const view =
    getActiveView(result);

  const source =
    getViewImageSource(view);

  if (image && source) {
    image.src = source;
    const alignment = result?.alignment?.[view?.type === "profile" ? "profile" : "front"];
    if (alignment?.available) {
      requestAnimationFrame(() => applyImageAlignment(image, alignment, visual));
    }
  }

  if (score) {
    score.textContent =
      formatScore(
        view?.score ??
        result.score
      );
  }

  if (faces) {
    faces.textContent =
      String(
        result.face_count
      );
  }

  if (features) {
    const visibleFeatureCount =
      result.feature_count ||
      result.detected_features ||
      countLeaves(result.metrics);

    features.textContent =
      visibleFeatureCount
        ? String(visibleFeatureCount)
        : "—";
  }

  visual.dataset.level =
    getMetricLevel(
      view?.score ??
      result.score
    );

  visual.dataset.view =
    activeResultView;

  visual.classList.remove(
    "is-complete"
  );

  resultHero.classList.remove(
    "score-landed"
  );

  renderRegionOverlay(visual, result);
  requestAnimationFrame(() => drawResultMetricOverlay(activeMetric));
}


function getActiveView(result) {
  if (!result) {
    return null;
  }

  if (
    activeResultView === "profile" &&
    result.views?.profile?.available
  ) {
    return result.views.profile;
  }

  return (
    result.views?.front ||
    {
      type: "front",
      available: true,
      score: result.score
    }
  );
}


function getViewImageSource(view) {
  if (!view) {
    return selectedObjectUrl;
  }

  if (view.image_url) {
    return view.image_url;
  }

  if (view.image) {
    return view.image;
  }

  if (view.image_base64) {
    if (
      String(
        view.image_base64
      ).startsWith("data:")
    ) {
      return view.image_base64;
    }

    return `data:image/jpeg;base64,${view.image_base64}`;
  }

  if (view.type === "profile" && selectedProfileObjectUrl) {
    return selectedProfileObjectUrl;
  }

  return selectedObjectUrl;
}


/* ============================================================
   VIEW SELECTOR
============================================================ */

function renderViewSelector(result) {
  const resultScreen =
    $("#screen-result");

  if (!resultScreen) {
    return;
  }

  let selector =
    $("#result-view-selector");

  if (!selector) {
    selector =
      document.createElement("div");

    selector.id =
      "result-view-selector";

    selector.className =
      "result-view-selector";

    const visual =
      $("#result-visual", resultScreen);

    if (visual) {
      visual.parentNode.insertBefore(
        selector,
        visual.nextSibling
      );
    } else {
      resultScreen.prepend(selector);
    }
  }

  selector.innerHTML = "";

  const frontButton =
    document.createElement("button");

  frontButton.type = "button";

  frontButton.dataset.view =
    "front";

  frontButton.textContent =
    "АНФАС";

  frontButton.classList.toggle(
    "active",
    activeResultView === "front"
  );

  frontButton.addEventListener(
    "click",
    () => switchResultView("front")
  );

  selector.appendChild(
    frontButton
  );

  if (result.has_profile) {
    const profileButton =
      document.createElement("button");

    profileButton.type = "button";

    profileButton.dataset.view =
      "profile";

    profileButton.textContent =
      "ПРОФИЛЬ";

    profileButton.classList.toggle(
      "active",
      activeResultView === "profile"
    );

    profileButton.addEventListener(
      "click",
      () =>
        switchResultView("profile")
    );

    selector.appendChild(
      profileButton
    );
  }
}


function switchResultView(view) {
  if (
    view === "profile" &&
    !currentAnalysis?.has_profile
  ) {
    return;
  }

  activeResultView = view;
  activeMetric = null;

  if (currentAnalysis) {
    ensureResultFace(
      currentAnalysis
    );

    renderViewSelector(
      currentAnalysis
    );

    const viewMetrics =
      view === "profile"
        ? (currentAnalysis.views?.profile?.metrics || {})
        : currentAnalysis.metrics;

    renderMetrics(viewMetrics);
    renderMetricInspector(currentAnalysis);
    requestAnimationFrame(() => drawResultMetricOverlay(activeMetric));
    drawMetricOverlay(activeMetric);
  }
}


/* ============================================================
   REGION OVERLAY
============================================================ */

function renderRegionOverlay(
  visual,
  result
) {
  const layer =
    $(".result-visual__region-layer", visual);

  if (!layer) {
    return;
  }

  layer.innerHTML = "";

  const view =
    getActiveView(result);

  const regions =
    view?.regions?.length
      ? view.regions
      : result.regions || [];

  regions.forEach(
    region => {
      if (
        !Number.isFinite(region.x) ||
        !Number.isFinite(region.y) ||
        !Number.isFinite(region.width) ||
        !Number.isFinite(region.height)
      ) {
        return;
      }

      const box =
        document.createElement("div");

      box.className =
        "result-region";

      box.style.left =
        `${normalizePercent(
          region.x
        )}%`;

      box.style.top =
        `${normalizePercent(
          region.y
        )}%`;

      box.style.width =
        `${normalizePercent(
          region.width
        )}%`;

      box.style.height =
        `${normalizePercent(
          region.height
        )}%`;

      box.dataset.level =
        getMetricLevel(
          region.score
        );

      layer.appendChild(box);
    }
  );
}


function normalizePercent(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  if (n <= 1) {
    return clamp(
      n * 100,
      0,
      100
    );
  }

  return clamp(
    n,
    0,
    100
  );
}


/* ============================================================
   RESULT SCORE ANIMATION
============================================================ */

function startResultScoreTransition() {
  const resultScreen =
    $("#screen-result");

  const visual =
    $("#result-visual", resultScreen);

  const hero =
    $(".result-hero", resultScreen);

  if (!visual || !hero) {
    return;
  }

  clearTimeout(
    resultAnimationTimer
  );

  visual.classList.remove(
    "is-complete"
  );

  hero.classList.remove(
    "score-landed"
  );

  resultAnimationTimer =
    setTimeout(() => {
      visual.classList.add(
        "is-complete"
      );

      hero.classList.add(
        "score-landed"
      );
    }, 1050);
}


/* ============================================================
   SCORE
============================================================ */

function renderScore(score) {
  if (!resultScore) {
    return;
  }

  const small =
    resultScore.parentElement
      ?.querySelector("small");

  if (small) {
    small.textContent =
      "/ 10";
  }

  if (
    !Number.isFinite(
      Number(score)
    )
  ) {
    resultScore.textContent =
      "—";

    resultScore.dataset.level =
      "";

    if (scoreProgress) {
      scoreProgress.style.width =
        "0%";
    }

    if (scoreStatus) {
      scoreStatus.textContent =
        "Оценка не получена";
    }

    return;
  }

  const value =
    clamp(
      Number(score),
      0,
      10
    );

  resultScore.textContent =
    formatScore(value);

  resultScore.dataset.level =
    getMetricLevel(value);

  if (scoreProgress) {
    scoreProgress.style.width =
      `${value * 10}%`;

    scoreProgress.dataset.level =
      getMetricLevel(value);
  }

  if (scoreStatus) {
    scoreStatus.textContent =
      getScoreStatus(value);
  }
}


function getScoreStatus(score) {
  if (score < 4) {
    return "Низкий измеренный результат";
  }

  if (score < 5.5) {
    return "Средний измеренный результат";
  }

  if (score < 7) {
    return "Сбалансированный результат";
  }

  if (score < 8.5) {
    return "Высокий измеренный результат";
  }

  if (score < 9.5) {
    return "Очень высокий измеренный результат";
  }

  return "Исключительно высокий измеренный результат";
}


/* ============================================================
   STATS
============================================================ */

function renderStats(result) {
  if (!statsGrid) {
    return;
  }

  const measurementCount =
    result.feature_count ||
    result.detected_features ||
    countLeaves(
      result.metrics
    );

  statsGrid.innerHTML = "";

  [
    [
      "ЛИЦО",
      String(result.face_count),
      "обнаружено"
    ],

    [
      "ТОЧКИ",
      result.landmarks_count === null
        ? "—"
        : formatValue(
            result.landmarks_count
          ),
      "лицевой геометрии"
    ],

    [
      "ИЗМЕРЕНИЯ",
      String(measurementCount),
      "показателей"
    ],

    [
      "ПРОФИЛЬ",
      result.has_profile && result.profile_score !== null
        ? formatScore(result.profile_score)
        : "—",
      result.has_profile
        ? "участвует в рейтинге"
        : "не добавлен"
    ]
  ].forEach(
    ([labelText, valueText, detailText]) => {
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
   FRONT + PROFILE SUMMARY
============================================================ */

function renderProfileSummary(result) {
  const resultScreen = $("#screen-result");
  if (!resultScreen) return;

  let box = $("#profile-summary", resultScreen);
  if (!box) {
    box = document.createElement("section");
    box.id = "profile-summary";
    box.className = "profile-summary";
    const stats = $("#stats-grid", resultScreen);
    (stats || resultScreen.firstElementChild)?.insertAdjacentElement("afterend", box);
  }

  const front = result.views?.front;
  const profile = result.views?.profile;
  const frontSrc = getViewImageSource(front);
  const profileSrc = getViewImageSource(profile);

  box.innerHTML = `
    <div class="profile-summary__header">
      <div>
        <span class="eyebrow">VIEWS</span>
        <h3>Анфас и профиль</h3>
      </div>
      <span class="profile-summary__badge ${result.has_profile ? "is-on" : ""}">
        ${result.has_profile ? "ПРОФИЛЬ УЧТЁН" : "ТОЛЬКО АНФАС"}
      </span>
    </div>
    <div class="profile-summary__grid">
      <article class="profile-summary__view">
        <div class="profile-summary__media">
          ${frontSrc ? `<img src="${escapeAttribute(frontSrc)}" alt="Анфас">` : ""}
        </div>
        <div class="profile-summary__meta">
          <span>АНФАС</span>
          <strong>${formatScore(result.front_score ?? result.score)} / 10</strong>
        </div>
      </article>
      <article class="profile-summary__view ${result.has_profile ? "" : "is-empty"}">
        <div class="profile-summary__media">
          ${profileSrc && result.has_profile ? `<img src="${escapeAttribute(profileSrc)}" alt="Профиль">` : `<span>${result.has_profile ? "ПРОФИЛЬ" : "+ ДОБАВЬ ПРОФИЛЬ"}</span>`}
        </div>
        <div class="profile-summary__meta">
          <span>ПРОФИЛЬ</span>
          <strong>${result.has_profile && result.profile_score !== null ? `${formatScore(result.profile_score)} / 10` : "не учитывается"}</strong>
        </div>
      </article>
    </div>
  `;
}

function escapeAttribute(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

  overviewGrid.innerHTML = "";

  const groups = [
    {
      title: "Гармония",

      values:
        getProductionValues(
          production,
          [
            "overall_harmony",
            "frontal_harmony",
            "profile_harmony",
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

  groups.forEach(
    group => {
      if (!group.values.length) {
        return;
      }

      const section =
        document.createElement(
          "section"
        );

      section.className =
        "overview-section";

      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        group.title;

      section.appendChild(
        title
      );

      group.values
        .slice(0, 6)
        .forEach(
          ([key, value]) => {
            const card =
              createMetricCard(
                key,
                value
              );

            section.appendChild(
              card
            );

            rendered++;
          }
        );

      overviewGrid.appendChild(
        section
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
  renderFeaturePanel(
    harmonyContent,

    "Гармония лица",

    "Ключевые показатели, которые реально вернул сервер.",

    [
      ...getProductionValues(
        production,
        [
          "overall_harmony",
          "frontal_harmony",
          "profile_harmony",
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
    ]
  );
}


/* ============================================================
   METRICS
============================================================ */

function extractMetricLeaves(object, prefix = "") {
  const result = [];
  if (!isObject(object)) return result;
  Object.entries(object).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(value) && Object.prototype.hasOwnProperty.call(value, "score") && Object.prototype.hasOwnProperty.call(value, "status")) {
      result.push([path, value]);
      return;
    }
    if (isObject(value)) result.push(...extractMetricLeaves(value, path));
  });
  return result;
}

function renderMetrics(metrics) {
  if (!metricsContent) return;
  metricsContent.innerHTML = "";
  const entries = extractMetricLeaves(metrics);
  if (!entries.length) {
    metricsContent.appendChild(createEmptyBlock("Подробные геометрические измерения не были получены."));
    return;
  }

  const groups = new Map();
  entries.forEach(([path, metric]) => {
    const group = path.split(".")[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push([path, metric]);
  });

  groups.forEach((items, group) => {
    const section = document.createElement("section");
    section.className = "metric-group";
    const heading = document.createElement("div");
    heading.className = "metric-group__heading";
    heading.innerHTML = `<strong>${getRussianLabel(group)}</strong><span>${items.length} измерений</span>`;
    section.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "metric-group__grid";
    items.forEach(([path, metric]) => grid.appendChild(createMetricCard(path, metric)));
    section.appendChild(grid);
    metricsContent.appendChild(section);
  });
}


/* ============================================================
   ANGULARITY
============================================================ */

function renderAngularity(
  metrics,
  production
) {
  renderFeaturePanel(
    angularityContent,

    "Угловатость и выраженность",

    "Каждый показатель связан с landmarks на лице. Нажми на карточку — увидишь точки и линию измерения.",

    [
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
    ]
  );
}


/* ============================================================
   SYMMETRY
============================================================ */

function renderSymmetry(
  metrics,
  production
) {
  renderFeaturePanel(
    symmetryContent,

    "Симметрия",

    "Баланс сторон лица по полученным измерениям.",

    [
      ...getGroup(
        metrics,
        ["symmetry"]
      ),

      ...getGroup(
        metrics,
        ["eyes"]
      ).filter(
        ([key]) =>
          key === "eye_alignment"
      ),

      ...getProductionValues(
        production,
        ["symmetry"]
      )
    ]
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

  dimorphismContent.innerHTML = "";

  const dim =
    currentAnalysis?.dimorphism;

  if (
    dim?.available &&
    dim.score !== null
  ) {
    const intro =
      createSectionIntro(
        "Диморфизм",

        "Визуальная выраженность черт по фактически полученному анализу."
      );

    dimorphismContent.appendChild(
      intro
    );

    const card =
      createMetricCard(
        "dimorphism",
        dim.score
      );

    dimorphismContent.appendChild(
      card
    );

    if (dim.label) {
      const label =
        document.createElement(
          "div"
        );

      label.className =
        "dimorphism-label";

      label.textContent =
        dim.label;

      dimorphismContent.appendChild(
        label
      );
    }

    if (dim.confidence !== null) {
      const confidence =
        createMetricCard(
          "confidence",
          dim.confidence
        );

      dimorphismContent.appendChild(
        confidence
      );
    }

    Object.entries(
      dim.features || {}
    ).forEach(
      ([key, value]) => {
        dimorphismContent.appendChild(
          createMetricCard(
            key,
            value
          )
        );
      }
    );

    return;
  }

  renderFeaturePanel(
    dimorphismContent,

    "Визуальная выраженность черт",

    "Показывается только при наличии соответствующего поля.",

    getProductionValues(
      production,
      ["dimorphism"]
    )
  );
}


/* ============================================================
   FEATURE PANEL
============================================================ */

function renderFeaturePanel(
  container,
  titleText,
  description,
  values
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const unique = [];
  const seen = new Set();

  values.forEach(
    ([key, value]) => {
      const signature =
        `${key}:${String(value)}`;

      if (seen.has(signature)) {
        return;
      }

      seen.add(signature);

      unique.push([
        key,
        value
      ]);
    }
  );

  if (!unique.length) {
    container.appendChild(
      createEmptyBlock(
        "Показатели этого раздела не были получены."
      )
    );

    return;
  }

  container.appendChild(
    createSectionIntro(
      titleText,
      description
    )
  );

  unique.forEach(
    ([key, value]) => {
      container.appendChild(
        createMetricCard(
          key,
          value
        )
      );
    }
  );
}


/* ============================================================
   METRIC CARD
============================================================ */

function createMetricCard(
  key,
  value
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "scale-card";

  card.dataset.metric = key;

  // Normalize the metric object before reading any of its fields.
  // This must be declared before the optional-chaining access below;
  // otherwise JavaScript hits the temporal-dead-zone and aborts the
  // whole result renderer with:
  // "Cannot access lexical declaration 'metricObject' before initialization".
  const metricObject = getMetricObject(value);

  if (metricObject?.status) card.dataset.status = metricObject.status;

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
    getRussianLabel(key);

  const score =
    document.createElement(
      "strong"
    );

  score.className =
    "scale-card__score";

  const numeric = getMetricScore(value);
  const isScore = numeric !== null;

  score.textContent =
    isScore
      ? `${formatMetricScore(numeric)}/10`
      : formatValue(value);

  top.append(
    name,
    score
  );

  card.appendChild(
    top
  );

  if (isScore) {
    const status =
      document.createElement(
        "span"
      );

    status.className =
      "metric-status";

    status.dataset.level =
      getMetricLevel(numeric);

    status.textContent = metricObject?.status
      ? getMetricStatusLabel(metricObject.status)
      : getMetricStatus(numeric);

    card.appendChild(
      status
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

    track.setAttribute(
      "aria-valuenow",
      String(numeric)
    );

    const fill =
      document.createElement(
        "div"
      );

    fill.className =
      "metric-scale__fill";

    fill.dataset.level =
      getMetricLevel(
        numeric
      );

    fill.style.width =
      `${numeric * 10}%`;

    track.appendChild(
      fill
    );

    const labels =
      document.createElement(
        "div"
      );

    labels.className =
      "metric-scale__labels";

    labels.innerHTML = `
      <span>слабее</span>
      <span>средне</span>
      <span>выражено</span>
    `;

    card.append(
      track,
      labels
    );
  } else {
    const raw =
      document.createElement(
        "div"
      );

    raw.className =
      "metric-raw";

    raw.textContent =
      "Фактическое значение";

    card.appendChild(
      raw
    );
  }

  card.addEventListener(
    "click",
    () => {
      selectMetric(
        key,
        value
      );
    }
  );

  return card;
}


/* ============================================================
   METRIC INSPECTOR
============================================================ */

function renderMetricInspector(
  result
) {
  const resultScreen =
    $("#screen-result");

  if (!resultScreen) {
    return;
  }

  let inspector =
    $("#metric-inspector");

  if (!inspector) {
    inspector =
      document.createElement(
        "section"
      );

    inspector.id =
      "metric-inspector";

    inspector.className =
      "metric-inspector";

    const tabs =
      $(".tab-panels", resultScreen);

    if (tabs) {
      tabs.parentNode.insertBefore(
        inspector,
        tabs
      );
    } else {
      resultScreen.appendChild(
        inspector
      );
    }
  }

  if (!activeMetric) {
    inspector.innerHTML = `
      <div class="metric-inspector__empty">
        <span class="metric-inspector__icon">⌖</span>

        <div>
          <strong>
            Выбери метрику
          </strong>

          <p>
            Нажми на любой показатель,
            чтобы увидеть, к какой области лица
            он относится и насколько выражен.
          </p>
        </div>
      </div>
    `;

    return;
  }

  const key =
    activeMetric.key;

  const value =
    activeMetric.value;

  const numeric =
    getMetricScore(value);

  const metricObject =
    getMetricObject(value);

  const zone =
    getMetricZone(key);

  inspector.innerHTML = "";

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "metric-inspector__header";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    getRussianLabel(key);

  const badge =
    document.createElement(
      "span"
    );

  if (numeric !== null) {
    badge.dataset.level =
      getMetricLevel(
        numeric
      );

    badge.textContent =
      `${formatMetricScore(
        numeric
      )}/10`;
  } else {
    badge.textContent =
      formatValue(value);
  }

  header.append(
    title,
    badge
  );



  const description =
    document.createElement(
      "div"
    );

  description.className =
    "metric-inspector__description";

  const zoneTitle =
    document.createElement(
      "strong"
    );

  zoneTitle.textContent =
    zone.label;

  const zoneText =
    document.createElement(
      "p"
    );

  zoneText.textContent =
    zone.description;

  description.append(
    zoneTitle,
    zoneText
  );

  if (numeric !== null) {
    const status =
      document.createElement(
        "div"
      );

    status.className =
      "metric-inspector__status";

    status.dataset.level =
      getMetricLevel(
        numeric
      );

    status.textContent =
      getMetricStatus(
        numeric
      );

    description.appendChild(
      status
    );
  }

  inspector.append(
    header,
    description
  );
}


function drawMetricOverlay(metric) {
  if (!currentAnalysis) return;
  const view = getActiveView(currentAnalysis) || {};
  drawFaceLandmarkNetwork(landmarkCanvas, view, metric, 1);
  drawResultMetricOverlay(metric);
}

function drawResultMetricOverlay(metric = null) {
  const canvas = document.getElementById("result-landmark-canvas");
  const visual = document.getElementById("result-visual");
  if (!canvas || !visual || !currentAnalysis) return;
  const view = getActiveView(currentAnalysis) || {};
  drawFaceLandmarkNetwork(canvas, view, metric, 1);
}

function selectMetric(
  key,
  value
) {
  activeMetric = {
    key,
    value
  };

  $$(".scale-card").forEach(
    card => {
      card.classList.toggle(
        "selected",
        card.dataset.metric === key
      );
    }
  );

  if (currentAnalysis) {
    renderMetricInspector(
      currentAnalysis
    );
    drawMetricOverlay(activeMetric);
  }

  const inspector = $("#metric-inspector");
  const visual = $("#result-visual");

  visual?.classList.add("metric-focus");
  window.setTimeout(
    () => visual?.classList.remove("metric-focus"),
    900
  );

  // The selected metric is shown directly on the real face image.
  visual?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  // Hide the textual inspector focus state; the photo overlay is the
  // source of truth for the selected measurement.
  inspector?.classList.remove("metric-inspector--focused");
}


function getMetricZone(key) {
  const raw =
    String(key || "");

  const parts =
    raw.split(".");

  for (
    let i = parts.length - 1;
    i >= 0;
    i--
  ) {
    const part =
      parts[i];

    if (
      METRIC_ZONES[part]
    ) {
      return {
        key: part,
        ...METRIC_ZONES[part]
      };
    }
  }

  return {
    key: "overall_harmony",
    ...METRIC_ZONES.overall_harmony
  };
}


function getMetricStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "good") return "Хорошее соответствие";
  if (s === "average") return "Пограничное соответствие";
  if (s === "poor") return "Выраженное отклонение";
  return "Недостаточно данных";
}

function getMetricStatus(value) {
  if (value < 4) {
    return "Низкая выраженность";
  }

  if (value < 5.5) {
    return "Ниже среднего";
  }

  if (value < 7) {
    return "Сбалансировано";
  }

  if (value < 8.5) {
    return "Хорошо выражено";
  }

  return "Очень хорошо выражено";
}


/* ============================================================
   CLASSIFICATION
============================================================ */

function renderClassification(
  result
) {
  const resultScreen =
    $("#screen-result");

  if (!resultScreen) {
    return;
  }

  let block =
    $("#result-classification");

  if (!block) {
    block =
      document.createElement(
        "section"
      );

    block.id =
      "result-classification";

    block.className =
      "result-classification";

    const visual =
      $("#result-visual", resultScreen);

    if (visual) {
      visual.parentNode.insertBefore(
        block,
        visual.nextSibling
      );
    } else {
      resultScreen.prepend(
        block
      );
    }
  }

  const classification =
    result.classification;

  if (!classification) {
    block.innerHTML = `
      <div class="result-classification__empty">
        Классификация не была возвращена сервером.
      </div>
    `;

    return;
  }

  block.innerHTML = `
    <span class="eyebrow">
      VISUAL CLASSIFICATION
    </span>

    <strong>
      ${escapeHtml(
        classification.label ||
        "—"
      )}
    </strong>

    ${
      classification.band
        ? `
          <small>
            ${escapeHtml(
              classification.band
            )}
          </small>
        `
        : ""
    }
  `;
}


/* ============================================================
   HEALTH
============================================================ */

function renderHealth() {
  if (!healthContent) {
    return;
  }

  healthContent.innerHTML = "";

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
    "Этот раздел не является медицинской диагностикой. " +
    "Система отображает только визуальные характеристики, " +
    "которые реально удалось получить из изображения.";

  healthContent.append(
    icon,
    text
  );
}


/* ============================================================
   FACE NOT FOUND
============================================================ */

function showFaceNotFound() {
  const analysisScreen =
    $("#screen-analysis");

  if (!analysisScreen) {
    return;
  }

  let card =
    $("#analysis-error-card",
      analysisScreen);

  if (!card) {
    card =
      document.createElement(
        "div"
      );

    card.id =
      "analysis-error-card";

    card.className =
      "analysis-error-card";

    card.innerHTML = `
      <div class="analysis-error-card__icon">
        —
      </div>

      <div>
        <span class="eyebrow">
          ANALYSIS STOPPED
        </span>

        <h3>
          Лицо не найдено
        </h3>

        <p>
          На фотографии не удалось получить
          достаточно данных для корректного
          измерительного анализа.
        </p>
      </div>

      <button
        type="button"
        class="secondary-btn"
        data-retry-analysis
      >
        Выбрать другую фотографию
        <span>↗</span>
      </button>
    `;

    analysisScreen.appendChild(
      card
    );

    card
      .querySelector(
        "[data-retry-analysis]"
      )
      ?.addEventListener(
        "click",
        openFilePicker
      );
  }

  card.classList.add(
    "show"
  );

  loadingContent?.classList.add(
    "is-hidden"
  );
}


function clearAnalysisError() {
  $("#analysis-error-card")
    ?.remove();
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

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}


function saveHistory(result) {
  if (
    !Number.isFinite(
      Number(result.score)
    )
  ) {
    return;
  }

  try {
    const history =
      getHistory();

    history.unshift({
      id:
        `${Date.now()}_` +
        `${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      created_at:
        result.generated_at ||
        new Date().toISOString(),

      score:
        result.score,

      front_score:
        result.front_score,

      profile_score:
        result.profile_score,

      has_profile:
        result.has_profile,

      dimorphism:
        result.dimorphism?.score ??
        null,

      classification:
        result.classification?.label ??
        null,

      face_count:
        result.face_count,

      landmarks_count:
        result.landmarks_count,

      feature_count:
        result.feature_count,

      detected_features:
        result.detected_features
    });

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
      "History:",
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

  historyList.innerHTML = "";

  if (!history.length) {
    historyList.appendChild(
      createEmptyBlock(
        "Пока нет сохранённых анализов."
      )
    );

    return;
  }

  history.forEach(
    entry => {
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
        `${entry.feature_count ||
          entry.detected_features ||
          0} измерений`;

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

      if (
        Number.isFinite(
          Number(entry.score)
        )
      ) {
        score.dataset.level =
          getMetricLevel(
            Number(entry.score)
          );

        score.textContent =
          formatScore(
            entry.score
          );
      } else {
        score.textContent =
          "—";
      }

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
  count = null
) {
  const value =
    count === null
      ? getHistory().length
      : count;

  if (historyCount) {
    historyCount.textContent =
      String(value);
  }
}


/* ============================================================
   TABS
============================================================ */

function bindResultTabs() {
  if (!reportTabs) {
    return;
  }

  const tabs =
    $$(".tab", reportTabs);

  const panels =
    $$(".tab-panel");

  tabs.forEach(
    (tab, index) => {
      tab.addEventListener(
        "click",
        () =>
          activateResultTab(
            tab
          )
      );

      tab.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
            "ArrowRight"
          ) {
            event.preventDefault();

            activateResultTab(
              tabs[
                (index + 1) %
                tabs.length
              ],
              true
            );
          }

          if (
            event.key ===
            "ArrowLeft"
          ) {
            event.preventDefault();

            activateResultTab(
              tabs[
                (
                  index -
                  1 +
                  tabs.length
                ) %
                tabs.length
              ],
              true
            );
          }
        }
      );
    }
  );

  function activateResultTab(
    tab,
    focus = false
  ) {
    const target =
      tab.dataset.tab;

    if (!target) {
      return;
    }

    tabs.forEach(
      item => {
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
      panel => {
        const active =
          panel.dataset.panel ===
          target;

        panel.classList.toggle(
          "active",
          active
        );

        panel.hidden =
          !active;
      }
    );

    if (focus) {
      tab.focus();
    }
  }
}


function activateDefaultResultTab() {
  if (!reportTabs) {
    return;
  }

  const first =
    $('.tab[data-tab="overview"]',
      reportTabs);

  if (!first) {
    return;
  }

  const tabs =
    $$(".tab", reportTabs);

  const panels =
    $$(".tab-panel");

  tabs.forEach(
    tab => {
      const active =
        tab === first;

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
    panel => {
      const active =
        panel.dataset.panel ===
        "overview";

      panel.classList.toggle(
        "active",
        active
      );

      panel.hidden =
        !active;
    }
  );
}


/* ============================================================
   NEW ANALYSIS
============================================================ */

function startNewAnalysis() {
  analysisRequestId++;

  cancelActiveAnalysis();

  selectedFile = null;
  selectedProfileFile = null;
  currentAnalysis = null;

  activeResultView = "front";
  activeMetric = null;

  revokeSelectedObjectUrl();
  revokeSelectedProfileObjectUrl();

  if (fileInput) {
    fileInput.value = "";
  }

  if (uploadName) {
    uploadName.textContent =
      "JPG, PNG или WEBP · до 15 MB";
  }

  if (profileFileInput) {
    profileFileInput.value = "";
  }

  if (profileUploadName) {
    profileUploadName.textContent = "Необязательно · фото сбоку";
  }

  const profileCard = document.getElementById("profile-upload-card");
  profileCard?.classList.remove("is-ready");

  startAnalysisButton?.setAttribute("disabled", "disabled");

  if (analysisImage) {
    analysisImage.removeAttribute(
      "src"
    );
  }

  $("#result-visual")
    ?.remove();

  $("#result-view-selector")
    ?.remove();

  $("#result-classification")
    ?.remove();

  $("#metric-inspector")
    ?.remove();

  resetAnalysisPreview();

  showScreen("home");
}


/* ============================================================
   TOAST
============================================================ */

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
      () =>
        toast.classList.remove(
          "show"
        ),
      4200
    );
}


/* ============================================================
   ERRORS
============================================================ */

function getFriendlyErrorMessage(
  error
) {
  const message =
    String(
      error?.message || ""
    );

  if (!message) {
    return "Анализ не выполнен. Попробуй ещё раз.";
  }

  if (
    message.includes(
      "Failed to fetch"
    ) ||
    message.includes(
      "NetworkError"
    )
  ) {
    return "Не удалось подключиться к серверу анализа.";
  }

  if (
    message.includes("413")
  ) {
    return "Фотография слишком большая.";
  }

  if (
    error?.code === "GEMINI_QUOTA_EXCEEDED" ||
    message.includes("429") ||
    message.toLowerCase().includes("лимит gemini")
  ) {
    return "Лимит Gemini API исчерпан. Введи другой ключ.";
  }

  if (
    error?.code === "GEMINI_INVALID_KEY" ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "Gemini API ключ недействителен. Введи другой ключ.";
  }

  if (
    message
      .toLowerCase()
      .includes("timeout")
  ) {
    return "Сервер анализа отвечает слишком долго.";
  }

  return message;
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

  if (status === 404) {
    return "Endpoint анализа не найден. Используется /api/analyze.";
  }

  if (status === 413) {
    return "Фотография слишком большая.";
  }

  if (status === 429) {
    return "Лимит Gemini API исчерпан. Введи другой ключ.";
  }

  if (status >= 500) {
    return "Ошибка сервера анализа.";
  }

  return `Ошибка сервера (${status}).`;
}


function isAbortError(error) {
  return (
    error?.name ===
      "AbortError" ||
    String(
      error?.message || ""
    )
      .toLowerCase()
      .includes(
        "aborted"
      )
  );
}


/* ============================================================
   FORMAT
============================================================ */

function formatBytes(bytes) {
  if (
    !Number.isFinite(bytes)
  ) {
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

  return String(
    Math.round(
      clamp(
        number,
        0,
        10
      ) * 10
    ) / 10
  ).replace(
    ".",
    ","
  );
}


function formatMetricScore(
  value
) {
  return String(
    Math.round(
      value * 10
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
    typeof value === "number"
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
    typeof value === "boolean"
  ) {
    return value
      ? "Да"
      : "Нет";
  }

  if (typeof value === "object") {
    const metric = getMetricObject(value);

    if (metric) {
      const score = getMetricScore(value);
      return score !== null
        ? `${formatMetricScore(score)}/10`
        : "—";
    }

    return "—";
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
   LABELS
============================================================ */

function getRussianLabel(key) {
  const raw =
    String(
      key || ""
    );

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


function prettifyKey(key) {
  return String(
    key || ""
  )
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
      char =>
        char.toUpperCase()
    );
}


/* ============================================================
   OBJECT HELPERS
============================================================ */

function isObject(value) {
  return (
    value !== null &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
}

function getMetricObject(value) {
  return isObject(value) &&
    Object.prototype.hasOwnProperty.call(value, "score")
    ? value
    : null;
}

function getMetricScore(value) {
  const metric = getMetricObject(value);
  return metric
    ? normalizeMetricValue(metric.score)
    : normalizeMetricValue(value);
}

function getMetricStatus(value) {
  const metric = getMetricObject(value);
  return metric?.status
    ? String(metric.status).toLowerCase()
    : "";
}


function flattenObject(
  object,
  prefix = ""
) {
  const result = [];

  if (
    !isObject(object)
  ) {
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

  return Math.round(
    clamp(
      number,
      0,
      10
    ) * 100
  ) / 100;
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

  return (
    number >= 0 &&
    number <= 10
  )
    ? number
    : null;
}


function getMetricLevel(
  value
) {
  if (
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "unknown";
  }

  if (value < 4) {
    return "low";
  }

  if (value < 7) {
    return "medium";
  }

  return "high";
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


function getGroup(
  object,
  names
) {
  if (
    !isObject(object)
  ) {
    return [];
  }

  const result = [];

  names.forEach(
    name => {
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
    !isObject(
      production
    )
  ) {
    return [];
  }

  const result = [];

  names.forEach(
    name => {
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


function createSectionIntro(
  titleText,
  descriptionText
) {
  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "section-intro";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    titleText;

  const description =
    document.createElement(
      "span"
    );

  description.textContent =
    descriptionText;

  heading.append(
    title,
    description
  );

  return heading;
}


/* ============================================================
   URL
============================================================ */

function revokeSelectedObjectUrl() {
  if (!selectedObjectUrl) {
    return;
  }

  try {
    URL.revokeObjectURL(
      selectedObjectUrl
    );
  } catch {}

  selectedObjectUrl = null;
}


/* ============================================================
   HEALTH
============================================================ */

function checkWorkerHealth() {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      HEALTH_TIMEOUT
    );

  return fetch(
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
  )
    .then(
      response => {
        if (!response.ok) {
          return false;
        }

        return response
          .json()
          .then(
            data =>
              data?.success ===
              true
          )
          .catch(
            () => false
          );
      }
    )
    .catch(
      () => false
    )
    .finally(
      () =>
        clearTimeout(
          timer
        )
    );
}


/* ============================================================
   MISC
============================================================ */

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* ============================================================
   STAGE 2 TEMPORARY STYLES
   Пока не трогаем style.css.
============================================================ */

function injectStageTwoStyles() {

  if (
    document.getElementById(
      "facemetric-stage2-styles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "facemetric-stage2-styles";

  style.textContent = `
    .result-view-selector {
      display: flex;
      gap: 8px;
      margin: 12px 0 18px;
      padding: 4px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px;
      background: rgba(255,255,255,.025);
    }

    .result-view-selector button {
      flex: 1;
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      background: transparent;
      color: rgba(255,255,255,.52);
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      letter-spacing: .04em;
    }

    .result-view-selector button.active {
      background: rgba(255,255,255,.1);
      color: #fff;
    }

    .metric-status {
      display: inline-flex;
      width: fit-content;
      margin-top: 5px;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      line-height: 1;
      letter-spacing: .04em;
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.65);
    }

    .metric-status[data-level="high"] {
      color: #8cffb1;
      background: rgba(65,220,110,.1);
    }

    .metric-status[data-level="medium"] {
      color: #ffd66b;
      background: rgba(255,190,40,.1);
    }

    .metric-status[data-level="low"] {
      color: #ff8585;
      background: rgba(255,70,70,.1);
    }

    .scale-card {
      cursor: pointer;
      transition:
        border-color .2s ease,
        transform .2s ease,
        background .2s ease;
    }

    .scale-card:hover {
      transform: translateY(-1px);
    }

    .scale-card.selected {
      border-color: rgba(255,255,255,.25);
      background: rgba(255,255,255,.055);
    }

    .metric-inspector {
      margin: 18px 0;
      padding: 16px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 18px;
      background:
        linear-gradient(
          145deg,
          rgba(255,255,255,.045),
          rgba(255,255,255,.015)
        );
    }

    .metric-inspector__empty {
      display: flex;
      align-items: center;
      gap: 12px;
      color: rgba(255,255,255,.68);
    }

    .metric-inspector__empty strong {
      display: block;
      color: #fff;
      margin-bottom: 4px;
    }

    .metric-inspector__empty p {
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
    }

    .metric-inspector__icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: rgba(255,255,255,.07);
      color: #fff;
      font-weight: 800;
    }

    .metric-inspector__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .metric-inspector__header strong {
      color: #fff;
      font-size: 15px;
    }

    .metric-inspector__header span {
      padding: 6px 9px;
      border-radius: 999px;
      background: rgba(255,255,255,.07);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
    }

    .metric-inspector__header span[data-level="high"] {
      color: #8cffb1;
    }

    .metric-inspector__header span[data-level="medium"] {
      color: #ffd66b;
    }

    .metric-inspector__header span[data-level="low"] {
      color: #ff8585;
    }

    .metric-inspector__visual {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 230px;
      overflow: hidden;
      border-radius: 16px;
      background:
        radial-gradient(
          circle at 50% 40%,
          rgba(255,255,255,.08),
          rgba(255,255,255,.015) 60%
        );
    }

    .metric-inspector__face {
      position: relative;
      width: 125px;
      height: 165px;
      border: 2px solid rgba(255,255,255,.28);
      border-radius: 48% 48% 45% 45% / 42% 42% 58% 58%;
      background:
        linear-gradient(
          145deg,
          rgba(255,255,255,.08),
          rgba(255,255,255,.025)
        );
    }

    .metric-inspector__face::before,
    .metric-inspector__face::after {
      content: "";
      position: absolute;
      top: 55px;
      width: 22px;
      height: 9px;
      border-top: 2px solid rgba(255,255,255,.3);
      border-radius: 50%;
    }

    .metric-inspector__face::before {
      left: 25px;
    }

    .metric-inspector__face::after {
      right: 25px;
    }

    .metric-inspector__zone {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 42px;
      height: 42px;
      transform: translate(-50%,-50%);
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,.9);
      background: rgba(255,255,255,.08);
      box-shadow:
        0 0 0 6px rgba(255,255,255,.04),
        0 0 28px rgba(255,255,255,.12);
    }

    .metric-inspector__zone[data-zone="eyes"] {
      top: 39%;
      width: 76px;
      height: 28px;
      border-radius: 20px;
    }

    .metric-inspector__zone[data-zone="eyebrows"] {
      top: 29%;
      width: 82px;
      height: 22px;
      border-radius: 20px;
    }

    .metric-inspector__zone[data-zone="nose"] {
      top: 52%;
      width: 32px;
      height: 58px;
      border-radius: 18px;
    }

    .metric-inspector__zone[data-zone="jaw"] {
      top: 78%;
      width: 96px;
      height: 45px;
      border-radius: 0 0 50px 50px;
    }

    .metric-inspector__zone[data-zone="chin"] {
      top: 86%;
      width: 48px;
      height: 28px;
      border-radius: 50%;
    }

    .metric-inspector__zone[data-zone="cheeks"] {
      top: 57%;
      width: 94px;
      height: 52px;
      border-radius: 50%;
    }

    .metric-inspector__zone[data-zone="lips_mouth"] {
      top: 69%;
      width: 58px;
      height: 24px;
      border-radius: 50%;
    }

    .metric-inspector__zone[data-zone="midface"] {
      top: 53%;
      width: 100px;
      height: 74px;
      border-radius: 40%;
    }

    .metric-inspector__zone[data-zone="symmetry"] {
      top: 52%;
      width: 2px;
      height: 145px;
      border-radius: 0;
    }

    .metric-inspector__description {
      margin-top: 13px;
    }

    .metric-inspector__description strong {
      display: block;
      color: #fff;
      margin-bottom: 4px;
    }

    .metric-inspector__description p {
      margin: 0;
      color: rgba(255,255,255,.62);
      font-size: 12px;
      line-height: 1.5;
    }

    .metric-inspector__status {
      display: inline-flex;
      margin-top: 10px;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      font-size: 11px;
      font-weight: 700;
    }

    .metric-inspector__status[data-level="high"] {
      color: #8cffb1;
      background: rgba(65,220,110,.1);
    }

    .metric-inspector__status[data-level="medium"] {
      color: #ffd66b;
      background: rgba(255,190,40,.1);
    }

    .metric-inspector__status[data-level="low"] {
      color: #ff8585;
      background: rgba(255,70,70,.1);
    }

    .result-classification {
      margin: 12px 0 18px;
      padding: 16px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px;
      background: rgba(255,255,255,.025);
    }

    .result-classification strong {
      display: block;
      margin-top: 5px;
      font-size: 22px;
      color: #fff;
    }

    .result-classification small {
      display: block;
      margin-top: 4px;
      color: rgba(255,255,255,.5);
    }

    .result-classification__empty {
      color: rgba(255,255,255,.45);
      font-size: 12px;
    }

    .result-region {
      position: absolute;
      border: 2px solid rgba(255,255,255,.75);
      border-radius: 12px;
      background: rgba(255,255,255,.06);
      box-shadow:
        0 0 20px rgba(255,255,255,.12);
      pointer-events: none;
    }

    .result-region[data-level="high"] {
      border-color: rgba(90,255,140,.85);
      background: rgba(90,255,140,.08);
    }

    .result-region[data-level="medium"] {
      border-color: rgba(255,210,80,.85);
      background: rgba(255,210,80,.08);
    }

    .result-region[data-level="low"] {
      border-color: rgba(255,80,80,.85);
      background: rgba(255,80,80,.08);
    }


    /* Final UX: the real result photo is the metric inspector. */
    .metric-inspector__visual,
    .face-map,
    #face-map,
    [data-face-map],
    .face-map-card,
    [data-component="face-map"] {
      display: none !important;
    }

    .metric-inspector {
      transition: opacity .25s ease, transform .35s ease;
    }

    #result-visual {
      transition:
        transform 650ms cubic-bezier(.2,.8,.2,1),
        box-shadow 650ms ease,
        border-color 650ms ease;
      transform-origin: 50% 45%;
    }

    #result-visual.metric-focus {
      transform: scale(1.035);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.12),
        0 24px 80px rgba(0,0,0,.38);
    }

    #result-landmark-canvas {
      pointer-events: none;
    }

    .metric-inspector__description {
      margin-top: 4px;
    }
  `;

  document.head.appendChild(
    style
  );
}


/* ============================================================
   EVENTS
============================================================ */

function initClassificationSettings() {
  const saved = getClassificationSettings();

  // Keep the last gender as a default, but ask again for every photo.
  selectedGender =
    saved?.gender === "female"
      ? "female"
      : "male";

  adultConfirmed = false;

  if (genderSelect) {
    genderSelect.value = selectedGender;
    genderSelect.addEventListener("change", () => {
      selectedGender =
        genderSelect.value === "female"
          ? "female"
          : "male";
    });
  }

  if (adultConfirm) {
    adultConfirm.checked = false;
    adultConfirm.addEventListener("change", () => {
      adultConfirmed = Boolean(adultConfirm.checked);
      updateAnalysisButtonState();
    });
  }

  updateAnalysisButtonState();
}

function updateAnalysisButtonState() {
  if (!startAnalysisButton) return;

  const ready =
    Boolean(selectedFile) &&
    adultConfirmed;

  startAnalysisButton.disabled = !ready;
  startAnalysisButton.title = !adultConfirmed
    ? "Сначала ответьте на вопрос о возрасте человека на фото."
    : "";
}

function bindEvents() {
  uploadButton?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      openFilePicker();
    }
  );

  fileInput?.addEventListener(
    "change",
    event => {
      handleFileSelected(
        event.target.files?.[0]
      );
    }
  );

  startAnalysisButton?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      if (!selectedFile) {
        showToast("Сначала добавь фотографию анфас.");
        return;
      }
      startAnalysisButton.disabled = true;
      startAnalysis(selectedFile, selectedProfileFile);
    }
  );

  profileUploadButton?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      if (!selectedFile) {
        showToast("Сначала добавь фотографию анфас.");
        return;
      }
      profileFileInput?.click();
    }
  );

  profileFileInput?.addEventListener(
    "change",
    event => {
      handleProfileFileSelected(
        event.target.files?.[0]
      );
    }
  );

  uploadZone?.addEventListener(
    "dragover",
    event => {
      event.preventDefault();

      uploadZone.classList.add(
        "dragover"
      );
    }
  );

  uploadZone?.addEventListener(
    "dragleave",
    () => {
      uploadZone.classList.remove(
        "dragover"
      );
    }
  );

  uploadZone?.addEventListener(
    "drop",
    event => {
      event.preventDefault();

      uploadZone.classList.remove(
        "dragover"
      );

      handleFileSelected(
        event.dataTransfer
          ?.files?.[0]
      );
    }
  );

  $$("[data-screen]")
    .forEach(
      element => {
        element.addEventListener(
          "click",
          () => {
            const target =
              element.dataset.screen;

            if (
              target &&
              element !==
                uploadButton
            ) {
              showScreen(
                target
              );
            }
          }
        );
      }
    );

  $$(".back-btn")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            showScreen(
              button.dataset.screen ||
              "home"
            );
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
    resizeLandmarkCanvas
  );

  window.addEventListener(
    "beforeunload",
    () => {
      cancelActiveAnalysis();
      revokeSelectedObjectUrl();
      revokeSelectedProfileObjectUrl();
    }
  );
}


/* ============================================================
   INIT
============================================================ */

function init() {
  try { initGeminiKeyModal(); } catch (e) { console.warn("Gemini modal init failed", e); }
  try { initClassificationModal(); } catch (e) { console.warn("Classification modal init failed", e); }

  initTelegram();
  initClassificationSettings();

  bindEvents();

  updateHistoryCount();

  activateDefaultResultTab();

  injectStageTwoStyles();

  showScreen("home");

  setTimeout(
    () => {
      checkWorkerHealth()
        .then(
          healthy => {
            document.body.dataset.system =
              healthy
                ? "ready"
                : "offline";
          }
        );
    },
    300
  );
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
