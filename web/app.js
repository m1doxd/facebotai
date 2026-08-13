const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const state = {
  image: null,
  file: null,
  result: null
};

const historyKey = "sub5-history-v1";


/* =========================
   NAVIGATION
========================= */

function go(screen) {

  $$(".screen").forEach(el => {

    const active = el.id === screen;

    el.classList.toggle("active", active);

    if (active) {

      el.classList.remove("screen-enter");

      requestAnimationFrame(() => {
        el.classList.add("screen-enter");
      });

    }

  });

  $$(".nav-item").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.screen === screen
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (screen === "history") {
    renderHistory();
  }

}


/* =========================
   TOAST
========================= */

function toast(text) {

  const el = $("#toast");

  el.textContent = text;

  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 2400);

}


/* =========================
   SCREEN BUTTONS
========================= */

$$("[data-screen]").forEach(btn => {

  btn.addEventListener("click", () => {
    go(btn.dataset.screen);
  });

});


/* =========================
   FILE UPLOAD
========================= */

$("#uploadBtn").addEventListener("click", () => {
  $("#fileInput").click();
});


$("#fileInput").addEventListener("change", e => {

  const file = e.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    return toast("Выбери изображение.");
  }

  if (file.size > 20 * 1024 * 1024) {
    return toast("Файл слишком большой — максимум 20 MB.");
  }

  state.file = file;

  const reader = new FileReader();

  reader.onload = () => {

    state.image = reader.result;

    $("#previewImage").src = state.image;

    $("#fileName").textContent =
      file.name;

    $("#fileSize").textContent =
      formatBytes(file.size);

    go("photo");

  };

  reader.readAsDataURL(file);

});


/* =========================
   FILE SIZE
========================= */

function formatBytes(bytes) {

  if (bytes < 1024 * 1024) {
    return `${Math.max(
      1,
      Math.round(bytes / 1024)
    )} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;

}


/* =========================
   ANALYSIS
========================= */

$("#analyzeBtn").addEventListener(
  "click",
  runAnalysis
);


$("#newAnalysis").addEventListener(
  "click",
  () => {

    $("#fileInput").value = "";

    state.file = null;
    state.image = null;

    go("home");

  }
);


async function runAnalysis() {

  if (!state.image || !state.file) {
    return toast("Сначала выбери фотографию.");
  }

  const btn = $("#analyzeBtn");

  btn.disabled = true;

  go("loading");


  const steps =
    $$(".loading-step");


  const messages = [

    "Подготовка изображения…",

    "Проверка композиции…",

    "Расчёт визуальных метрик…",

    "Формирование отчёта…"

  ];


  for (
    let i = 0;
    i < steps.length;
    i++
  ) {

    steps.forEach(
      (step, index) => {

        step.classList.toggle(
          "active",
          index === i
        );

        step.classList.toggle(
          "done",
          index < i
        );

      }
    );

    $("#loadingText").textContent =
      messages[i];

    await wait(
      650 +
      Math.random() * 300
    );

  }


  const result =
    await calculateVisualMetrics(
      state.image
    );


  state.result = result;

  populateResult(result);

  saveHistory(result);

  go("result");

  btn.disabled = false;

}


/* =========================
   WAIT
========================= */

function wait(ms) {

  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );

}


/* =========================
   IMAGE ANALYSIS
========================= */

async function calculateVisualMetrics(src) {

  const img = new Image();

  img.src = src;

  await img.decode();


  const canvas =
    document.createElement("canvas");


  const max = 700;


  const scale = Math.min(
    1,
    max /
    Math.max(
      img.naturalWidth,
      img.naturalHeight
    )
  );


  canvas.width =
    Math.max(
      1,
      Math.round(
        img.naturalWidth * scale
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.round(
        img.naturalHeight * scale
      )
    );


  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  ctx.drawImage(
    img,
    0,
    0,
    canvas.width,
    canvas.height
  );


  const data =
    ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;


  let sum = 0;
  let sumSq = 0;

  let left = 0;
  let right = 0;

  const count =
    data.length / 4;


  const gray =
    new Float32Array(count);


  /* =========================
     GRAYSCALE / BRIGHTNESS
  ========================= */

  for (
    let i = 0, p = 0;
    i < data.length;
    i += 4, p++
  ) {

    const g =
      (
        0.2126 * data[i] +
        0.7152 * data[i + 1] +
        0.0722 * data[i + 2]
      ) / 255;


    gray[p] = g;

    sum += g;

    sumSq += g * g;


    const x =
      p % canvas.width;


    if (
      x <
      canvas.width / 2
    ) {

      left += g;

    } else {

      right += g;

    }

  }


  /* =========================
     STATISTICS
  ========================= */

  const mean =
    sum / count;


  const variance =
    Math.max(
      0,
      sumSq / count -
      mean * mean
    );


  const std =
    Math.sqrt(variance);


  /* =========================
     EDGE / SHARPNESS
  ========================= */

  let edge = 0;


  for (
    let y = 1;
    y < canvas.height;
    y += 2
  ) {

    for (
      let x = 1;
      x < canvas.width;
      x += 2
    ) {

      const idx =
        y * canvas.width + x;


      edge +=
        Math.abs(
          gray[idx] -
          gray[idx - 1]
        ) +
        Math.abs(
          gray[idx] -
          gray[idx - canvas.width]
        );

    }

  }


  const edgeNorm =
    Math.min(
      1,
      edge /
      (
        canvas.width *
        canvas.height *
        0.045
      )
    );


  /* =========================
     METRICS
  ========================= */

  const symmetry =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
          Math.abs(
            left - right
          ) /
          Math.max(
            0.001,
            left + right
          ) *
          100
        )
      )
    );


  const contrast =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          std * 210
        )
      )
    );


  const lighting =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (
            1 -
            Math.abs(
              mean - 0.52
            ) *
            1.65
          ) *
          100
        )
      )
    );


  const sharpness =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          edgeNorm * 100
        )
      )
    );


  const exposure =
    mean < 0.28
      ? "Тёмная"
      : mean > 0.78
        ? "Светлая"
        : "Сбаланс.";


  const composition =
    Math.round(
      (
        symmetry * 0.35 +
        contrast * 0.25 +
        lighting * 0.2 +
        sharpness * 0.2
      ) /
      10 *
      10
    ) / 10;


  const score =
    Math.max(
      1,
      Math.min(
        9.9,
        composition / 10
      )
    );


  const angle =
    canvas.width /
      canvas.height >
      1.55

      ? "Широкий"

      : canvas.width /
          canvas.height <
          0.72

        ? "Вертикальный"

        : "Нейтральный";


  const centering =
    symmetry > 88
      ? "Высокая"
      : symmetry > 72
        ? "Средняя"
        : "Низкая";


  return {

    score:
      Number(
        score.toFixed(1)
      ),

    symmetry,

    contrast,

    lighting,

    sharpness,

    exposure,

    composition:
      Number(
        composition.toFixed(1)
      ),

    centering,

    angle,

    aspect:
      `${img.naturalWidth}×${img.naturalHeight}`,

    date:
      new Date().toLocaleString(
        "ru-RU",
        {
          day:"2-digit",
          month:"2-digit",
          hour:"2-digit",
          minute:"2-digit"
        }
      )

  };

}


/* =========================
   RESULT UI
========================= */

function populateResult(r) {

  $("#score").textContent =
    r.score.toFixed(1);


  requestAnimationFrame(() => {

    $("#scoreBar").style.width =
      `${r.score * 10}%`;

  });


  $("#scoreText").textContent =
    r.score >= 8

      ? "Сильный визуальный баланс"

      : r.score >= 6

        ? "Сбалансированный кадр"

        : "Есть пространство для улучшения кадра";


  $("#symmetry").textContent =
    `${r.symmetry}%`;

  $("#contrast").textContent =
    `${r.contrast}%`;

  $("#lighting").textContent =
    `${r.lighting}%`;

  $("#angle").textContent =
    r.angle;


  $("#composition").textContent =
    `${r.composition}`;

  $("#sharpness").textContent =
    `${r.sharpness}%`;

  $("#exposure").textContent =
    r.exposure;

  $("#centering").textContent =
    r.centering;


  $("#mSym").textContent =
    `${r.symmetry}%`;

  $("#mContrast").textContent =
    `${r.contrast}%`;

  $("#mLight").textContent =
    `${r.lighting}%`;


  $("#aspect").textContent =
    r.aspect;

  $("#centerDetail").textContent =
    r.centering;

  $("#contrastDetail").textContent =
    `${r.contrast}%`;

  $("#brightnessDetail").textContent =
    r.exposure;


  $("#tipLight").textContent =
    r.lighting < 65

      ? "Добавить мягкий фронтальный свет"

      : "Свет уже достаточно ровный";


  $("#tipAngle").textContent =
    r.symmetry < 75

      ? "Попробовать более фронтальный ракурс"

      : "Ракурс выглядит стабильным";

}


/* =========================
   ACCORDIONS
========================= */

$$(".metric-header").forEach(btn => {

  btn.addEventListener(
    "click",
    () => {

      btn
        .closest(".metric-card")
        .classList
        .toggle("open");

    }
  );

});


$$(".feature-group__header").forEach(btn => {

  btn.addEventListener(
    "click",
    () => {

      btn
        .closest(".feature-group")
        .classList
        .toggle("open");

    }
  );

});


/* =========================
   HISTORY
========================= */

function getHistory() {

  try {

    return JSON.parse(
      localStorage.getItem(
        historyKey
      ) || "[]"
    );

  } catch {

    return [];

  }

}


function saveHistory(result) {

  const items =
    getHistory();


  items.unshift({

    score:
      result.score,

    date:
      result.date,

    file:
      state.file?.name ||
      "image"

  });


  localStorage.setItem(

    historyKey,

    JSON.stringify(
      items.slice(0, 20)
    )

  );

}


function renderHistory() {

  const items =
    getHistory();


  $("#historyCount").textContent =
    items.length;


  const list =
    $("#historyList");


  if (!items.length) {

    list.innerHTML = `
      <div class="history-empty">
        Здесь пока ничего нет.<br>
        После первого анализа результат
        появится автоматически.
      </div>
    `;

    return;

  }


  list.innerHTML =
    items
      .map(item => `

        <div class="history-item">

          <div>

            <div class="date">
              ${escapeHtml(item.date)}
            </div>

            <div class="meta">
              ${escapeHtml(item.file)}
            </div>

          </div>

          <div class="score">
            ${Number(item.score).toFixed(1)}
          </div>

        </div>

      `)
      .join("");

}


/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(str) {

  return String(str).replace(
    /[&<>"']/g,

    c => ({

      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"

    }[c])

  );

}


/* =========================
   INIT
========================= */

renderHistory();
