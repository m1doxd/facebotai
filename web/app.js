(() => {
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
