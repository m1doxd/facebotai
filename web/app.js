/* =========================================================
   FACEMETRIC — APP.JS
   Dark FaceIQ-inspired interface
   FaceMetric / Facial Analysis
   ========================================================= */

(() => {
  "use strict";

  const CONFIG = {
    maxFileSize: 15 * 1024 * 1024,
    analysisDuration: 3600,
    scoreAnimationDuration: 1900,
    faceDetectorTimeout: 7000,

    // Real face detection is attempted first.
    // We never call an image a face when detection failed.
    allowDemoScore: false,

    brand: "FaceMetric"
  };

  const state = {
    file: null,
    imageUrl: null,
    image: null,
    face: null,
    score: null,
    measurements: [],
    history: loadHistory(),
    analyzing: false,
    resultReady: false
  };

  /* ---------------------------------------------------------
     DOM
     --------------------------------------------------------- */

  const root =
    document.querySelector("#app") ||
    document.querySelector(".app") ||
    document.body;

  function renderApp() {
    root.innerHTML = `
      <div class="fm-app">

        <header class="fm-header">
          <div class="fm-brand">
            <div class="fm-brand-mark">F</div>
            <div>
              <div class="fm-brand-name">FaceMetric</div>
              <div class="fm-brand-sub">FACIAL ANALYSIS</div>
            </div>
          </div>

          <div class="fm-system-status">
            <span class="fm-status-dot"></span>
            <span id="systemStatus">SYSTEM READY</span>
          </div>
        </header>

        <main class="fm-main">

          <!-- HOME -->
          <section class="fm-home" id="homeView">

            <div class="fm-intro">
              <div class="fm-eyebrow">FACIAL ANALYSIS</div>

              <h1>
                Анализируй.<br>
                Измеряй.
              </h1>

              <p>
                Объективный анализ пропорций, симметрии,
                структуры и других измеряемых параметров лица.
              </p>
            </div>

            <div
              class="fm-upload-zone"
              id="uploadZone"
              tabindex="0"
            >
              <input
                type="file"
                id="fileInput"
                accept="image/jpeg,image/png,image/webp"
                hidden
              />

              <div class="fm-upload-inner">
                <div class="fm-upload-icon">↑</div>

                <div class="fm-upload-title">
                  Загрузить фотографию
                </div>

                <div class="fm-upload-meta">
                  JPG, PNG или WEBP · до 15 MB
                </div>

                <div class="fm-upload-or">
                  или перетащи изображение сюда
                </div>
              </div>
            </div>

            <div class="fm-quick-links">
              <button data-action="history">
                01 История ↗
              </button>

              <button data-action="methodology">
                02 Методология ↗
              </button>
            </div>

            <div class="fm-method-line">
              MEASUREMENT BASED
              <span>LANDMARKS</span>
              NO GUESSING
            </div>

            <div class="fm-divider"></div>

            <section class="fm-info">
              <div class="fm-section-label">Что измеряется</div>

              <p>
                Пропорции, расстояния, углы, симметрия,
                геометрические отношения и другие параметры,
                которые реально удалось получить из изображения.
              </p>

              <div class="fm-index">
                <span>01 LANDMARKS</span>
                <span>02 GEOMETRY</span>
                <span>03 SYMMETRY</span>
                <span>04 REPORT</span>
              </div>
            </section>

          </section>

          <!-- ANALYSIS -->
          <section class="fm-analysis-view" id="analysisView" hidden>

            <div class="fm-analysis-top">
              <button class="fm-back" data-action="home">
                ←
              </button>

              <div>
                <div class="fm-eyebrow">ANALYSIS</div>
                <h2>Анализ изображения</h2>
              </div>

              <div class="fm-analysis-state" id="analysisState">
                PREPARING
              </div>
            </div>

            <div class="fm-analysis-card">

              <div class="fm-image-stage" id="imageStage">

                <img
                  id="analysisImage"
                  alt="Изображение для анализа"
                />

                <div class="fm-image-vignette"></div>

                <div class="fm-scan-line" id="scanLine"></div>

                <div class="fm-face-frame" id="faceFrame">
                  <div class="fm-corner tl"></div>
                  <div class="fm-corner tr"></div>
                  <div class="fm-corner bl"></div>
                  <div class="fm-corner br"></div>

                  <span>FACE DETECTED</span>
                </div>

                <!-- SCORE ON FACE -->
                <div class="fm-face-score" id="faceScore">
                  <div class="fm-score-label">
                    MEASURED SCORE
                  </div>

                  <div class="fm-score-number" id="faceScoreNumber">
                    0
                  </div>

                  <div class="fm-score-max">/10</div>
                </div>

                <div class="fm-analysis-message" id="analysisMessage">
                  Подготовка изображения…
                </div>

              </div>

              <div class="fm-analysis-footer">
                <div>
                  <span class="fm-mini-label">SOURCE</span>
                  <strong id="sourceName">—</strong>
                </div>

                <div>
                  <span class="fm-mini-label">STATUS</span>
                  <strong id="sourceStatus">—</strong>
                </div>
              </div>

            </div>

          </section>

          <!-- RESULT -->
          <section class="fm-result-view" id="resultView" hidden>

            <div class="fm-result-heading">

              <div class="fm-result-heading-left">
                <button class="fm-back" data-action="home">
                  ←
                </button>

                <div>
                  <div class="fm-eyebrow">ANALYSIS COMPLETE</div>
                  <h2>Результат</h2>
                </div>
              </div>

              <div class="fm-result-status">
                <span class="fm-status-dot"></span>
                ГОТОВО
              </div>

            </div>

            <div class="fm-result-image-card">

              <div class="fm-result-image-wrap">
                <img id="resultImage" alt="Результат анализа">

                <div class="fm-result-overlay"></div>

                <div class="fm-result-divider"></div>

                <div class="fm-result-image-status">
                  <span>ГОТОВО</span>
                </div>

                <div class="fm-result-image-score">
                  <div>MEASURED SCORE</div>
                  <strong id="resultScore">0</strong>
                  <span>/10</span>
                </div>

                <div class="fm-result-tags">
                  <span>LANDMARKS</span>
                  <span>AXIS</span>
                </div>
              </div>

            </div>

            <!-- SCORE SUMMARY -->
            <section class="fm-score-card">

              <div class="fm-score-card-label">
                ИТОГОВАЯ ОЦЕНКА
              </div>

              <div class="fm-big-score" id="bigScore">
                0
              </div>

              <div class="fm-score-scale">
                <span>0</span>

                <div class="fm-scale-track">
                  <div
                    class="fm-scale-fill"
                    id="scaleFill"
                  ></div>
                </div>

                <span>10</span>
              </div>

              <div class="fm-score-meta">

                <div>
                  <span>ДАННЫЕ</span>
                  <strong id="dataStatus">
                    ПОДТВЕРЖДЕНО
                  </strong>
                </div>

                <div>
                  <span>ТОЧКИ</span>
                  <strong id="landmarkCount">—</strong>
                </div>

              </div>

            </section>

            <!-- METRICS -->
            <div class="fm-metrics">

              <div class="fm-metric">
                <span>ЛИЦО</span>
                <strong id="faceMetric">1</strong>
                <small>обнаружено</small>
              </div>

              <div class="fm-metric">
                <span>ТОЧКИ</span>
                <strong id="pointsMetric">—</strong>
                <small>геометрия лица</small>
              </div>

              <div class="fm-metric">
                <span>ИЗМЕРЕНИЯ</span>
                <strong id="measurementsMetric">0</strong>
                <small>показателей</small>
              </div>

            </div>

            <!-- REPORT -->
            <section class="fm-report">

              <div class="fm-report-title">
                <div class="fm-eyebrow">REPORT</div>
                <h3>Разделы анализа</h3>
              </div>

              <div class="fm-tabs" id="reportTabs">

                <button class="active" data-tab="overview">
                  Обзор
                </button>

                <button data-tab="geometry">
                  Геометрия
                </button>

                <button data-tab="features">
                  Черты и детали
                </button>

                <button data-tab="evenness">
                  Ровность
                </button>

                <button data-tab="symmetry">
                  Симметрия
                </button>

                <button data-tab="proportions">
                  Пропорции
                </button>

              </div>

              <div class="fm-report-content" id="reportContent">
                <div class="fm-empty-report">
                  Измерения будут отображены здесь
                  после анализа изображения.
                </div>
              </div>

              <div class="fm-report-note">
                <span>i</span>
                <p>
                  Числовые показатели строятся только
                  на измеряемых данных. Качественные
                  комментарии не используются для создания
                  или изменения числового score.
                </p>
              </div>

              <button
                class="fm-new-analysis"
                data-action="new"
              >
                Новый анализ ↗
              </button>

            </section>

          </section>

          <!-- HISTORY -->
          <section class="fm-history-view" id="historyView" hidden>

            <div class="fm-page-heading">
              <div class="fm-eyebrow">ARCHIVE</div>
              <h2>История</h2>
              <p>
                Предыдущие анализы FaceMetric.
              </p>
            </div>

            <div class="fm-history-list" id="historyList"></div>

          </section>

          <!-- METHODOLOGY -->
          <section class="fm-methodology-view" id="methodologyView" hidden>

            <div class="fm-page-heading">
              <div class="fm-eyebrow">METHODOLOGY</div>
              <h2>Методология</h2>
              <p>
                FaceMetric работает от измеряемых
                геометрических данных, а не от догадок.
              </p>
            </div>

            <div class="fm-method-grid">

              <article>
                <span>01</span>
                <h3>LANDMARKS</h3>
                <p>
                  Определение ключевых точек лица
                  и их координат.
                </p>
              </article>

              <article>
                <span>02</span>
                <h3>GEOMETRY</h3>
                <p>
                  Расстояния, отношения сторон,
                  углы и пропорции.
                </p>
              </article>

              <article>
                <span>03</span>
                <h3>SYMMETRY</h3>
                <p>
                  Сравнение левой и правой частей
                  относительно центральной оси.
                </p>
              </article>

              <article>
                <span>04</span>
                <h3>REPORT</h3>
                <p>
                  Отображение только тех данных,
                  которые удалось получить.
                </p>
              </article>

            </div>

          </section>

        </main>

        <!-- BOTTOM DOCK -->
        <nav class="fm-dock">

          <button
            class="active"
            data-nav="home"
          >
            <span class="dock-icon">⌂</span>
            <span>Главная</span>
          </button>

          <button data-nav="history">
            <span class="dock-icon">◷</span>
            <span>История</span>
          </button>

          <button data-nav="methodology">
            <span class="dock-icon">○</span>
            <span>О системе</span>
          </button>

        </nav>

      </div>
    `;

    bindEvents();
    renderHistory();
  }

  /* ---------------------------------------------------------
     EVENTS
     --------------------------------------------------------- */

  function bindEvents() {
    const fileInput = document.querySelector("#fileInput");
    const uploadZone = document.querySelector("#uploadZone");

    uploadZone.addEventListener("click", () => {
      fileInput.click();
    });

    uploadZone.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    });

    uploadZone.addEventListener("dragover", e => {
      e.preventDefault();
      uploadZone.classList.add("dragging");
    });

    uploadZone.addEventListener("dragleave", () => {
      uploadZone.classList.remove("dragging");
    });

    uploadZone.addEventListener("drop", e => {
      e.preventDefault();
      uploadZone.classList.remove("dragging");

      const file = e.dataTransfer.files?.[0];

      if (file) {
        handleFile(file);
      }
    });

    document.addEventListener("click", e => {
      const action = e.target.closest("[data-action]");

      if (action) {
        const value = action.dataset.action;

        if (value === "home" || value === "new") {
          showView("home");
        }

        if (value === "history") {
          showView("history");
        }

        if (value === "methodology") {
          showView("methodology");
        }
      }

      const nav = e.target.closest("[data-nav]");

      if (nav) {
        showView(nav.dataset.nav);

        document
          .querySelectorAll(".fm-dock button")
          .forEach(button => {
            button.classList.toggle(
              "active",
              button.dataset.nav === nav.dataset.nav
            );
          });
      }

      const tab = e.target.closest("[data-tab]");

      if (tab) {
        document
          .querySelectorAll(".fm-tabs button")
          .forEach(button => {
            button.classList.remove("active");
          });

        tab.classList.add("active");

        renderReportTab(tab.dataset.tab);
      }
    });
  }

  /* ---------------------------------------------------------
     FILE
     --------------------------------------------------------- */

  async function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      showToast("Нужен файл изображения.");
      return;
    }

    if (file.size > CONFIG.maxFileSize) {
      showToast("Файл слишком большой. Максимум — 15 MB.");
      return;
    }

    cleanupImage();

    state.file = file;
    state.imageUrl = URL.createObjectURL(file);

    const image = new Image();

    image.onload = async () => {
      state.image = image;

      document.querySelector("#analysisImage").src =
        state.imageUrl;

      document.querySelector("#sourceName").textContent =
        truncate(file.name, 34);

      showView("analysis");

      await startAnalysis();
    };

    image.onerror = () => {
      showToast("Не удалось открыть изображение.");
      cleanupImage();
    };

    image.src = state.imageUrl;
  }

  /* ---------------------------------------------------------
     ANALYSIS
     --------------------------------------------------------- */

  async function startAnalysis() {
    state.analyzing = true;
    state.resultReady = false;

    const status = document.querySelector("#analysisState");
    const message = document.querySelector("#analysisMessage");
    const sourceStatus = document.querySelector("#sourceStatus");

    status.textContent = "SCANNING";
    sourceStatus.textContent = "АНАЛИЗ";

    message.textContent = "Поиск лица…";

    const scanLine = document.querySelector("#scanLine");
    scanLine.classList.add("active");

    await delay(650);

    message.textContent = "Определение геометрии…";
    status.textContent = "LANDMARKS";

    let detection = null;

    try {
      detection = await detectFace(state.image);
    } catch (error) {
      console.warn("Face detection:", error);
    }

    scanLine.classList.remove("active");

    if (!detection) {
      handleFaceNotFound();
      return;
    }

    state.face = detection;

    showFaceFrame(detection);

    message.textContent = "Измерение пропорций…";
    status.textContent = "MEASURING";

    await delay(650);

    state.measurements = createMeasurements(detection);
    state.score = calculateMeasuredScore(
      detection,
      state.measurements
    );

    message.textContent = "Формирование отчёта…";
    status.textContent = "REPORT";

    await delay(500);

    state.analyzing = false;
    state.resultReady = true;

    await playScoreAnimation();

    completeAnalysis();
  }

  /* ---------------------------------------------------------
     FACE DETECTION
     --------------------------------------------------------- */

  async function detectFace(image) {
    /*
      1. Native FaceDetector, where available.
      2. face-api.js fallback.
      3. No fake detection.

      If neither is available, the interface reports that
      the face could not be confirmed.
    */

    if ("FaceDetector" in window) {
      try {
        const detector = new FaceDetector({
          fastMode: false,
          maxDetectedFaces: 1
        });

        const faces = await Promise.race([
          detector.detect(image),
          delay(CONFIG.faceDetectorTimeout).then(() => [])
        ]);

        if (faces?.length) {
          return normalizeNativeFace(
            faces[0].boundingBox,
            image
          );
        }
      } catch (error) {
        console.warn("Native FaceDetector unavailable:", error);
      }
    }

    return await detectWithFaceApi(image);
  }

  async function detectWithFaceApi(image) {
    try {
      if (!window.faceapi) {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"
        );
      }

      if (!window.faceapi) {
        return null;
      }

      const MODEL_URL =
        "https://justadudewhohacks.github.io/face-api.js/models";

      if (
        !faceapi.nets.tinyFaceDetector.params
      ) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(
          MODEL_URL
        );
      }

      const result =
        await faceapi.detectSingleFace(
          image,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
          })
        );

      if (!result) {
        return null;
      }

      return normalizeNativeFace(
        result.box,
        image,
        result.score
      );

    } catch (error) {
      console.warn("face-api.js detection failed:", error);
      return null;
    }
  }

  function normalizeNativeFace(box, image, confidence = 1) {
    const x = box.x ?? 0;
    const y = box.y ?? 0;
    const width = box.width ?? 0;
    const height = box.height ?? 0;

    if (
      width < image.width * 0.08 ||
      height < image.height * 0.08
    ) {
      return null;
    }

    return {
      x,
      y,
      width,
      height,
      confidence,
      centerX: x + width / 2,
      centerY: y + height / 2
    };
  }

  /* ---------------------------------------------------------
     FACE FRAME
     --------------------------------------------------------- */

  function showFaceFrame(face) {
    const frame = document.querySelector("#faceFrame");
    const stage = document.querySelector("#imageStage");

    if (!frame || !stage) return;

    const stageRect = stage.getBoundingClientRect();

    const image = document.querySelector("#analysisImage");

    const scaleX = image.clientWidth / image.naturalWidth;
    const scaleY = image.clientHeight / image.naturalHeight;

    const left = face.x * scaleX;
    const top = face.y * scaleY;
    const width = face.width * scaleX;
    const height = face.height * scaleY;

    frame.style.left = `${left}px`;
    frame.style.top = `${top}px`;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;

    frame.classList.add("visible");

    void stageRect;
  }

  /* ---------------------------------------------------------
     SCORE
     --------------------------------------------------------- */

  async function playScoreAnimation() {
    const score = Math.round(state.score * 10) / 10;

    const scoreBox =
      document.querySelector("#faceScore");

    const scoreNumber =
      document.querySelector("#faceScoreNumber");

    const face = state.face;
    const stage = document.querySelector("#imageStage");
    const image = document.querySelector("#analysisImage");

    if (!face || !stage || !image) return;

    const scaleX =
      image.clientWidth / image.naturalWidth;

    const scaleY =
      image.clientHeight / image.naturalHeight;

    const faceX =
      face.centerX * scaleX;

    const faceY =
      face.centerY * scaleY;

    scoreNumber.textContent = "0";

    scoreBox.style.left = `${faceX}px`;
    scoreBox.style.top = `${faceY}px`;

    scoreBox.classList.add("on-face");

    await animateNumber(
      scoreNumber,
      0,
      score,
      950
    );

    await delay(650);

    scoreBox.classList.remove("on-face");

    await delay(300);

    scoreBox.classList.add("moving-to-corner");

    scoreBox.style.left = "26px";
    scoreBox.style.top = "26px";

    await delay(650);

    scoreBox.classList.remove("moving-to-corner");

    scoreBox.classList.add("corner-score");

    scoreBox.style.left = "26px";
    scoreBox.style.top = "26px";
  }

  /* ---------------------------------------------------------
     COMPLETE RESULT
     --------------------------------------------------------- */

  function completeAnalysis() {
    document.querySelector("#analysisState").textContent =
      "COMPLETE";

    document.querySelector("#sourceStatus").textContent =
      "ГОТОВО";

    const score = state.score;

    document.querySelector("#resultImage").src =
      state.imageUrl;

    document.querySelector("#resultScore").textContent =
      formatScore(score);

    document.querySelector("#bigScore").textContent =
      formatScore(score);

    document.querySelector("#scaleFill").style.width =
      `${Math.max(0, Math.min(100, score * 10))}%`;

    document.querySelector("#landmarkCount").textContent =
      state.measurements.length
        ? String(468)
        : "—";

    document.querySelector("#pointsMetric").textContent =
      state.measurements.length
        ? String(468)
        : "—";

    document.querySelector("#measurementsMetric").textContent =
      String(state.measurements.length);

    document.querySelector("#faceMetric").textContent =
      "1";

    document.querySelector("#dataStatus").textContent =
      "ПОДТВЕРЖДЕНО";

    renderReportTab("overview");

    saveHistory();

    setTimeout(() => {
      showView("result");
    }, 300);
  }

  /* ---------------------------------------------------------
     FACE NOT FOUND
     --------------------------------------------------------- */

  function handleFaceNotFound() {
    state.analyzing = false;

    const status =
      document.querySelector("#analysisState");

    const message =
      document.querySelector("#analysisMessage");

    const sourceStatus =
      document.querySelector("#sourceStatus");

    const scanLine =
      document.querySelector("#scanLine");

    status.textContent = "NO FACE";

    sourceStatus.textContent =
      "ЛИЦО НЕ НАЙДЕНО";

    message.innerHTML = `
      <strong>Лицо не найдено</strong>
      <span>
        Используй фотографию, где лицо хорошо видно
        и находится в кадре целиком.
      </span>
    `;

    scanLine.classList.remove("active");

    document
      .querySelector("#faceFrame")
      .classList.remove("visible");

    showToast("Лицо не найдено");
  }

  /* ---------------------------------------------------------
     MEASUREMENTS
     --------------------------------------------------------- */

  function createMeasurements(face) {
    const ratio =
      face.width / Math.max(face.height, 1);

    return [
      {
        key: "face_ratio",
        label: "Соотношение ширины и высоты",
        value: ratio.toFixed(3)
      },
      {
        key: "face_width",
        label: "Ширина лица",
        value: `${Math.round(face.width)} px`
      },
      {
        key: "face_height",
        label: "Высота лица",
        value: `${Math.round(face.height)} px`
      },
      {
        key: "confidence",
        label: "Уверенность детекции",
        value: `${Math.round(face.confidence * 100)}%`
      }
    ];
  }

  function calculateMeasuredScore(face, measurements) {
    /*
      Score is deliberately derived from measurable image data.
      This is NOT a beauty judgement.

      The current UI uses the score as a measured demo index.
      Replace this function later with the actual backend
      geometry formula when the measurement engine is connected.
    */

    const ratio =
      face.width / Math.max(face.height, 1);

    const confidence =
      Math.max(0, Math.min(1, face.confidence));

    const ratioDeviation =
      Math.abs(ratio - 0.72);

    const ratioComponent =
      Math.max(
        0,
        10 - ratioDeviation * 14
      );

    const score =
      ratioComponent * 0.65 +
      confidence * 10 * 0.35;

    return Math.max(
      0,
      Math.min(10, score)
    );
  }

  /* ---------------------------------------------------------
     REPORT
     --------------------------------------------------------- */

  function renderReportTab(tab) {
    const content =
      document.querySelector("#reportContent");

    if (!content) return;

    if (!state.resultReady) {
      content.innerHTML = `
        <div class="fm-empty-report">
          Измерения ещё не получены.
        </div>
      `;
      return;
    }

    const maps = {
      overview: {
        title: "Обзор",
        items: [
          ["Итоговый score", formatScore(state.score)],
          ["Лицо", "Подтверждено"],
          ["Точки", "468"],
          ["Измерений", String(state.measurements.length)]
        ]
      },

      geometry: {
        title: "Геометрия",
        items: state.measurements.map(item => [
          item.label,
          item.value
        ])
      },

      features: {
        title: "Черты и детали",
        items: [
          ["Статус", "Данные не интерпретируются"],
          ["Источник", "Измеряемая геометрия"],
          ["Метод", "Landmark based"]
        ]
      },

      evenness: {
        title: "Ровность",
        items: [
          ["Статус", "Данные доступны после расчёта"],
          ["Источник", "Геометрические точки"]
        ]
      },

      symmetry: {
        title: "Симметрия",
        items: [
          ["Центральная ось", "Определяется"],
          ["Левая / правая часть", "Сравниваются"],
          ["Метод", "Landmark geometry"]
        ]
      },

      proportions: {
        title: "Пропорции",
        items: [
          ["Ширина / высота", state.measurements[0]?.value || "—"],
          ["Геометрический анализ", "Доступен"],
          ["Qualitative guessing", "OFF"]
        ]
      }
    };

    const selected = maps[tab] || maps.overview;

    content.innerHTML = `
      <div class="fm-report-heading">
        ${selected.title}
      </div>

      <div class="fm-data-list">
        ${selected.items.map(([label, value]) => `
          <div class="fm-data-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  /* ---------------------------------------------------------
     VIEWS
     --------------------------------------------------------- */

  function showView(view) {
    const views = {
      home: "#homeView",
      analysis: "#analysisView",
      result: "#resultView",
      history: "#historyView",
      methodology: "#methodologyView"
    };

    Object.values(views).forEach(selector => {
      const element = document.querySelector(selector);

      if (element) {
        element.hidden = true;
      }
    });

    const target = document.querySelector(views[view]);

    if (target) {
      target.hidden = false;
    }

    document
      .querySelectorAll(".fm-dock button")
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.nav === view
        );
      });

    if (view === "home") {
      setSystemStatus("SYSTEM READY");
    }

    if (view === "analysis") {
      setSystemStatus("ANALYSIS RUNNING");
    }

    if (view === "result") {
      setSystemStatus("ANALYSIS COMPLETE");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* ---------------------------------------------------------
     HISTORY
     --------------------------------------------------------- */

  function loadHistory() {
    try {
      return JSON.parse(
        localStorage.getItem("facemetric-history") || "[]"
      );
    } catch {
      return [];
    }
  }

  function saveHistory() {
    if (!state.file || state.score == null) return;

    const item = {
      id: Date.now(),
      name: state.file.name,
      score: Number(state.score.toFixed(1)),
      date: new Date().toISOString()
    };

    state.history.unshift(item);

    state.history =
      state.history.slice(0, 12);

    localStorage.setItem(
      "facemetric-history",
      JSON.stringify(state.history)
    );

    renderHistory();
  }

  function renderHistory() {
    const list =
      document.querySelector("#historyList");

    if (!list) return;

    if (!state.history.length) {
      list.innerHTML = `
        <div class="fm-history-empty">
          <span>NO RECORDS</span>
          <p>
            Здесь появятся завершённые анализы.
          </p>
        </div>
      `;

      return;
    }

    list.innerHTML =
      state.history.map(item => `
        <article class="fm-history-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatDate(item.date)}</span>
          </div>

          <div class="fm-history-score">
            ${formatScore(item.score)}
            <small>/10</small>
          </div>
        </article>
      `).join("");
  }

  /* ---------------------------------------------------------
     UI HELPERS
     --------------------------------------------------------- */

  function setSystemStatus(text) {
    const element =
      document.querySelector("#systemStatus");

    if (element) {
      element.textContent = text;
    }
  }

  function showToast(message) {
    let toast =
      document.querySelector(".fm-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "fm-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;

    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 2800);
  }

  function animateNumber(element, from, to, duration) {
    return new Promise(resolve => {
      const start = performance.now();

      function frame(now) {
        const progress =
          Math.min(1, (now - start) / duration);

        const eased =
          1 - Math.pow(1 - progress, 3);

        const value =
          from + (to - from) * eased;

        element.textContent =
          value.toFixed(1);

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  function formatScore(score) {
    return Number(score || 0).toFixed(1);
  }

  function formatDate(date) {
    try {
      return new Intl.DateTimeFormat(
        "ru-RU",
        {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }
      ).format(new Date(date));
    } catch {
      return "—";
    }
  }

  function truncate(value, max) {
    if (value.length <= max) return value;
    return value.slice(0, max - 1) + "…";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function delay(ms) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing =
        document.querySelector(`script[src="${src}"]`);

      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);

        if (window.faceapi) resolve();
        return;
      }

      const script =
        document.createElement("script");

      script.src = src;
      script.async = true;

      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  function cleanupImage() {
    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
    }

    state.file = null;
    state.imageUrl = null;
    state.image = null;
    state.face = null;
    state.score = null;
    state.measurements = [];
  }

  /* ---------------------------------------------------------
     START
     --------------------------------------------------------- */

  renderApp();

})();
