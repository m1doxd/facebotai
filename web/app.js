"use strict";

/*
 * ============================================================
 * FaceMetric / FaceBot
 * ============================================================
 *
 * Новый renderer:
 *
 * - весь UI на русском;
 * - оценка 0–10;
 * - лицо сохраняется на экране результата;
 * - модель не показывается пользователю;
 * - вместо вложенных технических вкладок используются
 *   понятные карточки и шкалы;
 * - показатели 0–10 отображаются как красный → зелёный;
 * - API Gemini остаётся прежним.
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

const HISTORY_KEY =
  "facemetric_history_v1";

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

const uploadName =
  document.getElementById("upload-name");

const analysisImage =
  document.getElementById("analysis-image");

const analysisFrame =
  document.getElementById("analysis-frame");

const landmarkCanvas =
  document.getElementById("landmark-canvas");

const analysisState =
  document.getElementById("analysis-state");

const analysisScore =
  document.getElementById("analysis-score");

const analysisScoreValue =
  analysisScore
    ? analysisScore.querySelector("strong")
    : null;

const loadingTitle =
  document.getElementById("loading-title");

const loadingText =
  document.getElementById("loading-text");

const loadingSteps =
  document.querySelectorAll(
    ".loading-step"
  );

const resultScore =
  document.getElementById("result-score");

const scoreProgress =
  document.getElementById("score-progress");

const scoreStatus =
  document.getElementById("score-status");

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


// ============================================================
// RUSSIAN LABELS
// ============================================================

const LABELS = {

  face_geometry:
    "Геометрия лица",

  symmetry:
    "Симметрия",

  eyes:
    "Глаза",

  eyebrows:
    "Брови",

  nose:
    "Нос",

  jaw:
    "Челюсть",

  chin:
    "Подбородок",

  cheeks:
    "Скулы",

  lips_mouth:
    "Губы и рот",

  midface:
    "Средняя часть лица",

  overall_harmony:
    "Общая гармония",

  frontal_harmony:
    "Фронтальная гармония",

  facial_definition:
    "Выраженность лица",

  angularity:
    "Угловатость",

  proportions:
    "Пропорции",

  left_right_balance:
    "Баланс левой и правой стороны",

  overall_symmetry:
    "Общая симметрия",

  eye_spacing:
    "Расстояние между глазами",

  eye_aspect_ratio:
    "Форма глаз",

  eye_alignment:
    "Выравнивание глаз",

  eye_area_balance:
    "Баланс площади глаз",

  brow_position:
    "Положение бровей",

  brow_shape:
    "Форма бровей",

  brow_symmetry:
    "Симметрия бровей",

  nose_width:
    "Ширина носа",

  nose_length:
    "Длина носа",

  nose_proportion:
    "Пропорции носа",

  jaw_width:
    "Ширина челюсти",

  jaw_definition:
    "Выраженность челюсти",

  jaw_shape:
    "Форма челюсти",

  chin_prominence:
    "Выраженность подбородка",

  chin_proportion:
    "Пропорции подбородка",

  cheek_prominence:
    "Выраженность скул",

  cheek_definition:
    "Выраженность скул",

  mouth_width:
    "Ширина рта",

  lip_proportion:
    "Пропорции губ",

  mouth_symmetry:
    "Симметрия рта",

  midface_balance:
    "Баланс средней части лица"
};


// ============================================================
// TELEGRAM
// ============================================================

function initTelegram() {

  if (!tg) {
    return;
  }

  try {

    tg.ready();

    if (
      typeof tg.expand === "function"
    ) {
      tg.expand();
    }

    if (
      typeof tg.setHeaderColor ===
      "function"
    ) {
      tg.setHeaderColor("#08090b");
    }

    if (
      typeof tg.setBackgroundColor ===
      "function"
    ) {
      tg.setBackgroundColor("#08090b");
    }

  } catch (error) {

    console.warn(
      "Telegram WebApp initialization:",
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

  screens.forEach(
    (screen) => {

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

    }
  );

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

  document
    .querySelectorAll(".nav-item")
    .forEach(
      (item) => {

        const target =
          item.dataset.screen;

        const active =
          target === name ||
          (
            name === "result" &&
            target === "home"
          ) ||
          (
            name === "analysis" &&
            target === "home"
          );

        item.classList.toggle(
          "active",
          active
        );

      }
    );
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
      "File picker error:",
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

  if (selectedObjectUrl) {

    URL.revokeObjectURL(
      selectedObjectUrl
    );

    selectedObjectUrl = null;
  }

  selectedObjectUrl =
    URL.createObjectURL(file);

  if (uploadName) {

    uploadName.textContent =
      `${file.name} · ${formatBytes(file.size)}`;
  }

  /*
   * ВАЖНО:
   * Одно и то же изображение используется
   * и на экране анализа, и на экране результата.
   */

  if (analysisImage) {

    analysisImage.src =
      selectedObjectUrl;

    analysisImage.alt =
      "Фотография для анализа";

    analysisImage.style.display =
      "";

    analysisImage.style.visibility =
      "visible";

    analysisImage.style.opacity =
      "1";
  }

  setAnalysisState(
    "АНАЛИЗ"
  );

  resetAnalysisPreview();

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

  if (
    !ALLOWED_TYPES.has(
      file.type
    )
  ) {

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

  if (
    file.size >
    MAX_FILE_SIZE
  ) {

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

  clearLandmarks();
}


function setAnalysisState(text) {

  if (!analysisState) {
    return;
  }

  analysisState.textContent =
    text;
}


function showAnalysisPreviewScore(score) {

  if (
    score === null ||
    score === undefined ||
    !Number.isFinite(
      Number(score)
    )
  ) {
    return;
  }

  /*
   * БЫЛО:
   * score * 10
   *
   * СТАЛО:
   * 8.8 -> 8,8 / 10
   */

  const displayScore =
    formatScore10(score);

  if (analysisScoreValue) {

    analysisScoreValue.textContent =
      displayScore;
  }

  if (analysisScore) {

    analysisScore.classList.add(
      "show"
    );

    /*
     * Оценка сначала находится поверх лица.
     * Потом немного уходит в сторону,
     * но фотография НЕ исчезает.
     */

    setTimeout(
      () => {

        if (
          currentScreen === "analysis"
        ) {

          analysisScore.classList.add(
            "float"
          );
        }

      },
      1200
    );
  }
}


function clearLandmarks() {

  if (!landmarkCanvas) {
    return;
  }

  const context =
    landmarkCanvas.getContext(
      "2d"
    );

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

    completeLoadingSteps();

    setAnalysisState(
      "ГОТОВО"
    );

    showAnalysisPreviewScore(
      currentAnalysis.score
    );

    saveHistory(
      currentAnalysis
    );

    /*
     * Небольшая пауза нужна только для
     * визуального перехода.
     */

    await sleep(700);

    if (
      requestId !==
      analysisRequestId
    ) {
      return;
    }

    renderResult(
      currentAnalysis
    );

    /*
     * Гарантируем, что фотография
     * остаётся доступной на result screen.
     */

    ensureResultFace();

    showScreen(
      "result"
    );

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

    showScreen(
      "home"
    );

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

  if (!file) {

    throw new Error(
      "Фотография не выбрана."
    );
  }

  const validation =
    validateFile(file);

  if (!validation.valid) {

    throw new Error(
      validation.message
    );
  }

  const formData =
    new FormData();

  /*
   * Worker ожидает именно:
   *
   * file
   */

  formData.append(
    "file",
    file,
    file.name ||
      "photo.jpg"
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

  if (
    responseText &&
    responseText.trim()
  ) {

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

    const detail =
      data?.detail ||
      data?.error ||
      getHttpErrorMessage(
        response.status
      );

    throw new Error(
      detail
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
// RESULT NORMALIZATION
// ============================================================

function normalizeClientResult(data) {

  /*
   * Совместимо с ответом:
   *
   * {
   *   success: true,
   *   model: "...",
   *   score: 8.8,
   *   metrics: {...},
   *   production_features: {...}
   * }
   */

  return {

    success: true,

    score:
      normalizeScore(
        data.score
      ),

    face_count:
      toNumberOrZero(
        data.face_count
      ),

    landmarks_count:
      nullableNumber(
        data.landmarks_count
      ),

    detected_features:
      toNumberOrZero(
        data.detected_features
      ),

    feature_count:
      toNumberOrZero(
        data.feature_count
      ),

    /*
     * Модель сохраняем для внутренней
     * совместимости, но НЕ показываем.
     */

    model:
      cleanText(
        data.model
      ) ||
      "Gemini",

    metrics:
      isObject(
        data.metrics
      )
        ? data.metrics
        : {},

    production_features:
      isObject(
        data.production_features
      )
        ? data.production_features
        : {},

    generated_at:
      data.generated_at ||
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

  renderOverview(
    result.metrics
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

  renderHealth(
    result
  );

  ensureResultFace();
}


// ============================================================
// RESULT PHOTO
// ============================================================

function ensureResultFace() {

  if (!selectedObjectUrl) {
    return;
  }

  /*
   * Ищем возможные элементы фотографии
   * на result screen.
   */

  const candidates = [
    document.getElementById(
      "result-image"
    ),

    document.querySelector(
      "#screen-result img"
    ),

    document.querySelector(
      ".result-image"
    ),

    document.querySelector(
      ".result-photo"
    ),

    document.querySelector(
      ".result-face"
    )
  ].filter(Boolean);

  if (!candidates.length) {

    /*
     * Если отдельного result-image нет,
     * создаём его внутри result screen.
     */

    const resultScreen =
      document.getElementById(
        "screen-result"
      );

    if (!resultScreen) {
      return;
    }

    let wrapper =
      resultScreen.querySelector(
        ".result-face-container"
      );

    if (!wrapper) {

      wrapper =
        document.createElement(
          "div"
        );

      wrapper.className =
        "result-face-container";

      /*
       * Помещаем фото в начало
       * результата, чтобы оно не терялось.
       */

      resultScreen.prepend(
        wrapper
      );
    }

    let image =
      wrapper.querySelector(
       ("img")
      );

    if (!image) {

      image =
        document.createElement(
          "img"
        );

      image.id =
        "result-image";

      image.alt =
        "Результат анализа лица";

      wrapper.appendChild(
        image
      );
    }

    image.src =
      selectedObjectUrl;

    image.style.display =
      "block";

    image.style.visibility =
      "visible";

    image.style.opacity =
      "1";

    return;
  }

  candidates.forEach(
    (image) => {

      if (
        image instanceof
        HTMLImageElement
      ) {

        image.src =
          selectedObjectUrl;

        image.alt =
          "Результат анализа лица";

        image.style.display =
          "block";

        image.style.visibility =
          "visible";

        image.style.opacity =
          "1";
      }

    }
  );
}


// ============================================================
// SCORE
// ============================================================

function renderScore(score) {

  if (
    score === null ||
    score === undefined ||
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
        "Оценку не удалось определить";
    }

    return;
  }

  const normalized =
    clamp(
      Number(score),
      0,
      10
    );

  /*
   * Теперь UI тоже 0–10,
   * а не 0–100.
   */

  if (resultScore) {

    resultScore.textContent =
      formatScore10(
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


function getScoreStatus(score) {

  if (score < 3) {
    return "Низкая согласованность визуальных параметров";
  }

  if (score < 5) {
    return "Умеренная согласованность визуальных параметров";
  }

  if (score < 7) {
    return "Сбалансированный результат";
  }

  if (score < 8.5) {
    return "Высокая согласованность визуальных параметров";
  }

  return "Очень высокая согласованность визуальных параметров";
}


// ============================================================
// STATS
// ============================================================

function renderStats(result) {

  if (!statsGrid) {
    return;
  }

  statsGrid.innerHTML = "";

  /*
   * MODEL УБРАН.
   *
   * Пользователю не нужно знать,
   * какой технический backend использовался.
   */

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
        result.landmarks_count === null
          ? "—"
          : formatValue(
              result.landmarks_count
            ),

      detail:
        "ориентиров"
    },

    {
      label:
        "ПОКАЗАТЕЛИ",

      value:
        String(
          result.feature_count ||
          result.detected_features ||
          countLeaves(
            result.metrics
          )
        ),

      detail:
        "измерено"
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

function renderOverview(metrics) {

  if (!overviewGrid) {
    return;
  }

  overviewGrid.innerHTML =
    "";

  /*
   * Здесь больше НЕ выводим:
   *
   * face_geometry
   * eye_area_balance
   * measurement data
   *
   * в техническом виде.
   */

  const entries =
    getHumanOverviewMetrics(
      metrics
    );

  if (!entries.length) {

    overviewGrid.appendChild(
      createEmptyBlock(
        "Измерения не были возвращены."
      )
    );

    return;
  }

  entries.forEach(
    (entry) => {

      const card =
        createScoreCard(
          entry.label,
          entry.value,
          entry.description
        );

      overviewGrid.appendChild(
        card
      );
    }
  );
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

  addProductionMetric(
    values,
    production,
    "overall_harmony",
    "Общая гармония"
  );

  addProductionMetric(
    values,
    production,
    "frontal_harmony",
    "Гармония лица спереди"
  );

  addProductionMetric(
    values,
    production,
    "proportions",
    "Пропорции"
  );

  addMetricGroup(
    values,
    metrics,
    "face_geometry",
    "Геометрия лица"
  );

  addMetricGroup(
    values,
    metrics,
    "midface",
    "Средняя часть лица"
  );

  renderScoreList(
    harmonyContent,
    values,
    "Гармония"
  );
}


// ============================================================
// METRICS
// ============================================================

function renderMetrics(metrics) {

  if (!metricsContent) {
    return;
  }

  metricsContent.innerHTML =
    "";

  const entries =
    [];

  Object.entries(
    metrics || {}
  ).forEach(
    ([groupName, groupValue]) => {

      if (
        !isObject(
          groupValue
        )
      ) {

        if (
          isNumericScore(
            groupValue
          )
        ) {

          entries.push({
            label:
              getRussianLabel(
                groupName
              ),

            value:
              Number(
                groupValue
              ),

            group:
              ""
          });
        }

        return;
      }

      Object.entries(
        groupValue
      ).forEach(
        ([key, value]) => {

          if (
            isNumericScore(
              value
            )
          ) {

            entries.push({

              label:
                getRussianLabel(
                  key
                ),

              value:
                Number(
                  value
                ),

              group:
                getRussianLabel(
                  groupName
                )
            });
          }

        }
      );
    }
  );

  if (!entries.length) {

    metricsContent.appendChild(
      createEmptyBlock(
        "Измерения не были возвращены."
      )
    );

    return;
  }

  /*
   * Без бессмысленных accordion-вкладок.
   */

  entries.forEach(
    (entry) => {

      metricsContent.appendChild(
        createScoreCard(
          entry.label,
          entry.value,
          entry.group
        )
      );

    }
  );
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

  addMetricGroup(
    values,
    metrics,
    "jaw",
    "Челюсть"
  );

  addMetricGroup(
    values,
    metrics,
    "cheeks",
    "Скулы"
  );

  addProductionMetric(
    values,
    production,
    "angularity",
    "Угловатость"
  );

  addProductionMetric(
    values,
    production,
    "facial_definition",
    "Выраженность лица"
  );

  renderScoreList(
    angularityContent,
    values,
    "Угловатость"
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

  addMetricGroup(
    values,
    metrics,
    "symmetry",
    "Симметрия"
  );

  addMetricKey(
    values,
    metrics,
    "eyes",
    "eye_alignment",
    "Выравнивание глаз"
  );

  addMetricKey(
    values,
    metrics,
    "eyebrows",
    "brow_symmetry",
    "Симметрия бровей"
  );

  addMetricKey(
    values,
    metrics,
    "lips_mouth",
    "mouth_symmetry",
    "Симметрия рта"
  );

  addProductionMetric(
    values,
    production,
    "symmetry",
    "Общая симметрия"
  );

  addProductionMetric(
    values,
    production,
    "left_right_balance",
    "Баланс сторон"
  );

  renderScoreList(
    symmetryContent,
    values,
    "Симметрия"
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

  /*
   * Никаких придуманных биологических
   * выводов здесь не делаем.
   *
   * Если backend действительно вернул
   * числовой визуальный показатель —
   * показываем его.
   */

  const values = [];

  if (
    isObject(
      production
    ) &&
    isNumericScore(
      production.dimorphism
    )
  ) {

    values.push({

      label:
        "Визуальный показатель",

      value:
        Number(
          production.dimorphism
        ),

      group:
        "Визуальная характеристика"
    });
  }

  if (!values.length) {

    dimorphismContent.appendChild(
      createEmptyBlock(
        "Отдельный показатель в этом анализе не рассчитывался."
      )
    );

    return;
  }

  renderScoreList(
    dimorphismContent,
    values,
    "Диморфизм"
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
    "Этот раздел не является медицинской диагностикой. Система не определяет заболевания или состояние здоровья. Здесь отображаются только визуальные параметры, полученные из изображения.";

  healthContent.append(
    icon,
    text
  );
}


// ============================================================
// SCORE CARD
// ============================================================

function createScoreCard(
  label,
  value,
  description = ""
) {

  const card =
    document.createElement(
      "article"
    );

  card.className =
    "score-card";

  const top =
    document.createElement(
      "div"
    );

  top.className =
    "score-card__top";

  const title =
    document.createElement(
      "div"
    );

  title.className =
    "score-card__title";

  title.textContent =
    label;

  const number =
    document.createElement(
      "strong"
    );

  number.className =
    "score-card__number";

  number.textContent =
    formatScore10(
      value
    );

  top.append(
    title,
    number
  );

  const track =
    document.createElement(
      "div"
    );

  track.className =
    "score-track";

  const fill =
    document.createElement(
      "div"
    );

  fill.className =
    "score-track__fill";

  const normalized =
    clamp(
      Number(value),
      0,
      10
    );

  fill.style.width =
    `${normalized * 10}%`;

  /*
   * Добавляем числовой класс,
   * чтобы CSS мог использовать
   * разные состояния.
   */

  card.dataset.score =
    String(
      normalized
    );

  if (normalized < 4) {

    card.classList.add(
      "score-low"
    );

  } else if (
    normalized < 6.5
  ) {

    card.classList.add(
      "score-medium"
    );

  } else if (
    normalized < 8
  ) {

    card.classList.add(
      "score-good"
    );

  } else {

    card.classList.add(
      "score-excellent"
    );
  }

  track.append(
    fill
  );

  card.append(
    top,
    track
  );

  if (description) {

    const desc =
      document.createElement(
        "div"
      );

    desc.className =
      "score-card__description";

    desc.textContent =
      description;

    card.appendChild(
      desc
    );
  }

  return card;
}


// ============================================================
// SCORE LIST
// ============================================================

function renderScoreList(
  container,
  values,
  sectionName
) {

  container.innerHTML =
    "";

  /*
   * Удаляем дубликаты.
   */

  const unique =
    [];

  const seen =
    new Set();

  values.forEach(
    (entry) => {

      if (
        !entry ||
        !isNumericScore(
          entry.value
        )
      ) {
        return;
      }

      const key =
        `${entry.label}:${entry.value}`;

      if (
        seen.has(key)
      ) {
        return;
      }

      seen.add(key);

      unique.push(
        entry
      );
    }
  );

  if (!unique.length) {

    container.appendChild(
      createEmptyBlock(
        `Для раздела «${sectionName}» нет доступных измерений.`
      )
    );

    return;
  }

  unique.forEach(
    (entry) => {

      const card =
        createScoreCard(
          entry.label,
          entry.value,
          entry.group || ""
        );

      container.appendChild(
        card
      );
    }
  );
}


// ============================================================
// HELPERS FOR RESULT GROUPS
// ============================================================

function addProductionMetric(
  target,
  production,
  key,
  label
) {

  if (
    !isObject(
      production
    )
  ) {
    return;
  }

  const value =
    production[key];

  if (
    isNumericScore(
      value
    )
  ) {

    target.push({

      label,

      value:
        Number(
          value
        ),

      group:
        "Итоговый показатель"
    });
  }
}


function addMetricGroup(
  target,
  metrics,
  groupName,
  russianGroupName
) {

  if (
    !isObject(
      metrics
    )
  ) {
    return;
  }

  const group =
    metrics[groupName];

  if (
    !isObject(
      group
    )
  ) {
    return;
  }

  Object.entries(
    group
  ).forEach(
    ([key, value]) => {

      if (
        isNumericScore(
          value
        )
      ) {

        target.push({

          label:
            getRussianLabel(
              key
            ),

          value:
            Number(
              value
            ),

          group:
            russianGroupName
        });
      }

    }
  );
}


function addMetricKey(
  target,
  metrics,
  groupName,
  key,
  label
) {

  if (
    !isObject(
      metrics
    )
  ) {
    return;
  }

  const group =
    metrics[groupName];

  if (
    !isObject(
      group
    )
  ) {
    return;
  }

  const value =
    group[key];

  if (
    isNumericScore(
      value
    )
  ) {

    target.push({

      label,

      value:
        Number(
          value
        ),

      group:
        getRussianLabel(
          groupName
        )
    });
  }
}


// ============================================================
// HUMAN OVERVIEW
// ============================================================

function getHumanOverviewMetrics(
  metrics
) {

  const result =
    [];

  const preferred = [

    [
      "face_geometry",
      "face_aspect_ratio",
      "Соотношение сторон лица",
      "Общее соотношение геометрии лица"
    ],

    [
      "face_geometry",
      "facial_width_height_balance",
      "Баланс ширины и высоты лица",
      "Баланс основных пропорций"
    ],

    [
      "face_geometry",
      "midface_proportion",
      "Пропорция средней части лица",
      "Баланс средней зоны лица"
    ],

    [
      "symmetry",
      "overall_symmetry",
      "Общая симметрия",
      "Согласованность левой и правой стороны"
    ],

    [
      "eyes",
      "eye_spacing",
      "Расстояние между глазами",
      "Баланс расстояния между глазами"
    ],

    [
      "jaw",
      "jaw_definition",
      "Выраженность челюсти",
      "Насколько чётко выражена линия челюсти"
    ],

    [
      "cheeks",
      "cheek_definition",
      "Выраженность скул",
      "Выраженность скуловой зоны"
    ],

    [
      "lips_mouth",
      "mouth_symmetry",
      "Симметрия рта",
      "Баланс левой и правой стороны рта"
    ]

  ];

  preferred.forEach(
    (item) => {

      const [
        group,
        key,
        label,
        description
      ] = item;

      const value =
        metrics?.[group]?.[key];

      /*
       * Некоторые geometry-значения могут
       * быть ratio, а не оценкой 0–10.
       *
       * Поэтому overview не превращаем
       * насильно в score-bar, если значение
       * не находится в диапазоне 0–10.
       */

      if (
        isNumericScore(
          value
        )
      ) {

        result.push({

          label,

          value:
            Number(
              value
            ),

          description
        });
      }
    }
  );

  return result;
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

              item.classList.toggle(
                "active",
                item === tab
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

      tab.classList.toggle(
        "active",
        tab === firstTab
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
// HISTORY
// ============================================================

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

      model:
        result.model
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

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "history-empty";

    empty.textContent =
      "Пока нет сохранённых анализов.";

    historyList.appendChild(
      empty
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
        `${entry.feature_count ||
          entry.detected_features ||
          0} показателей`;

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
          : formatScore10(
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
      String(
        count
      );
  }
}


// ============================================================
// NEW ANALYSIS
// ============================================================

function startNewAnalysis() {

  analysisRequestId++;

  analysisInProgress =
    false;

  selectedFile =
    null;

  currentAnalysis =
    null;

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

  showScreen(
    "home"
  );
}


// ============================================================
// LOADING
// ============================================================

async function runLoadingSequence(
  analysisPromise
) {

  const steps = [

    {
      index: 0,
      title:
        "Обрабатываем фотографию",
      text:
        "Подготавливаем изображение"
    },

    {
      index: 1,
      title:
        "Анализируем лицо",
      text:
        "Определяем видимые параметры лица"
    },

    {
      index: 2,
      title:
        "Измеряем пропорции",
      text:
        "Собираем основные показатели"
    },

    {
      index: 3,
      title:
        "Проверяем симметрию",
      text:
        "Сравниваем левую и правую стороны"
    },

    {
      index: 4,
      title:
        "Формируем результат",
      text:
        "Подготавливаем итоговый отчёт"
    }

  ];

  for (
    let i = 0;
    i < steps.length;
    i++
  ) {

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

    if (
      i <
      steps.length - 1
    ) {

      await sleep(500);

    } else {

      await Promise.race([

        analysisPromise.catch(
          () => null
        ),

        sleep(1500)

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

  } else {

    console.error(
      "FaceMetric: #upload-btn not found."
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

  } else {

    console.error(
      "FaceMetric: #file-input not found."
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


  bindResultTabs();
}


// ============================================================
// FORMATTING
// ============================================================

function formatBytes(bytes) {

  if (
    !Number.isFinite(
      bytes
    )
  ) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} КБ`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} МБ`;
}


function formatScore10(score) {

  const number =
    Number(score);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "—";
  }

  return (
    Math.round(
      clamp(
        number,
        0,
        10
      ) * 10
    ) / 10
  )
    .toFixed(1)
    .replace(
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
      Number(
        value.toFixed(2)
      )
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
    new Date(
      value
    );

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
// LABELS
// ============================================================

function getRussianLabel(key) {

  if (
    LABELS[key]
  ) {
    return LABELS[key];
  }

  return prettifyKey(
    key
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

  return String(
    path || ""
  )
    .split(".")
    .map(
      (part) =>
        getRussianLabel(
          part
        )
    )
    .join(
      " · "
    );
}


// ============================================================
// OBJECT HELPERS
// ============================================================

function isObject(value) {

  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(
      value
    )
  );
}


function flattenObject(
  object,
  prefix = ""
) {

  const result = [];

  if (
    !isObject(
      object
    )
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
        isObject(
          value
        )
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


function toNumberOrZero(value) {

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
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
    Number(
      value
    );

  return Number.isFinite(
    number
  )
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
    Number(
      value
    );

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


function isNumericScore(value) {

  const number =
    Number(
      value
    );

  return (
    Number.isFinite(
      number
    ) &&
    number >= 0 &&
    number <= 10
  );
}


function cleanText(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(
    value
  ).trim();
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
// ERROR HANDLING
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
    message.includes(
      "413"
    )
  ) {

    return (
      "Фотография слишком большая."
    );
  }

  if (
    message.includes(
      "429"
    )
  ) {

    return (
      "Gemini временно ограничил количество запросов. Попробуй позже."
    );
  }

  if (
    message.includes(
      "401"
    ) ||
    message.includes(
      "403"
    )
  ) {

    return (
      "Ошибка авторизации Worker. Проверь настройки Gemini API."
    );
  }

  return (
    message ||
    "Анализ не выполнен. Попробуй ещё раз."
  );
}


function getHttpErrorMessage(status) {

  if (status === 400) {
    return "Некорректный запрос к серверу анализа.";
  }

  if (status === 401) {
    return "Ошибка авторизации Gemini API.";
  }

  if (status === 403) {
    return "Доступ к Gemini API запрещён.";
  }

  if (status === 413) {
    return "Файл слишком большой.";
  }

  if (status === 429) {
    return "Слишком много запросов. Попробуй позже.";
  }

  if (status >= 500) {
    return "Ошибка сервера анализа.";
  }

  return `Ошибка сервера (${status}).`;
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

      console.warn(
        "Health check:",
        response.status
      );

      return false;
    }

    const data =
      await response.json();

    console.log(
      "Gemini Worker health:",
      data
    );

    return (
      data?.success === true
    );

  } catch (error) {

    console.warn(
      "Health check error:",
      error
    );

    return false;
  }
}


// ============================================================
// START
// ============================================================

function init() {

  initTelegram();

  bindEvents();

  updateHistoryCount();

  activateDefaultResultTab();

  showScreen(
    "home"
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
          "Background health check:",
          error
        );
      }
    );
}


init();
