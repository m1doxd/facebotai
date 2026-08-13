(() => {
  "use strict";


  /* =========================================================
     DOM HELPERS
  ========================================================== */

  const $ = (selector, root = document) =>
    root.querySelector(selector);


  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];


  /* =========================================================
     APPLICATION STATE
  ========================================================== */

  const state = {
    file: null,

    objectUrl: null,

    result: null,

    analysisRunning: false,

    analysisTimer: null,

    animationTimers: [],

    imageNaturalWidth: 0,

    imageNaturalHeight: 0,

    canvasScale: 1,

    lastLandmarks: [],

    historyKey: "facemetric-history"
  };


  /* =========================================================
     SCREENS
  ========================================================== */

  const screens = {
    home: $("#screen-home"),
    analysis: $("#screen-analysis"),
    result: $("#screen-result"),
    history: $("#screen-history"),
    about: $("#screen-about")
  };


  /* =========================================================
     UPLOAD DOM
  ========================================================== */

  const fileInput =
    $("#file-input");

  const uploadBtn =
    $("#upload-btn");

  const uploadZone =
    $("#upload-zone");

  const uploadName =
    $("#upload-name");


  /* =========================================================
     ANALYSIS DOM
  ========================================================== */

  const analysisImage =
    $("#analysis-image");

  const canvas =
    $("#landmark-canvas");

  const ctx =
    canvas?.getContext("2d");

  const analysisFrame =
    $("#analysis-frame");

  const loadingTitle =
    $("#loading-title");

  const loadingText =
    $("#loading-text");

  const analysisState =
    $("#analysis-state");

  const analysisScore =
    $("#analysis-score");

  const analysisScoreValue =
    $("#analysis-score strong");

  const analysisScoreUnit =
    $("#analysis-score small");

  const loadingProgressBar =
    $("#loading-progress-bar");

  const scanLine =
    $("#scan-line");

  const faceGuide =
    $("#face-guide");

  const landmarkCount =
    $("#landmark-count");

  const axisStatus =
    $("#axis-status");

  const previewProcessing =
    $("#preview-processing");


  /* =========================================================
     RESULT DOM
  ========================================================== */

  const resultScore =
    $("#result-score");

  const scoreProgress =
    $("#score-progress");

  const scoreStatus =
    $("#score-status");

  const resultLandmarkCount =
    $("#result-landmark-count");

  const scoreDataStatus =
    $("#score-data-status");


  /* =========================================================
     TOAST
  ========================================================== */

  const toast =
    $("#toast");


  /* =========================================================
     CONSTANTS
  ========================================================== */

  const MAX_FILE_SIZE =
    15 * 1024 * 1024;


  const ACCEPTED_TYPES =
    new Set([
      "image/jpeg",
      "image/png",
      "image/webp"
    ]);


  const LOADING_STEPS = [
    {
      title: "Анализируем",
      text: "Подготавливаем изображение"
    },

    {
      title: "Ищем landmarks",
      text: "Определяем опорные точки лица"
    },

    {
      title: "Измеряем",
      text: "Рассчитываем пропорции и отношения"
    },

    {
      title: "Сравниваем",
      text: "Анализируем симметрию и геометрию"
    },

    {
      title: "Формируем отчёт",
      text: "Собираем измеренные результаты"
    }
  ];


  /* =========================================================
     INITIALIZATION
  ========================================================== */

  init();


  function init() {
    bindNavigation();

    bindUpload();

    bindDragAndDrop();

    bindTabs();

    bindExpandableDelegation();

    bindNewAnalysis();

    bindKeyboardShortcuts();

    renderHistory();

    setupImageEvents();

    updateRevealDelays();

    window.addEventListener(
      "resize",
      handleResize
    );

    window.addEventListener(
      "beforeunload",
      cleanupObjectUrl
    );
  }


  /* =========================================================
     NAVIGATION
  ========================================================== */

  function bindNavigation() {
    $$("[data-screen]").forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const screen =
            button.dataset.screen;

          if (
            screen === "analysis" &&
            !state.analysisRunning
          ) {
            return;
          }

          showScreen(screen);
        }
      );
    });
  }


  function showScreen(name) {
    const target =
      screens[name];

    if (!target) {
      return;
    }


    Object.values(screens).forEach(screen => {
      if (!screen) {
        return;
      }

      screen.classList.remove(
        "active",
        "screen-enter"
      );
    });


    target.classList.add("active");


    requestAnimationFrame(() => {
      target.classList.add(
        "screen-enter"
      );
    });


    $$(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.screen === name
      );
    });


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  /* =========================================================
     UPLOAD
  ========================================================== */

  function bindUpload() {
    if (!uploadBtn || !fileInput) {
      return;
    }


    uploadBtn.addEventListener(
      "click",
      () => {
        if (state.analysisRunning) {
          return;
        }

        fileInput.click();
      }
    );


    fileInput.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        handleSelectedFile(file);
      }
    );
  }


  function handleSelectedFile(file) {
    const validation =
      validateFile(file);

    if (!validation.valid) {
      notify(validation.message);

      fileInput.value = "";

      return;
    }


    startAnalysis(file);
  }


  function validateFile(file) {
    if (!file) {
      return {
        valid: false,
        message: "Файл не выбран."
      };
    }


    if (
      !ACCEPTED_TYPES.has(file.type)
    ) {
      return {
        valid: false,
        message:
          "Поддерживаются только JPG, PNG и WEBP."
      };
    }


    if (
      file.size > MAX_FILE_SIZE
    ) {
      return {
        valid: false,
        message:
          "Файл слишком большой. Максимум 15 MB."
      };
    }


    return {
      valid: true
    };
  }


  /* =========================================================
     DRAG & DROP
  ========================================================== */

  function bindDragAndDrop() {
    if (!uploadZone) {
      return;
    }


    [
      "dragenter",
      "dragover"
    ].forEach(eventName => {
      uploadZone.addEventListener(
        eventName,
        event => {
          event.preventDefault();

          if (state.analysisRunning) {
            return;
          }

          uploadZone.classList.add(
            "dragging"
          );
        }
      );
    });


    [
      "dragleave",
      "drop"
    ].forEach(eventName => {
      uploadZone.addEventListener(
        eventName,
        event => {
          event.preventDefault();

          uploadZone.classList.remove(
            "dragging"
          );
        }
      );
    });


    uploadZone.addEventListener(
      "drop",
      event => {
        if (state.analysisRunning) {
          return;
        }

        const file =
          event.dataTransfer?.files?.[0];

        if (!file) {
          return;
        }

        handleSelectedFile(file);
      }
    );
  }


  /* =========================================================
     IMAGE SETUP
  ========================================================== */

  function setupImageEvents() {
    if (!analysisImage) {
      return;
    }


    analysisImage.addEventListener(
      "load",
      () => {
        state.imageNaturalWidth =
          analysisImage.naturalWidth;

        state.imageNaturalHeight =
          analysisImage.naturalHeight;

        resizeCanvas();

        drawScanningLandmarks();
      }
    );
  }


  function setPreview(file) {
    if (!analysisImage) {
      return;
    }


    revokeObjectUrl();


    state.objectUrl =
      URL.createObjectURL(file);


    analysisImage.src =
      state.objectUrl;


    uploadName.textContent =
      file.name;


    analysisImage.onload = () => {
      state.imageNaturalWidth =
        analysisImage.naturalWidth;

      state.imageNaturalHeight =
        analysisImage.naturalHeight;

      resizeCanvas();

      drawScanningLandmarks();
    };
  }


  /* =========================================================
     START ANALYSIS
  ========================================================== */

  async function startAnalysis(file) {
    if (state.analysisRunning) {
      return;
    }


    state.analysisRunning = true;

    state.file = file;

    state.result = null;

    state.lastLandmarks = [];


    uploadName.textContent =
      file.name;


    setPreview(file);

    resetAnalysisUI();

    showScreen("analysis");


    try {
      await waitForImageReady();

      const loadingAnimation =
        runLoadingAnimation();


      const result =
        await analyzeImage(file);


      await loadingAnimation;


      validateResult(result);


      state.result = result;


      await finishAnalysis(result);

    } catch (error) {
      console.error(
        "FaceMetric analysis error:",
        error
      );


      clearAnalysisAnimation();


      const message =
        error?.message ||
        "Не удалось выполнить анализ.";


      notify(message);


      analysisState.textContent =
        "ERROR";


      analysisState.classList.remove(
        "complete"
      );


      previewProcessing.style.display =
        "none";


      state.analysisRunning = false;


      showScreen("home");
    }
  }


  /* =========================================================
     RESET ANALYSIS UI
  ========================================================== */

  function resetAnalysisUI() {
    clearAnalysisAnimation();


    analysisState.textContent =
      "ANALYZING";


    analysisState.classList.remove(
      "complete"
    );


    analysisScore.classList.remove(
      "show",
      "float"
    );


    analysisScoreValue.textContent =
      "—";


    if (analysisScoreUnit) {
      analysisScoreUnit.textContent =
        "/ 100";
    }


    loadingTitle.textContent =
      LOADING_STEPS[0].title;


    loadingText.textContent =
      LOADING_STEPS[0].text;


    loadingProgressBar.style.width =
      "0%";


    landmarkCount.textContent =
      "0";


    axisStatus.textContent =
      "—";


    faceGuide.classList.remove(
      "visible"
    );


    previewProcessing.style.display =
      "flex";


    $$(".loading-step").forEach(
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


    clearCanvas();
  }


  /* =========================================================
     LOADING ANIMATION
  ========================================================== */

  async function runLoadingAnimation() {
    const steps =
      $$(".loading-step");


    if (!steps.length) {
      return;
    }


    for (
      let index = 0;
      index < steps.length;
      index++
    ) {
      if (!state.analysisRunning) {
        return;
      }


      const step =
        steps[index];


      const info =
        LOADING_STEPS[index];


      loadingTitle.textContent =
        info.title;


      loadingText.textContent =
        info.text;


      loadingProgressBar.style.width =
        `${((index + 1) / steps.length) * 100}%`;


      steps.forEach(
        (currentStep, currentIndex) => {
          currentStep.classList.toggle(
            "active",
            currentIndex === index
          );


          if (
            currentIndex < index
          ) {
            currentStep.classList.add(
              "done"
            );
          }
        }
      );


      const duration =
        index === 0
          ? 420
          : index === steps.length - 1
            ? 520
            : 460;


      await delay(duration);
    }


    steps.forEach(step => {
      step.classList.remove(
        "active"
      );

      step.classList.add(
        "done"
      );
    });


    loadingProgressBar.style.width =
      "100%";
  }


  /* =========================================================
     BACKEND ANALYSIS
  ========================================================== */

  async function analyzeImage(file) {
    /*
     * ВАЖНО:
     *
     * Этот frontend НЕ создаёт score.
     *
     * Backend /api/analyze должен вернуть реальные
     * измерения из measurement pipeline.
     *
     * Минимальный обязательный ответ:
     *
     * {
     *   "score": 78.4
     * }
     *
     * Желательно:
     *
     * {
     *   "score": 78.4,
     *   "landmarks": [...],
     *   "stats": [...],
     *   "overview": [...],
     *   "metrics": [...],
     *   "harmony": {...},
     *   "angularity": {...},
     *   "symmetry": {...},
     *   "dimorphism": {...},
     *   "health": {...}
     * }
     *
     * Gemini может использоваться backend'ом
     * для qualitative notes.
     *
     * Gemini НЕ должен создавать или менять score.
     */


    const form =
      new FormData();


    form.append(
      "image",
      file,
      file.name
    );


    const response =
      await fetch(
        "/api/analyze",
        {
          method: "POST",
          body: form
        }
      );


    if (!response.ok) {
      let message =
        "Ошибка анализа.";


      try {
        const data =
          await response.json();

        if (data?.error) {
          message =
            String(data.error);
        }
      } catch {
        /*
         * Ответ не JSON.
         */
      }


      throw new Error(message);
    }


    let data;


    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Сервер вернул невалидный JSON."
      );
    }


    return data;
  }


  /* =========================================================
     VALIDATE RESULT
  ========================================================== */

  function validateResult(data) {
    if (
      !data ||
      typeof data !== "object"
    ) {
      throw new Error(
        "Сервер вернул некорректный результат."
      );
    }


    if (
      typeof data.score !== "number" ||
      !Number.isFinite(data.score)
    ) {
      throw new Error(
        "Числовой score не получен из измерений."
      );
    }


    if (
      data.score < 0 ||
      data.score > 100
    ) {
      throw new Error(
        "Score должен находиться в диапазоне 0–100."
      );
    }
  }


  /* =========================================================
     FINISH ANALYSIS
  ========================================================== */

  async function finishAnalysis(result) {
    analysisState.textContent =
      "COMPLETE";


    analysisState.classList.add(
      "complete"
    );


    previewProcessing.style.display =
      "none";


    const landmarks =
      normalizeLandmarks(
        result.landmarks
      );


    state.lastLandmarks =
      landmarks;


    landmarkCount.textContent =
      String(landmarks.length);


    axisStatus.textContent =
      landmarks.length
        ? "READY"
        : "—";


    drawLandmarks(
      landmarks
    );


    if (landmarks.length) {
      faceGuide.classList.add(
        "visible"
      );
    }


    /*
     * Score сначала появляется
     * прямо поверх изображения.
     */

    await delay(300);


    await animateScoreOnImage(
      result.score
    );


    /*
     * Затем score перемещается
     * в нижний левый угол.
     */

    await delay(650);


    analysisScore.classList.add(
      "float"
    );


    await delay(950);


    renderResult(result);


    showScreen("result");


    state.analysisRunning =
      false;
  }


  /* =========================================================
     SCORE ANIMATION
  ========================================================== */

  async function animateScoreOnImage(
    targetScore
  ) {
    analysisScore.classList.add(
      "show"
    );


    await animateNumber(
      analysisScoreValue,
      0,
      targetScore,
      850
    );
  }


  async function animateNumber(
    element,
    from,
    to,
    duration
  ) {
    if (!element) {
      return;
    }


    const start =
      performance.now();


    return new Promise(resolve => {
      function frame(now) {
        const elapsed =
          now - start;


        const progress =
          clamp(
            elapsed / duration,
            0,
            1
          );


        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          );


        const value =
          from +
          (to - from) * eased;


        element.textContent =
          formatNumber(value);


        if (progress < 1) {
          requestAnimationFrame(
            frame
          );
        } else {
          element.textContent =
            formatNumber(to);

          resolve();
        }
      }


      requestAnimationFrame(
        frame
      );
    });
  }


  /* =========================================================
     RESULT RENDER
  ========================================================== */

  function renderResult(result) {
    const score =
      clamp(
        result.score,
        0,
        100
      );


    resultScore.textContent =
      "0";


    scoreProgress.style.width =
      "0%";


    scoreStatus.textContent =
      getScoreStatus(score);


    scoreDataStatus.textContent =
      "VERIFIED";


    const landmarks =
      normalizeLandmarks(
        result.landmarks
      );


    resultLandmarkCount.textContent =
      landmarks.length
        ? String(landmarks.length)
        : "—";


    requestAnimationFrame(() => {
      requestAnimationFrame(() => {

        animateNumber(
          resultScore,
          0,
          score,
          1000
        );


        scoreProgress.style.width =
          `${score}%`;
      });
    });


    renderStats(
      result.stats || []
    );


    renderOverview(
      result.overview || []
    );


    renderGroup(
      $("#harmony-content"),
      result.harmony
    );


    renderMetrics(
      result.metrics || []
    );


    renderGroup(
      $("#angularity-content"),
      result.angularity
    );


    renderGroup(
      $("#symmetry-content"),
      result.symmetry
    );


    renderGroup(
      $("#dimorphism-content"),
      result.dimorphism
    );


    renderHealth(
      result.health
    );


    bindExpandableCards();


    updateRevealDelays();
  }


  function getScoreStatus(score) {
    if (score >= 80) {
      return "Высокий измеренный результат";
    }


    if (score >= 60) {
      return "Средний измеренный результат";
    }


    if (score >= 40) {
      return "Ниже среднего по выбранной шкале";
    }


    return "Низкий измеренный результат";
  }


  /* =========================================================
     STATS
  ========================================================== */

  function renderStats(stats) {
    const container =
      $("#stats-grid");


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    const normalized =
      Array.isArray(stats)
        ? stats.slice(0, 4)
        : [];


    if (!normalized.length) {
      container.innerHTML =
        createEmptyCard(
          "Нет быстрых показателей."
        );

      return;
    }


    normalized.forEach(
      (stat, index) => {
        const element =
          document.createElement("div");


        element.className =
          "stat";


        element.style.setProperty(
          "--reveal-delay",
          `${index * 50}ms`
        );


        element.classList.add(
          "reveal"
        );


        element.innerHTML = `
          <span>
            ${escapeHtml(
              stat.label || ""
            )}
          </span>

          <strong>
            ${escapeHtml(
              formatValue(
                stat.value
              )
            )}
          </strong>

          <small>
            ${escapeHtml(
              stat.unit || ""
            )}
          </small>
        `;


        container.appendChild(
          element
        );
      }
    );
  }


  /* =========================================================
     OVERVIEW
  ========================================================== */

  function renderOverview(items) {
    const container =
      $("#overview-grid");


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    const normalized =
      Array.isArray(items)
        ? items
        : [];


    if (!normalized.length) {
      container.innerHTML =
        createEmptyCard(
          "Обзор пока не содержит измерений."
        );

      return;
    }


    normalized.forEach(
      (item, index) => {
        const element =
          document.createElement("div");


        element.className =
          "overview-card";


        element.style.setProperty(
          "--reveal-delay",
          `${index * 45}ms`
        );


        element.classList.add(
          "reveal"
        );


        element.innerHTML = `
          <div class="overview-card__label">
            ${escapeHtml(
              item.label || ""
            )}
          </div>

          <div class="overview-card__value">
            ${escapeHtml(
              formatValue(
                item.value
              )
            )}
          </div>

          <div class="overview-card__source">
            ${escapeHtml(
              item.source ||
              "measured"
            )}
          </div>
        `;


        container.appendChild(
          element
        );
      }
    );
  }


  /* =========================================================
     METRICS
  ========================================================== */

  function renderMetrics(metrics) {
    const container =
      $("#metrics-content");


    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    const normalized =
      Array.isArray(metrics)
        ? metrics
        : [];


    if (!normalized.length) {
      container.innerHTML =
        createEmptyCard(
          "Измеренные черты пока не переданы."
        );

      return;
    }


    normalized.forEach(
      (metric, index) => {
        const card =
          document.createElement("article");


        card.className =
          "metric-card";


        card.innerHTML = `
          <button
            class="metric-header"
            type="button"
            aria-expanded="false"
          >

            <div class="metric-main">

              <div class="metric-name">
                ${escapeHtml(
                  metric.name || ""
                )}
              </div>

              <div class="metric-key">
                ${escapeHtml(
                  metric.key || ""
                )}
              </div>

            </div>


            <div class="metric-value">
              ${escapeHtml(
                formatValue(
                  metric.value
                )
              )}
            </div>


            <div class="metric-arrow">
              +
            </div>

          </button>


          <div class="metric-content">

            <div>

              <div class="metric-detail">

                <span>
                  Источник
                </span>

                <strong>
                  ${escapeHtml(
                    metric.source ||
                    "measured"
                  )}
                </strong>

              </div>


              ${
                metric.description
                  ? `
                    <div class="metric-detail">

                      <span>
                        Описание
                      </span>

                      <strong>
                        ${escapeHtml(
                          metric.description
                        )}
                      </strong>

                    </div>
                  `
                  : ""
              }


              ${renderMetricIndicator(
                metric
              )}

            </div>

          </div>
        `;


        card.style.setProperty(
          "--reveal-delay",
          `${index * 35}ms`
        );


        card.classList.add(
          "reveal"
        );


        container.appendChild(
          card
        );
      }
    );
  }


  function renderMetricIndicator(metric) {
    const raw =
      metric.normalized ??
      metric.score ??
      metric.percent;


    if (
      typeof raw !== "number" ||
      !Number.isFinite(raw)
    ) {
      return "";
    }


    const value =
      clamp(
        raw,
        0,
        100
      );


    const tone =
      metric.tone ||
      getToneFromValue(value);


    return `
      <div class="metric-indicator">

        <div class="metric-indicator__track">

          <div
            class="metric-indicator__bar ${escapeHtml(
              tone
            )}"
            style="width:${value}%"
          ></div>

        </div>

        <span class="metric-indicator__value">
          ${formatNumber(value)}
        </span>

      </div>
    `;
  }


  function getToneFromValue(value) {
    if (value >= 70) {
      return "positive";
    }


    if (value < 40) {
      return "negative";
    }


    return "neutral";
  }


  /* =========================================================
     GROUP RENDERER
  ========================================================== */

  function renderGroup(
    container,
    data
  ) {
    if (!container) {
      return;
    }


    container.innerHTML =
      "";


    if (!data) {
      container.innerHTML =
        createEmptyCard(
          "Нет данных."
        );

      return;
    }


    const groups =
      normalizeGroups(data);


    if (!groups.length) {
      container.innerHTML =
        createEmptyCard(
          "Нет измерений в этом разделе."
        );

      return;
    }


    groups.forEach(
      (group, groupIndex) => {
        const values =
          normalizeGroupValues(
            group.values
          );


        const element =
          document.createElement("article");


        element.className =
          "feature-group";


        element.innerHTML = `
          <button
            class="feature-group__header"
            type="button"
            aria-expanded="false"
          >

            <span class="feature-group__title">
              ${escapeHtml(
                group.title || ""
              )}
            </span>

            <span class="feature-group__count">
              ${values.length}
            </span>

            <span class="feature-group__arrow">
              +
            </span>

          </button>


          <div class="feature-list">

            <div>

              <div class="feature-list-inner">

                ${
                  values.length
                    ? values
                        .map(
                          (
                            item,
                            itemIndex
                          ) => `
                            <div
                              class="feature-row"
                              style="--reveal-delay:${
                                itemIndex * 25
                              }ms"
                            >

                              <span
                                class="feature-row__name"
                              >
                                ${escapeHtml(
                                  item.name ||
                                  item.label ||
                                  ""
                                )}
                              </span>

                              <span
                                class="feature-row__value"
                              >
                                ${escapeHtml(
                                  formatValue(
                                    item.value
                                  )
                                )}
                              </span>

                            </div>
                          `
                        )
                        .join("")
                    : `
                      <div class="feature-row">
                        <span class="feature-row__name">
                          Нет данных
                        </span>

                        <span class="feature-row__value">
                          —
                        </span>
                      </div>
                    `
                }

              </div>

            </div>

          </div>
        `;


        element.style.setProperty(
          "--reveal-delay",
          `${groupIndex * 40}ms`
        );


        element.classList.add(
          "reveal"
        );


        container.appendChild(
          element
        );
      }
    );
  }


  function normalizeGroups(data) {
    if (Array.isArray(data)) {
      return data.map(
        group => ({
          title:
            group.title ||
            group.name ||
            group.label ||
            "Раздел",

          values:
            group.values ??
            group.items ??
            []
        })
      );
    }


    if (
      typeof data === "object" &&
      data !== null
    ) {
      return Object.entries(
        data
      ).map(
        ([title, values]) => ({
          title,
          values
        })
      );
    }


    return [];
  }


  function normalizeGroupValues(
    values
  ) {
    if (Array.isArray(values)) {
      return values;
    }


    if (
      typeof values === "object" &&
      values !== null
    ) {
      return Object.entries(
        values
      ).map(
        ([name, value]) => ({
          name,
          value
        })
      );
    }


    return [];
  }


  /* =========================================================
     HEALTH
  ========================================================== */

  function renderHealth(data) {
    const container =
      $("#health-content");


    if (!container) {
      return;
    }


    if (!data) {
      container.innerHTML = `
        <div class="note-icon">
          i
        </div>

        <p>
          Нет дополнительных визуальных наблюдений.
        </p>
      `;

      return;
    }


    const text =
      typeof data === "string"
        ? data
        : data.note ||
          data.description ||
          data.text;


    if (!text) {
      container.innerHTML = `
        <div class="note-icon">
          i
        </div>

        <p>
          Нет дополнительных визуальных наблюдений.
        </p>
      `;

      return;
    }


    container.innerHTML = `
      <div class="note-icon">
        i
      </div>

      <p>
        ${escapeHtml(text)}
      </p>
    `;
  }


  /* =========================================================
     TABS
  ========================================================== */

  function bindTabs() {
    $$(".tab").forEach(
      tab => {
        tab.addEventListener(
          "click",
          () => {
            activateTab(
              tab.dataset.tab
            );
          }
        );
      }
    );
  }


  function activateTab(target) {
    if (!target) {
      return;
    }


    $$(".tab").forEach(tab => {
      const active =
        tab.dataset.tab === target;


      tab.classList.toggle(
        "active",
        active
      );


      tab.setAttribute(
        "aria-selected",
        String(active)
      );
    });


    $$(".tab-panel").forEach(
      panel => {
        panel.classList.toggle(
          "active",
          panel.dataset.panel === target
        );
      }
    );
  }


  /* =========================================================
     EXPANDABLE CARDS
  ========================================================== */

  function bindExpandableDelegation() {
    document.addEventListener(
      "click",
      event => {
        const metricButton =
          event.target.closest(
            ".metric-header"
          );


        if (metricButton) {
          toggleExpandable(
            metricButton,
            ".metric-card"
          );

          return;
        }


        const featureButton =
          event.target.closest(
            ".feature-group__header"
          );


        if (featureButton) {
          toggleExpandable(
            featureButton,
            ".feature-group"
          );
        }
      }
    );
  }


  function bindExpandableCards() {
    /*
     * Делегирование кликов уже установлено.
     *
     * Здесь intentionally ничего не добавляется повторно,
     * чтобы после каждого нового render не возникали
     * duplicate event listeners.
     */
  }


  function toggleExpandable(
    button,
    cardSelector
  ) {
    const card =
      button.closest(
        cardSelector
      );


    if (!card) {
      return;
    }


    const open =
      card.classList.toggle(
        "open"
      );


    button.setAttribute(
      "aria-expanded",
      String(open)
    );
  }


  /* =========================================================
     LANDMARK NORMALIZATION
  ========================================================== */

  function normalizeLandmarks(
    landmarks
  ) {
    if (!Array.isArray(landmarks)) {
      return [];
    }


    return landmarks
      .map(point => {
        if (
          Array.isArray(point) &&
          point.length >= 2
        ) {
          return {
            x: Number(point[0]),
            y: Number(point[1]),
            name:
              point[2] ||
              ""
          };
        }


        if (
          point &&
          typeof point === "object"
        ) {
          return {
            x: Number(point.x),
            y: Number(point.y),
            name:
              point.name ||
              point.label ||
              ""
          };
        }


        return null;
      })
      .filter(
        point =>
          point &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
      )
      .map(point => ({
        ...point,

        x: clamp(
          point.x,
          0,
          1
        ),

        y: clamp(
          point.y,
          0,
          1
        )
      }));
  }


  /* =========================================================
     LANDMARK DRAWING
  ========================================================== */

  function resizeCanvas() {
    if (
      !analysisImage ||
      !canvas ||
      !ctx
    ) {
      return;
    }


    const rect =
      analysisImage.getBoundingClientRect();


    if (
      !rect.width ||
      !rect.height
    ) {
      return;
    }


    const ratio =
      window.devicePixelRatio ||
      1;


    canvas.width =
      Math.round(
        rect.width * ratio
      );


    canvas.height =
      Math.round(
        rect.height * ratio
      );


    canvas.style.width =
      `${rect.width}px`;


    canvas.style.height =
      `${rect.height}px`;


    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );


    state.canvasScale =
      ratio;


    if (
      state.analysisRunning &&
      !state.lastLandmarks.length
    ) {
      drawScanningLandmarks();

      return;
    }


    if (
      state.lastLandmarks.length
    ) {
      drawLandmarks(
        state.lastLandmarks
      );
    }
  }


  function clearCanvas() {
    if (
      !ctx ||
      !canvas
    ) {
      return;
    }


    ctx.clearRect(
      0,
      0,
      canvas.clientWidth,
      canvas.clientHeight
    );
  }


  function drawScanningLandmarks() {
    if (
      !ctx ||
      !canvas
    ) {
      return;
    }


    clearCanvas();


    const width =
      canvas.clientWidth;

    const height =
      canvas.clientHeight;


    if (
      !width ||
      !height
    ) {
      return;
    }


    /*
     * Это НЕ выдаётся за реальные landmarks.
     *
     * Во время ожидания backend здесь показывается
     * только визуальная scanning animation.
     *
     * Реальные landmarks рисуются после ответа сервера.
     */


    const points = [
      [.50, .18],
      [.42, .27],
      [.58, .27],
      [.38, .37],
      [.62, .37],
      [.50, .42],
      [.44, .52],
      [.56, .52],
      [.39, .62],
      [.61, .62],
      [.50, .70]
    ];


    ctx.save();


    ctx.strokeStyle =
      "rgba(255,255,255,.18)";

    ctx.lineWidth =
      1;


    ctx.setLineDash([
      3,
      6
    ]);


    ctx.beginPath();


    points.forEach(
      ([x, y], index) => {
        const px =
          x * width;

        const py =
          y * height;


        if (index === 0) {
          ctx.moveTo(
            px,
            py
          );
        } else {
          ctx.lineTo(
            px,
            py
          );
        }
      }
    );


    ctx.stroke();


    ctx.setLineDash([]);


    points.forEach(
      ([x, y]) => {
        ctx.beginPath();


        ctx.arc(
          x * width,
          y * height,
          2,
          0,
          Math.PI * 2
        );


        ctx.fillStyle =
          "rgba(255,255,255,.6)";


        ctx.fill();
      }
    );


    ctx.restore();
  }


  function drawLandmarks(points) {
    if (
      !ctx ||
      !canvas
    ) {
      return;
    }


    clearCanvas();


    if (!points?.length) {
      return;
    }


    const width =
      canvas.clientWidth;

    const height =
      canvas.clientHeight;


    if (
      !width ||
      !height
    ) {
      return;
    }


    ctx.save();


    /*
     * Face mesh:
     *
     * Соединяем landmarks в разумную
     * визуальную сеть, но не предполагаем
     * конкретную topology модели.
     */


    const meshLines =
      buildMeshLines(points);


    ctx.lineWidth =
      .65;

    ctx.strokeStyle =
      "rgba(255,255,255,.18)";


    meshLines.forEach(
      ([a, b]) => {
        const p1 =
          points[a];

        const p2 =
          points[b];


        if (!p1 || !p2) {
          return;
        }


        ctx.beginPath();


        ctx.moveTo(
          p1.x * width,
          p1.y * height
        );


        ctx.lineTo(
          p2.x * width,
          p2.y * height
        );


        ctx.stroke();
      }
    );


    /*
     * Central axis.
     */

    const centerX =
      calculateCenterAxis(points);


    if (
      Number.isFinite(centerX)
    ) {
      ctx.save();


      ctx.strokeStyle =
        "rgba(255,255,255,.32)";


      ctx.lineWidth =
        .75;


      ctx.setLineDash([
        4,
        7
      ]);


      ctx.beginPath();


      ctx.moveTo(
        centerX * width,
        height * .06
      );


      ctx.lineTo(
        centerX * width,
        height * .94
      );


      ctx.stroke();


      ctx.restore();
    }


    /*
     * Landmark points.
     */

    points.forEach(
      point => {
        const px =
          point.x * width;

        const py =
          point.y * height;


        ctx.beginPath();


        ctx.arc(
          px,
          py,
          2,
          0,
          Math.PI * 2
        );


        ctx.fillStyle =
          "rgba(255,255,255,.92)";


        ctx.shadowColor =
          "rgba(255,255,255,.45)";


        ctx.shadowBlur =
          6;


        ctx.fill();


        ctx.shadowBlur =
          0;
      }
    );


    ctx.restore();
  }


  function buildMeshLines(points) {
    const lines = [];


    /*
     * Nearest-neighbour connections.
     *
     * Это даёт mesh-визуализацию для любого
     * нормализованного массива landmarks,
     * не требуя от frontend знания конкретной
     * модели backend.
     */


    const maxDistance =
      .14;


    for (
      let i = 0;
      i < points.length;
      i++
    ) {
      const current =
        points[i];


      const neighbours =
        [];


      for (
        let j = 0;
        j < points.length;
        j++
      ) {
        if (i === j) {
          continue;
        }


        const candidate =
          points[j];


        const dx =
          candidate.x -
          current.x;


        const dy =
          candidate.y -
          current.y;


        const distance =
          Math.sqrt(
            dx * dx +
            dy * dy
          );


        if (
          distance <= maxDistance
        ) {
          neighbours.push({
            index: j,
            distance
          });
        }
      }


      neighbours
        .sort(
          (a, b) =>
            a.distance -
            b.distance
        )
        .slice(0, 3)
        .forEach(
          neighbour => {
            const a =
              Math.min(
                i,
                neighbour.index
              );

            const b =
              Math.max(
                i,
                neighbour.index
              );


            const exists =
              lines.some(
                ([x, y]) =>
                  x === a &&
                  y === b
              );


            if (!exists) {
              lines.push([
                a,
                b
              ]);
            }
          }
        );
    }


    return lines;
  }


  function calculateCenterAxis(points) {
    if (!points.length) {
      return NaN;
    }


    const values =
      points.map(
        point => point.x
      );


    values.sort(
      (a, b) => a - b
    );


    const middle =
      Math.floor(
        values.length / 2
      );


    if (
      values.length % 2 === 0
    ) {
      return (
        values[middle - 1] +
        values[middle]
      ) / 2;
    }


    return values[middle];
  }


  /* =========================================================
     HISTORY
  ========================================================== */

  function saveHistory(result) {
    if (!state.file) {
      return;
    }


    const history =
      getHistory();


    const entry = {
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      date:
        new Date().toISOString(),

      score:
        result.score,

      fileName:
        state.file.name ||
        "photo",

      landmarkCount:
        normalizeLandmarks(
          result.landmarks
        ).length
    };


    history.unshift(
      entry
    );


    try {
      localStorage.setItem(
        state.historyKey,
        JSON.stringify(
          history.slice(0, 30)
        )
      );
    } catch (error) {
      console.warn(
        "Could not save history:",
        error
      );
    }


    renderHistory();
  }


  function getHistory() {
    try {
      const raw =
        localStorage.getItem(
          state.historyKey
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


  function renderHistory() {
    const history =
      getHistory();


    const count =
      $("#history-count");


    const container =
      $("#history-list");


    if (!count || !container) {
      return;
    }


    count.textContent =
      history.length;


    if (!history.length) {
      container.innerHTML = `
        <div class="history-empty">
          Анализов пока нет.
        </div>
      `;

      return;
    }


    container.innerHTML =
      history
        .map(
          (item, index) => `
            <div
              class="history-item reveal"
              style="--reveal-delay:${
                index * 35
              }ms"
            >

              <div>

                <div class="date">
                  ${formatDate(
                    item.date
                  )}
                </div>

                <div class="meta">
                  ${escapeHtml(
                    item.fileName
                  )}
                  ${
                    Number.isFinite(
                      item.landmarkCount
                    )
                      ? `
                        · ${item.landmarkCount}
                        landmarks
                      `
                      : ""
                  }
                </div>

              </div>

              <div class="score">
                ${formatNumber(
                  item.score
                )}
              </div>

            </div>
          `
        )
        .join("");
  }


  /* =========================================================
     NEW ANALYSIS
  ========================================================== */

  function bindNewAnalysis() {
    const button =
      $("#new-analysis");


    if (!button) {
      return;
    }


    button.addEventListener(
      "click",
      () => {
        if (state.analysisRunning) {
          return;
        }


        if (fileInput) {
          fileInput.value =
            "";
        }


        state.result =
          null;

        state.lastLandmarks =
          [];


        resetResultUI();

        showScreen("home");
      }
    );
  }


  function resetResultUI() {
    if (resultScore) {
      resultScore.textContent =
        "—";
    }


    if (scoreProgress) {
      scoreProgress.style.width =
        "0%";
    }


    if (resultLandmarkCount) {
      resultLandmarkCount.textContent =
        "—";
    }


    if (scoreStatus) {
      scoreStatus.textContent =
        "Измерения получены";
    }
  }


  /* =========================================================
     KEYBOARD
  ========================================================== */

  function bindKeyboardShortcuts() {
    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape" &&
          state.analysisRunning
        ) {
          /*
           * Не отменяем backend fetch.
           * Escape здесь только не должен
           * ломать текущий процесс.
           */
          return;
        }
      }
    );
  }


  /* =========================================================
     RESIZE
  ========================================================== */

  function handleResize() {
    resizeCanvas();
  }


  /* =========================================================
     IMAGE WAIT
  ========================================================== */

  async function waitForImageReady() {
    if (
      analysisImage.complete &&
      analysisImage.naturalWidth
    ) {
      resizeCanvas();

      return;
    }


    await new Promise(
      (resolve, reject) => {
        const timeout =
          setTimeout(
            () => {
              reject(
                new Error(
                  "Изображение не удалось подготовить."
                )
              );
            },
            10000
          );


        analysisImage.addEventListener(
          "load",
          () => {
            clearTimeout(
              timeout
            );

            resolve();
          },
          {
            once: true
          }
        );


        analysisImage.addEventListener(
          "error",
          () => {
            clearTimeout(
              timeout
            );

            reject(
              new Error(
                "Не удалось загрузить изображение."
              )
            );
          },
          {
            once: true
          }
        );
      }
    );
  }


  /* =========================================================
     HELPERS
  ========================================================== */

  function formatNumber(value) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return "—";
    }


    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
  }


  function formatValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }


    if (
      typeof value === "number"
    ) {
      return formatNumber(value);
    }


    if (
      typeof value === "boolean"
    ) {
      return value
        ? "Да"
        : "Нет";
    }


    return String(value);
  }


  function formatDate(date) {
    const parsed =
      new Date(date);


    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "—";
    }


    return new Intl.DateTimeFormat(
      "ru-RU",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(parsed);
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


  function delay(ms) {
    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          ms
        )
    );
  }


  function notify(message) {
    if (!toast) {
      return;
    }


    toast.textContent =
      String(message);


    toast.classList.add(
      "show"
    );


    clearTimeout(
      notify.timer
    );


    notify.timer =
      setTimeout(
        () => {
          toast.classList.remove(
            "show"
          );
        },
        3000
      );
  }


  function emptyMessage(text) {
    return `
      <div class="history-empty">
        ${escapeHtml(text)}
      </div>
    `;
  }


  function createEmptyCard(text) {
    return `
      <div class="history-empty">
        ${escapeHtml(text)}
      </div>
    `;
  }


  function escapeHtml(value) {
    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }


  function updateRevealDelays() {
    $$(".reveal").forEach(
      (element, index) => {
        if (
          !element.style.getPropertyValue(
            "--reveal-delay"
          )
        ) {
          element.style.setProperty(
            "--reveal-delay",
            `${Math.min(index * 45, 450)}ms`
          );
        }
      }
    );
  }


  /* =========================================================
     CLEANUP
  ========================================================== */

  function clearAnalysisAnimation() {
    state.animationTimers.forEach(
      timer => {
        clearTimeout(timer);
      }
    );


    state.animationTimers =
      [];


    if (state.analysisTimer) {
      clearTimeout(
        state.analysisTimer
      );

      state.analysisTimer =
        null;
    }
  }


  function revokeObjectUrl() {
    if (!state.objectUrl) {
      return;
    }


    URL.revokeObjectURL(
      state.objectUrl
    );


    state.objectUrl =
      null;
  }


  function cleanupObjectUrl() {
    revokeObjectUrl();
  }

})();(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const state = {
    file: null,
    objectUrl: null,
    result: null,
    analysisTimer: null
  };

  const screens = {
    home: $("#screen-home"),
    analysis: $("#screen-analysis"),
    result: $("#screen-result"),
    history: $("#screen-history"),
    about: $("#screen-about")
  };

  const fileInput = $("#file-input");
  const uploadBtn = $("#upload-btn");
  const uploadName = $("#upload-name");

  const analysisImage = $("#analysis-image");
  const canvas = $("#landmark-canvas");
  const ctx = canvas.getContext("2d");

  const loadingTitle = $("#loading-title");
  const loadingText = $("#loading-text");
  const analysisState = $("#analysis-state");

  const analysisScore = $("#analysis-score");
  const analysisScoreValue =
    $("#analysis-score strong");

  const resultScore = $("#result-score");
  const scoreProgress = $("#score-progress");

  const toast = $("#toast");

  /* ---------------- NAVIGATION ---------------- */

  function showScreen(name) {
    const target = screens[name];

    if (!target) return;

    Object.values(screens).forEach(screen => {
      screen.classList.remove("active", "screen-enter");
    });

    target.classList.add("active");

    requestAnimationFrame(() => {
      target.classList.add("screen-enter");
    });

    $$(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.screen === name
      );
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  $$("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
      showScreen(button.dataset.screen);
    });
  });

  /* ---------------- UPLOAD ---------------- */

  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("Выбери изображение.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      notify("Файл слишком большой. Максимум 15 MB.");
      return;
    }

    startAnalysis(file);
  });

  function setPreview(file) {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }

    state.objectUrl = URL.createObjectURL(file);

    analysisImage.src = state.objectUrl;

    analysisImage.onload = () => {
      resizeCanvas();
      drawScanningLandmarks();
    };
  }

  /* ---------------- ANALYSIS ---------------- */

  async function startAnalysis(file) {
    state.file = file;
    state.result = null;

    uploadName.textContent = file.name;

    setPreview(file);

    resetAnalysisUI();

    showScreen("analysis");

    await runLoadingAnimation();

    try {
      const result = await analyzeImage(file);

      state.result = result;

      finishAnalysis(result);
    } catch (error) {
      console.error(error);

      notify(
        error?.message ||
        "Не удалось выполнить анализ."
      );

      showScreen("home");
    }
  }

  function resetAnalysisUI() {
    analysisScore.classList.remove(
      "show",
      "float"
    );

    analysisScoreValue.textContent = "—";

    analysisState.textContent = "ANALYZING";

    loadingTitle.textContent = "Анализируем";
    loadingText.textContent =
      "Подготавливаем изображение";

    $$(".loading-step").forEach((step, index) => {
      step.classList.toggle("active", index === 0);
      step.classList.remove("done");
    });

    clearCanvas();
  }

  async function runLoadingAnimation() {
    const steps = $$(".loading-step");

    const messages = [
      "Подготавливаем изображение",
      "Определяем landmarks",
      "Измеряем пропорции",
      "Сравниваем стороны лица",
      "Собираем результат"
    ];

    for (let i = 0; i < steps.length; i++) {
      loadingText.textContent = messages[i];

      steps.forEach((step, index) => {
        step.classList.toggle(
          "active",
          index === i
        );

        if (index < i) {
          step.classList.add("done");
        }
      });

      await delay(420);
    }

    steps.forEach(step => {
      step.classList.remove("active");
      step.classList.add("done");
    });
  }

  async function analyzeImage(file) {
    /*
     * app.js не придумывает score.
     *
     * Backend должен вернуть реальные измерения.
     * Например:
     *
     * {
     *   score: 78.4,
     *   stats: [...],
     *   overview: [...],
     *   metrics: [...],
     *   harmony: {...},
     *   angularity: {...},
     *   symmetry: {...},
     *   dimorphism: {...},
     *   health: {...},
     *   landmarks: [...]
     * }
     *
     * Gemini может использоваться backend'ом
     * для qualitative notes, но score сюда должен
     * приходить из measurement pipeline.
     */

    const form = new FormData();

    form.append("image", file);

    const response = await fetch(
      "/api/analyze",
      {
        method: "POST",
        body: form
      }
    );

    if (!response.ok) {
      let message = "Ошибка анализа.";

      try {
        const data = await response.json();

        if (data?.error) {
          message = data.error;
        }
      } catch {}

      throw new Error(message);
    }

    const data = await response.json();

    validateResult(data);

    return data;
  }

  function validateResult(data) {
    if (!data || typeof data !== "object") {
      throw new Error(
        "Сервер вернул некорректный результат."
      );
    }

    if (
      typeof data.score !== "number" ||
      !Number.isFinite(data.score)
    ) {
      throw new Error(
        "Числовой score не получен из измерений."
      );
    }
  }

  /* ---------------- RESULT ---------------- */

  function finishAnalysis(result) {
    analysisState.textContent = "COMPLETE";

    analysisScoreValue.textContent =
      formatNumber(result.score);

    analysisScore.classList.add("show");

    drawLandmarks(result.landmarks || []);

    setTimeout(() => {
      analysisScore.classList.add("float");
    }, 950);

    setTimeout(() => {
      renderResult(result);
      showScreen("result");
    }, 1650);
  }

  function renderResult(result) {
    resultScore.textContent =
      formatNumber(result.score);

    requestAnimationFrame(() => {
      scoreProgress.style.width =
        `${clamp(result.score, 0, 100)}%`;
    });

    renderStats(result.stats || []);
    renderOverview(result.overview || []);

    renderGroup(
      $("#harmony-content"),
      result.harmony
    );

    renderMetrics(
      result.metrics || []
    );

    renderGroup(
      $("#angularity-content"),
      result.angularity
    );

    renderGroup(
      $("#symmetry-content"),
      result.symmetry
    );

    renderGroup(
      $("#dimorphism-content"),
      result.dimorphism
    );

    renderHealth(result.health);

    saveHistory(result);

    bindExpandableCards();
  }

  function renderStats(stats) {
    const container = $("#stats-grid");

    container.innerHTML = "";

    stats.slice(0, 4).forEach(stat => {
      const element = document.createElement("div");

      element.className = "stat";

      element.innerHTML = `
        <span>${escapeHtml(stat.label || "")}</span>
        <strong>${escapeHtml(formatValue(stat.value))}</strong>
        <small>${escapeHtml(stat.unit || "")}</small>
      `;

      container.appendChild(element);
    });
  }

  function renderOverview(items) {
    const container = $("#overview-grid");

    container.innerHTML = "";

    items.forEach(item => {
      const element =
        document.createElement("div");

      element.className = "overview-card";

      element.innerHTML = `
        <div class="overview-card__label">
          ${escapeHtml(item.label || "")}
        </div>

        <div class="overview-card__value">
          ${escapeHtml(formatValue(item.value))}
        </div>

        <div class="overview-card__source">
          ${escapeHtml(item.source || "measured")}
        </div>
      `;

      container.appendChild(element);
    });
  }

  function renderMetrics(metrics) {
    const container = $("#metrics-content");

    container.innerHTML = "";

    metrics.forEach(metric => {
      const card =
        document.createElement("article");

      card.className = "metric-card";

      card.innerHTML = `
        <button class="metric-header">
          <div class="metric-main">
            <div class="metric-name">
              ${escapeHtml(metric.name || "")}
            </div>

            <div class="metric-key">
              ${escapeHtml(metric.key || "")}
            </div>
          </div>

          <div class="metric-value">
            ${escapeHtml(formatValue(metric.value))}
          </div>

          <div class="metric-arrow">+</div>
        </button>

        <div class="metric-content">
          <div>
            <div class="metric-detail">
              <span>Источник</span>
              <strong>
                ${escapeHtml(
                  metric.source || "measured"
                )}
              </strong>
            </div>

            ${
              metric.description
                ? `
                  <div class="metric-detail">
                    <span>Описание</span>
                    <strong>
                      ${escapeHtml(metric.description)}
                    </strong>
                  </div>
                `
                : ""
            }
          </div>
        </div>
      `;

      container.appendChild(card);
    });
  }

  function renderGroup(container, data) {
    if (!container) return;

    container.innerHTML = "";

    if (!data) {
      container.innerHTML =
        emptyMessage("Нет данных.");
      return;
    }

    const groups = Array.isArray(data)
      ? data
      : Object.entries(data).map(
          ([title, values]) => ({
            title,
            values
          })
        );

    groups.forEach(group => {
      const values = Array.isArray(group.values)
        ? group.values
        : Object.entries(group.values || {})
            .map(([name, value]) => ({
              name,
              value
            }));

      const element =
        document.createElement("article");

      element.className = "feature-group";

      element.innerHTML = `
        <button class="feature-group__header">
          <span class="feature-group__title">
            ${escapeHtml(group.title || "")}
          </span>

          <span class="feature-group__count">
            ${values.length}
          </span>

          <span class="feature-group__arrow">
            +
          </span>
        </button>

        <div class="feature-list">
          <div>
            <div class="feature-list-inner">
              ${values.map(item => `
                <div class="feature-row">
                  <span class="feature-row__name">
                    ${escapeHtml(item.name || item.label || "")}
                  </span>

                  <span class="feature-row__value">
                    ${escapeHtml(formatValue(item.value))}
                  </span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;

      container.appendChild(element);
    });
  }

  function renderHealth(data) {
    const container = $("#health-content");

    if (!data) {
      return;
    }

    const text =
      typeof data === "string"
        ? data
        : data.note || data.description;

    if (!text) return;

    container.innerHTML = `
      <div class="note-icon">i</div>
      <p>${escapeHtml(text)}</p>
    `;
  }

  /* ---------------- TABS ---------------- */

  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      $$(".tab").forEach(item => {
        item.classList.toggle(
          "active",
          item === tab
        );
      });

      $$(".tab-panel").forEach(panel => {
        panel.classList.toggle(
          "active",
          panel.dataset.panel === target
        );
      });
    });
  });

  /* ---------------- EXPANDABLE ---------------- */

  function bindExpandableCards() {
    $$(".metric-header").forEach(button => {
      button.onclick = () => {
        button
          .closest(".metric-card")
          .classList.toggle("open");
      };
    });

    $$(".feature-group__header").forEach(button => {
      button.onclick = () => {
        button
          .closest(".feature-group")
          .classList.toggle("open");
      };
    });
  }

  /* ---------------- LANDMARKS ---------------- */

  function resizeCanvas() {
    if (!analysisImage.naturalWidth) return;

    const rect =
      analysisImage.getBoundingClientRect();

    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );
  }

  window.addEventListener(
    "resize",
    resizeCanvas
  );

  function clearCanvas() {
    ctx.clearRect(
      0,
      0,
      canvas.clientWidth,
      canvas.clientHeight
    );
  }

  function drawScanningLandmarks() {
    clearCanvas();

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    const points = [
      [.50,.18],
      [.42,.27],
      [.58,.27],
      [.38,.37],
      [.62,.37],
      [.50,.42],
      [.44,.52],
      [.56,.52],
      [.39,.62],
      [.61,.62],
      [.50,.70]
    ];

    ctx.save();

    ctx.strokeStyle =
      "rgba(255,255,255,.22)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    points.forEach(([x,y], index) => {
      const px = x * width;
      const py = y * height;

      if (index === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });

    ctx.stroke();

    points.forEach(([x,y]) => {
      ctx.beginPath();

      ctx.arc(
        x * width,
        y * height,
        2,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(255,255,255,.75)";

      ctx.fill();
    });

    ctx.restore();
  }

  function drawLandmarks(points) {
    clearCanvas();

    if (!points?.length) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.save();

    ctx.fillStyle =
      "rgba(255,255,255,.85)";

    ctx.strokeStyle =
      "rgba(255,255,255,.32)";

    ctx.lineWidth = 1;

    points.forEach(point => {
      const x =
        typeof point.x === "number"
          ? point.x * width
          : point[0] * width;

      const y =
        typeof point.y === "number"
          ? point.y * height
          : point[1] * height;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        2,
        0,
        Math.PI * 2
      );

      ctx.fill();
    });

    ctx.restore();
  }

  /* ---------------- HISTORY ---------------- */

  function saveHistory(result) {
    const history =
      getHistory();

    history.unshift({
      date: new Date().toISOString(),
      score: result.score,
      fileName:
        state.file?.name || "photo"
    });

    localStorage.setItem(
      "facemetric-history",
      JSON.stringify(history.slice(0, 30))
    );
  }

  function getHistory() {
    try {
      return JSON.parse(
        localStorage.getItem(
          "facemetric-history"
        )
      ) || [];
    } catch {
      return [];
    }
  }

  function renderHistory() {
    const history = getHistory();

    $("#history-count").textContent =
      history.length;

    const container = $("#history-list");

    if (!history.length) {
      container.innerHTML = `
        <div class="history-empty">
          Анализов пока нет.
        </div>
      `;

      return;
    }

    container.innerHTML =
      history.map(item => `
        <div class="history-item">
          <div>
            <div class="date">
              ${formatDate(item.date)}
            </div>

            <div class="meta">
              ${escapeHtml(item.fileName)}
            </div>
          </div>

          <div class="score">
            ${formatNumber(item.score)}
          </div>
        </div>
      `).join("");
  }

  /* ---------------- NEW ANALYSIS ---------------- */

  $("#new-analysis").addEventListener(
    "click",
    () => {
      fileInput.value = "";
      state.result = null;

      showScreen("home");
    }
  );

  /* ---------------- HELPERS ---------------- */

  function formatNumber(value) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return "—";
    }

    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
  }

  function formatValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    if (typeof value === "number") {
      return formatNumber(value);
    }

    return String(value);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(
      "ru-RU",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    ).format(new Date(date));
  }

  function clamp(value, min, max) {
    return Math.min(
      max,
      Math.max(min, value)
    );
  }

  function delay(ms) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }

  function notify(message) {
    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(
      notify.timer
    );

    notify.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function emptyMessage(text) {
    return `
      <div class="history-empty">
        ${escapeHtml(text)}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ---------------- INIT ---------------- */

  renderHistory();

  window.addEventListener(
    "beforeunload",
    () => {
      if (state.objectUrl) {
        URL.revokeObjectURL(
          state.objectUrl
        );
      }
    }
  );
})();
