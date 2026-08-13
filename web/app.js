"use strict";

/*
 * ============================================================
 * FaceMetric / FaceBot
 * ============================================================
 *
 * Frontend for the current HTML structure.
 *
 * Website:
 *   https://facebotpsl.snow4lyt.workers.dev/
 *
 * Gemini Worker:
 *   https://facebot-gemini.snow4lyt.workers.dev/api/analyze
 *
 * IMPORTANT:
 * - The website and Gemini Worker are separate services.
 * - The browser sends multipart/form-data directly to the
 *   Gemini Worker.
 * - The file field name MUST be "file".
 * - Content-Type is NOT set manually for FormData.
 *   The browser creates the multipart boundary automatically.
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

const tg =
  window.Telegram &&
  window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;


// ============================================================
// DOM REFERENCES
// ============================================================

const screens = document.querySelectorAll(".screen");

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

const loadingContent =
  document.getElementById("loading-content");

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
// TELEGRAM MINI APP
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

    if (
      typeof tg.enableClosingConfirmation ===
      "function"
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
      const isTarget =
        screen === target;

      screen.classList.toggle(
        "active",
        isTarget
      );

      if (isTarget) {
        /*
         * Force the screen-enter animation
         * every time we switch screens.
         */
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
  }
}

function updateNavigation(name) {
  const navItems =
    document.querySelectorAll(
      ".nav-item"
    );

  navItems.forEach(
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
    console.error(
      "FaceMetric: #file-input was not found."
    );

    showToast(
      "Не найден загрузчик фотографии."
    );

    return;
  }

  /*
   * Reset the value so selecting the same
   * image twice still fires the change event.
   */
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

  /*
   * Invalidate any previous analysis request.
   */
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

  /*
   * Update filename on home screen.
   */
  if (uploadName) {
    uploadName.textContent =
      `${file.name} · ${formatBytes(file.size)}`;
  }

  /*
   * Put the image into the analysis preview.
   */
  if (analysisImage) {
    analysisImage.src =
      selectedObjectUrl;

    analysisImage.alt =
      "Фото для анализа";

    /*
     * Re-trigger image reveal animation.
     */
    analysisImage.style.animation = "none";

    void analysisImage.offsetWidth;

    analysisImage.style.animation = "";
  }

  /*
   * Update state text.
   */
  if (analysisState) {
    analysisState.textContent =
      "READY";
  }

  /*
   * Reset the visible score.
   */
  resetAnalysisPreview();

  /*
   * Go straight to the analysis screen.
   *
   * There is no separate "Analyze" button
   * in the supplied HTML, so uploading the
   * photo starts the analysis automatically.
   */
  showScreen("analysis");

  /*
   * Start the real analysis.
   */
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
      "ANALYZING";
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

  const displayScore =
    Math.round(
      Number(score) * 10
    );

  if (analysisScoreValue) {
    analysisScoreValue.textContent =
      String(displayScore);
  }

  if (analysisScore) {
    analysisScore.classList.add(
      "show"
    );

    /*
     * After the large central score
     * appears, move it toward the
     * bottom corner like a scan result.
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
      900
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
    "ANALYZING"
  );

  try {
    /*
     * Start the API request immediately.
     *
     * This is important:
     * the animation must NOT delay the
     * actual Gemini request.
     */
    const analysisPromise =
      analyzePhoto(file);

    /*
     * Animate the loading UI while
     * Gemini is processing.
     */
    await runLoadingSequence(
      analysisPromise
    );

    const result =
      await analysisPromise;

    /*
     * Ignore an obsolete request.
     */
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
        "Анализ не выполнен."
      );
    }

    currentAnalysis =
      normalizeClientResult(
        result
      );

    /*
     * Finish loading UI.
     */
    completeLoadingSteps();

    setAnalysisState(
      "COMPLETE"
    );

    /*
     * Show result score briefly
     * on the analysis screen.
     */
    showAnalysisPreviewScore(
      currentAnalysis.score
    );

    /*
     * Save result locally.
     */
    saveHistory(
      currentAnalysis
    );

    /*
     * Small pause so the completion
     * animation can be seen.
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

    console.error(
      "FaceMetric analysis stack:",
      error?.stack
    );

    setAnalysisState(
      "ERROR"
    );

    showToast(
      getFriendlyErrorMessage(
        error
      )
    );

    /*
     * Keep the selected photo.
     * User can simply try the same
     * photo again by clicking upload.
     */
    showScreen("home");

  } finally {
    if (
      requestId ===
      analysisRequestId
    ) {
      analysisInProgress = false;
    }
  }
}


// ============================================================
// API REQUEST
// ============================================================

async function analyzePhoto(file) {
  if (!file) {
    throw new Error(
      "Фотография не выбрана."
    );
  }

  /*
   * Validate again before sending.
   */
  const validation =
    validateFile(file);

  if (!validation.valid) {
    throw new Error(
      validation.message
    );
  }

  /*
   * FormData is REQUIRED.
   *
   * Do NOT manually set:
   * Content-Type: multipart/form-data
   *
   * The browser must generate:
   * multipart/form-data; boundary=...
   */
  const formData =
    new FormData();

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
      2000
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
        "FaceMetric invalid JSON:",
        error
      );

      console.error(
        "Raw API response:",
        responseText
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
// OPTIONAL WORKER HEALTH CHECK
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
        "Gemini Worker health check failed:",
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
      "Gemini Worker health check error:",
      error
    );

    return false;
  }
}


// ============================================================
// LOADING ANIMATION
// ============================================================

async function runLoadingSequence(
  analysisPromise
) {
  const steps = [
    {
      index: 0,
      title:
        "Обрабатываем изображение",
      text:
        "Подготавливаем фотографию"
    },

    {
      index: 1,
      title:
        "Ищем facial landmarks",
      text:
        "Анализируем видимую структуру лица"
    },

    {
      index: 2,
      title:
        "Измеряем пропорции",
      text:
        "Собираем измеряемые параметры"
    },

    {
      index: 3,
      title:
        "Рассчитываем симметрию",
      text:
        "Сравниваем визуальные характеристики"
    },

    {
      index: 4,
      title:
        "Формируем отчёт",
      text:
        "Получаем итоговый результат"
    }
  ];

  /*
   * We don't want the UI to hang forever
   * if Gemini is slow.
   *
   * Each step gets a minimum amount of
   * visual time, but the request itself
   * runs in parallel.
   */
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

    /*
     * First four stages are relatively
     * short. The final stage waits for
     * the actual API response.
     */
    if (
      i <
      steps.length - 1
    ) {
      await sleep(500);
    } else {
      /*
       * The request is already running.
       * Keep the final stage visible until
       * the API has finished, but don't block
       * forever if something unexpected happens.
       */
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
      "Обрабатываем изображение";
  }

  if (loadingText) {
    loadingText.textContent =
      "Подготавливаем фотографию";
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
// RESULT NORMALIZATION
// ============================================================

function normalizeClientResult(
  data
) {
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
// RESULT RENDERING
// ============================================================

function renderResult(
  result
) {
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
}


// ============================================================
// SCORE
// ============================================================

function renderScore(
  score
) {
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
        "Лицо не удалось надёжно определить";
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
   * Backend score is 0–10.
   *
   * UI displays 0–100.
   */
  const displayScore =
    Math.round(
      normalized * 10
    );

  if (resultScore) {
    resultScore.textContent =
      String(
        displayScore
      );
  }

  if (scoreProgress) {
    /*
     * Because the backend score is already
     * 0–10, multiplying by 10 gives the
     * percentage.
     */
    scoreProgress.style.width =
      `${clamp(
        normalized * 10,
        0,
        100
      )}%`;
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
  if (score < 3) {
    return "Измерения получены";
  }

  if (score < 5) {
    return "Измерения получены";
  }

  if (score < 7) {
    return "Сбалансированный результат";
  }

  if (score < 8.5) {
    return "Высокая согласованность измерений";
  }

  return "Очень высокая согласованность измерений";
}


// ============================================================
// STATS
// ============================================================

function renderStats(
  result
) {
  if (!statsGrid) {
    return;
  }

  statsGrid.innerHTML =
    "";

  const stats = [
    {
      label: "FACE",
      value:
        String(
          result.face_count
        ),
      detail:
        "detected"
    },

    {
      label: "LANDMARKS",
      value:
        result.landmarks_count === null
          ? "—"
          : formatValue(
              result.landmarks_count
            ),
      detail:
        "points"
    },

    {
      label: "FEATURES",
      value:
        String(
          result.feature_count ||
          result.detected_features ||
          countLeaves(
            result.metrics
          )
        ),
      detail:
        "measured"
    },

    {
      label: "MODEL",
      value:
        shortenModelName(
          result.model
        ),
      detail:
        "analyzer"
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
  metrics
) {
  if (!overviewGrid) {
    return;
  }

  overviewGrid.innerHTML =
    "";

  const leaves =
    flattenObject(
      metrics
    );

  const entries =
    leaves.slice(
      0,
      8
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
        prettifyPath(
          key
        );

      const valueElement =
        document.createElement(
          "div"
        );

      valueElement.className =
        "overview-card__value";

      valueElement.textContent =
        formatValue(
          value
        );

      const source =
        document.createElement(
          "div"
        );

      source.className =
        "overview-card__source";

      source.textContent =
        "measurement data";

      card.append(
        label,
        valueElement,
        source
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

  const groups = [];

  const harmony =
    getObjectGroup(
      production,
      [
        "overall_harmony",
        "frontal_harmony",
        "proportions"
      ]
    );

  if (harmony.length) {
    groups.push({
      title:
        "Общая гармония",
      values:
        harmony
    });
  }

  const geometry =
    getGroup(
      metrics,
      [
        "face_geometry"
      ]
    );

  if (geometry.length) {
    groups.push({
      title:
        "Геометрия лица",
      values:
        geometry
    });
  }

  const midface =
    getGroup(
      metrics,
      [
        "midface"
      ]
    );

  if (midface.length) {
    groups.push({
      title:
        "Midface",
      values:
        midface
    });
  }

  renderFeatureGroups(
    harmonyContent,
    groups,
    "Гармония"
  );
}


// ============================================================
// METRICS / FEATURES
// ============================================================

function renderMetrics(
  metrics
) {
  if (!metricsContent) {
    return;
  }

  metricsContent.innerHTML =
    "";

  const groups =
    Object.entries(
      metrics || {}
    );

  if (!groups.length) {
    metricsContent.appendChild(
      createEmptyBlock(
        "Измерения не были возвращены."
      )
    );

    return;
  }

  groups.forEach(
    ([groupName, groupValue]) => {
      if (
        isObject(
          groupValue
        )
      ) {
        Object.entries(
          groupValue
        ).forEach(
          ([key, value]) => {
            metricsContent.appendChild(
              createMetricCard(
                groupName,
                key,
                value
              )
            );
          }
        );

      } else {
        metricsContent.appendChild(
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

  header.type =
    "button";

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
    prettifyKey(
      key
    );

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
    formatValue(
      value
    );

  const arrow =
    document.createElement(
      "span"
    );

  arrow.className =
    "metric-arrow";

  arrow.textContent =
    "+";

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
      ? prettifyKey(
          groupName
        )
      : "VALUE";

  const detailValue =
    document.createElement(
      "strong"
    );

  detailValue.textContent =
    formatValue(
      value
    );

  detail.append(
    detailLabel,
    detailValue
  );

  contentInner.append(
    detail
  );

  content.append(
    contentInner
  );

  card.append(
    header,
    content
  );

  header.addEventListener(
    "click",
    () => {
      card.classList.toggle(
        "open"
      );
    }
  );

  return card;
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

  const groups = [];

  const jaw =
    getGroup(
      metrics,
      [
        "jaw"
      ]
    );

  if (jaw.length) {
    groups.push({
      title:
        "Jaw",
      values:
        jaw
    });
  }

  const cheeks =
    getGroup(
      metrics,
      [
        "cheeks"
      ]
    );

  if (cheeks.length) {
    groups.push({
      title:
        "Cheeks",
      values:
        cheeks
    });
  }

  const angularity =
    getObjectGroup(
      production,
      [
        "angularity",
        "facial_definition"
      ]
    );

  if (angularity.length) {
    groups.push({
      title:
        "Угловатость",
      values:
        angularity
    });
  }

  renderFeatureGroups(
    angularityContent,
    groups,
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

  const groups = [];

  const symmetry =
    getGroup(
      metrics,
      [
        "symmetry"
      ]
    );

  if (symmetry.length) {
    groups.push({
      title:
        "Симметрия",
      values:
        symmetry
    });
  }

  const eyeAlignment =
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

  if (eyeAlignment.length) {
    groups.push({
      title:
        "Выравнивание глаз",
      values:
        eyeAlignment
    });
  }

  const productionSymmetry =
    getObjectGroup(
      production,
      [
        "symmetry"
      ]
    );

  if (productionSymmetry.length) {
    groups.push({
      title:
        "Итоговая симметрия",
      values:
        productionSymmetry
    });
  }

  renderFeatureGroups(
    symmetryContent,
    groups,
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

  const groups = [];

  /*
   * We intentionally do not invent
   * biological sex/gender information.
   *
   * If the backend provides a visual
   * "dimorphism" metric, we display
   * only the returned measurement.
   */
  const productionDimorphism =
    getObjectGroup(
      production,
      [
        "dimorphism"
      ]
    );

  if (
    productionDimorphism.length
  ) {
    groups.push({
      title:
        "Визуальный показатель",
      values:
        productionDimorphism
    });
  }

  renderFeatureGroups(
    dimorphismContent,
    groups,
    "Диморфизм"
  );

  if (
    !groups.length
  ) {
    dimorphismContent.innerHTML =
      "";

    dimorphismContent.appendChild(
      createEmptyBlock(
        "В текущем результате отдельный показатель не возвращён."
      )
    );
  }
}


// ============================================================
// HEALTH
// ============================================================

function renderHealth(
  result
) {
  if (!healthContent) {
    return;
  }

  /*
   * Keep this section strictly non-medical.
   * The Worker prompt explicitly prohibits
   * inferring health conditions.
   */
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
    "Этот раздел не является медицинской диагностикой. Система не определяет заболевания или состояние здоровья. Здесь отображаются только визуальные параметры, которые реально удалось получить из изображения.";

  healthContent.append(
    icon,
    text
  );
}


// ============================================================
// FEATURE GROUP RENDERER
// ============================================================

function renderFeatureGroups(
  container,
  groups,
  emptyLabel
) {
  container.innerHTML =
    "";

  if (!groups.length) {
    container.appendChild(
      createEmptyBlock(
        `Для раздела «${emptyLabel}» нет отдельных измерений.`
      )
    );

    return;
  }

  groups.forEach(
    (groupData) => {
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

      header.type =
        "button";

      header.className =
        "feature-group__header";

      const title =
        document.createElement(
          "span"
        );

      title.className =
        "feature-group__title";

      title.textContent =
        groupData.title;

      const count =
        document.createElement(
          "span"
        );

      count.className =
        "feature-group__count";

      count.textContent =
        `${groupData.values.length} VALUES`;

      const arrow =
        document.createElement(
          "span"
        );

      arrow.className =
        "feature-group__arrow";

      arrow.textContent =
        "+";

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

      const wrapper =
        document.createElement(
          "div"
        );

      const inner =
        document.createElement(
          "div"
        );

      inner.className =
        "feature-list-inner";

      groupData.values.forEach(
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
            prettifyPath(
              key
            );

          const valueElement =
            document.createElement(
              "span"
            );

          valueElement.className =
            "feature-row__value";

          valueElement.textContent =
            formatValue(
              value
            );

          row.append(
            name,
            valueElement
          );

          inner.appendChild(
            row
          );
        }
      );

      wrapper.append(
        inner
      );

      list.append(
        wrapper
      );

      group.append(
        header,
        list
      );

      header.addEventListener(
        "click",
        () => {
          group.classList.toggle(
            "open"
          );
        }
      );

      container.appendChild(
        group
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
        result.detected_features,

      model:
        result.model
    };

    history.unshift(
      entry
    );

    const limited =
      history.slice(
        0,
        50
      );

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        limited
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

      score.className =
        "score";

      score.textContent =
        entry.score === null ||
        entry.score === undefined
          ? "—"
          : String(
              Math.round(
                Number(
                  entry.score
                ) * 10
              )
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
// NEW ANALYSIS
// ============================================================

function startNewAnalysis() {
  analysisRequestId++;

  analysisInProgress = false;

  selectedFile = null;

  currentAnalysis = null;

  if (selectedObjectUrl) {
    URL.revokeObjectURL(
      selectedObjectUrl
    );

    selectedObjectUrl = null;
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
// TOAST
// ============================================================

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
// ERROR MESSAGES
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
      "Не удалось подключиться к Gemini Worker. " +
      "Проверь Worker и CORS."
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
      "Gemini временно ограничил количество запросов. Попробуй немного позже."
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
      "Worker не смог авторизоваться в Gemini API. Проверь GEMINI_API_KEY."
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
    return "Ошибка Gemini Worker.";
  }

  return `Ошибка сервера (${status}).`;
}


// ============================================================
// FORMATTING
// ============================================================

function formatBytes(
  bytes
) {
  if (
    !Number.isFinite(
      bytes
    )
  ) {
    return "—";
  }

  if (
    bytes < 1024
  ) {
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
    Number(
      score
    );

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
    )
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
    if (
      !Number.isFinite(
        value
      )
    ) {
      return "—";
    }

    if (
      Number.isInteger(
        value
      )
    ) {
      return String(
        value
      );
    }

    return String(
      Math.round(
        value * 100
      ) / 100
    );
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  if (
    typeof value ===
    "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch (error) {
      return "—";
    }
  }

  return String(
    value
  );
}

function formatDate(
  value
) {
  const date =
    new Date(
      value
    );

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

function prettifyKey(
  key
) {
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
      (char) =>
        char.toUpperCase()
    );
}

function prettifyPath(
  path
) {
  const parts =
    String(
      path || ""
    ).split(
      "."
    );

  return parts
    .map(
      (part) =>
        prettifyKey(
          part
        )
    )
    .join(
      " · "
    );
}

function shortenModelName(
  model
) {
  const value =
    String(
      model || ""
    );

  if (
    value.length <= 18
  ) {
    return value;
  }

  return `${value.slice(
    0,
    16
  )}…`;
}


// ============================================================
// OBJECT HELPERS
// ============================================================

function isObject(
  value
) {
  return (
    value !== null &&
    typeof value ===
      "object" &&
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
    Number(
      value
    );

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
    Number(
      value
    );

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

function cleanText(
  value
) {
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


// ============================================================
// METRIC GROUP HELPERS
// ============================================================

function getGroup(
  object,
  names
) {
  if (
    !isObject(
      object
    )
  ) {
    return [];
  }

  const result = [];

  names.forEach(
    (name) => {
      const group =
        object[name];

      if (
        isObject(
          group
        )
      ) {
        result.push(
          ...flattenObject(
            group
          ).map(
            ([key, value]) => [
              key,
              value
            ]
          )
        );
      }
    }
  );

  return result;
}

function getObjectGroup(
  object,
  names
) {
  if (
    !isObject(
      object
    )
  ) {
    return [];
  }

  const result = [];

  names.forEach(
    (name) => {
      const value =
        object[name];

      if (
        value !==
        undefined
      ) {
        result.push([
          name,
          value
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
  /*
   * MAIN UPLOAD BUTTON
   *
   * This is the critical fix.
   *
   * Current HTML:
   *   <button id="upload-btn">
   *
   * Current input:
   *   <input id="file-input" ...>
   */
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
      "FaceMetric: #upload-btn was not found."
    );
  }

  /*
   * FILE INPUT
   */
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
      "FaceMetric: #file-input was not found."
    );
  }

  /*
   * NAVIGATION
   *
   * Current HTML uses:
   *   data-screen="history"
   *
   * not data-go.
   */
  document
    .querySelectorAll(
      "[data-screen]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          (event) => {
            /*
             * Don't interfere with the
             * actual upload button.
             */
            if (
              element ===
              uploadButton
            ) {
              return;
            }

            const target =
              element.dataset.screen;

            if (
              target
            ) {
              showScreen(
                target
              );
            }
          }
        );
      }
    );

  /*
   * BACK BUTTONS
   */
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

            if (
              target
            ) {
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

  /*
   * NEW ANALYSIS
   */
  if (newAnalysisButton) {
    newAnalysisButton.addEventListener(
      "click",
      () => {
        startNewAnalysis();
      }
    );
  }

  /*
   * REPORT TABS
   */
  bindResultTabs();
}


// ============================================================
// STARTUP
// ============================================================

function init() {
  /*
   * The script is normally loaded at
   * the bottom of <body>, so DOM elements
   * should already exist.
   */
  initTelegram();

  bindEvents();

  updateHistoryCount();

  activateDefaultResultTab();

  showScreen(
    "home"
  );

  /*
   * Don't block startup with health check.
   * It is only diagnostic.
   */
  checkWorkerHealth()
    .then(
      (healthy) => {
        if (!healthy) {
          console.warn(
            "FaceMetric: Gemini Worker health check did not pass."
          );
        }
      }
    )
    .catch(
      (error) => {
        console.warn(
          "FaceMetric: background health check failed:",
          error
        );
      }
    );
}


/*
 * Start the application.
 */
init();
