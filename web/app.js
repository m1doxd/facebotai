// ============================================================
// FACE METRIC APP - UNIFIED FRONTEND v2026.08.15-gender-modal-fix
// ============================================================

window.__FACEMETRIC_APP_VERSION__ = "2026-08-21-manual-points-classification-v14";


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


function getMaleClassification(score){return getGenderClassification(score,["Low LTN","LTN","High LTN","Low MTN","MTN","High MTN","Low HTN","HTN","High HTN","Low Chad Lite","Chad Lite","High Chad Lite","Low Chad","Chad","High Chad","Adam Lite","True Adam"]);}
function getFemaleClassification(score){return getGenderClassification(score,["Low LTB","LTB","High LTB","Low MTB","MTB","High MTB","Low HTB","HTB","High HTB","Low Stacy Lite","Stacy Lite","High Stacy Lite","Low Stacy","Stacy","High Stacy","Eve Lite","True Eve"]);}
function getGenderClassification(score,n){const x=Number(score);if(!Number.isFinite(x))return null;if(x<=2)return"Sub 3";if(x<4)return x<3?"Sub 5":null;if(x<4.5)return n[0];if(x<4.8)return n[1];if(x<5)return n[2];if(x<5.5)return n[3];if(x<5.8)return n[4];if(x<6)return n[5];if(x<6.5)return n[6];if(x<6.8)return n[7];if(x<7)return n[8];if(x<7.5)return n[9];if(x<7.8)return n[10];if(x<8)return n[11];if(x<8.5)return n[12];if(x<8.8)return n[13];if(x<9)return n[14];if(x===9)return n[15];if(x===10)return n[16];return null;}

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

// Application-owned score classification. The backend score remains the source
// of truth; the display tier is derived deterministically from the selected profile.
function getScoreClassification(score, gender = selectedGender) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0 || value > 10) return null;
  const female = gender === "female";
  const tiers = female ? [
    [0, 2, "Sub 3"], [2, 3, "Sub 5"],
    [4, 4.4, "Low LTB"], [4.5, 4.7, "LTB"], [4.8, 4.9, "High LTB"],
    [5, 5.4, "Low MTB"], [5.5, 5.7, "MTB"], [5.8, 5.9, "High MTB"],
    [6, 6.4, "Low HTB"], [6.5, 6.7, "HTB"], [6.8, 6.9, "High HTB"],
    [7, 7.4, "Low Stacy Lite"], [7.5, 7.7, "Stacy Lite"], [7.8, 7.9, "High Stacy Lite"],
    [8, 8.4, "Low Stacy"], [8.5, 8.7, "Stacy"], [8.8, 8.9, "High Stacy"],
    [9, 9, "Eve Lite"], [10, 10, "True Eve"]
  ] : [
    [0, 2, "Sub 3"], [2, 3, "Sub 5"],
    [4, 4.4, "Low LTN"], [4.5, 4.7, "LTN"], [4.8, 4.9, "High LTN"],
    [5, 5.4, "Low MTN"], [5.5, 5.7, "MTN"], [5.8, 5.9, "High MTN"],
    [6, 6.4, "Low HTN"], [6.5, 6.7, "HTN"], [6.8, 6.9, "High HTN"],
    [7, 7.4, "Low Chad Lite"], [7.5, 7.7, "Chad Lite"], [7.8, 7.9, "High Chad Lite"],
    [8, 8.4, "Low Chad"], [8.5, 8.7, "Chad"], [8.8, 8.9, "High Chad"],
    [9, 9, "Adam Lite"], [10, 10, "True Adam"]
  ];
  const rounded = Math.round(value * 10) / 10;
  for (const [min,max,label] of tiers) {
    const lowerOk = min === 2 && label === "Sub 5" ? rounded > 2 : rounded >= min;
    if (lowerOk && rounded <= max) return { label, score: rounded, band: `${min}–${max}` };
  }
  return { label: null, score: rounded, band: null };
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
  // Already configured — do not reopen unless force: true
  if (!options.force && saved?.adultConfirmed && (saved.gender === "male" || saved.gender === "female")) {
    selectedGender = saved.gender;
    adultConfirmed = true;
    if (genderSelect) genderSelect.value = selectedGender;
    if (adultConfirm) adultConfirm.checked = true;
    return false;
  }

  gender.value = selectedGender === "female" ? "female" : (saved?.gender || "male");
  adult.checked = adultConfirmed || saved?.adultConfirmed === true;
  syncClassificationModalControls();
  if (error) { error.hidden = true; error.textContent = ""; }

  modal.hidden = false;
  modal.style.pointerEvents = "";
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  if (options.focus !== false) {
    window.setTimeout(() => {
      document.querySelector(".classification-gender-option.is-selected")?.focus();
    }, 0);
  }
  return true;
}

function syncClassificationModalControls() {
  const gender = document.getElementById("classificationGender");
  const adult = document.getElementById("classificationAdult");
  const adultToggle = document.getElementById("classificationAdultToggle");

  if (gender) {
    const value = gender.value === "female" ? "female" : "male";
    document.querySelectorAll(".classification-gender-option").forEach(button => {
      const active = button.dataset.gender === value;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  if (adult && adultToggle) {
    const active = adult.checked === true;
    adultToggle.classList.toggle("is-selected", active);
    adultToggle.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function closeClassificationModal() {
  const modal = document.getElementById("classificationModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.classList.add("is-closing");
  modal.setAttribute("aria-hidden", "true");
  // Immediately stop intercepting clicks; hide after animation
  modal.style.pointerEvents = "none";
  window.setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove("is-closing");
    modal.style.pointerEvents = "";
  }, 240);
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

  const saved = getClassificationSettings();
  if (saved) {
    selectedGender = saved.gender;
    adultConfirmed = saved.adultConfirmed;
    if (genderSelect) genderSelect.value = selectedGender;
    if (adultConfirm) adultConfirm.checked = adultConfirmed;
    syncClassificationModalControls();
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  } else {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll(".classification-gender-option").forEach(button => {
    button.addEventListener("click", () => {
      gender.value = button.dataset.gender === "female" ? "female" : "male";
      if (error) { error.hidden = true; error.textContent = ""; }
      syncClassificationModalControls();
    });
  });

  const adultToggle = document.getElementById("classificationAdultToggle");
  if (adultToggle) {
    adultToggle.addEventListener("click", () => {
      adult.checked = !adult.checked;
      if (error && adult.checked) { error.hidden = true; error.textContent = ""; }
      syncClassificationModalControls();
    });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const nextGender = gender.value === "female" ? "female" : "male";
    if (!adult.checked) {
      if (error) {
        error.textContent = "Для классификационного результата нужно подтвердить, что вам 18 лет или больше.";
        error.hidden = false;
      }
      adult.focus();
      return;
    }

    selectedGender = nextGender;
    adultConfirmed = true;
    if (genderSelect) genderSelect.value = selectedGender;
    if (adultConfirm) adultConfirm.checked = true;

    closeClassificationModal();
    updateAnalysisButtonState();
    showToast("Пол сохранён. Подготовим фото.");
    // After gender → front capture guide → upload
    window.setTimeout(() => openCaptureFlow("front"), 180);
  });

  modal.addEventListener("keydown", event => {
    if (event.key === "Escape") event.preventDefault();
  });
}

function maybeOpenClassificationModal() {
  // Intentionally disabled: gender modal must open only on explicit user action
  // (кнопка «Приступить к анализу» / «Начать анализ»).
  return;
}

function resetMetricSelection() {
  activeMetric = null;
  try {
    document.querySelectorAll(".metric-card.active, .metric-row.active, [data-metric].active")
      .forEach(el => el.classList.remove("active"));
  } catch {}
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

function prepareIosModal(modal) {
  if (!modal) return;
  modal.classList.remove("ios-modal-enter", "ios-modal-leave");
  void modal.offsetWidth;
  modal.classList.add("ios-modal-enter");
  prepareIosModal(modal);
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
  modal.style.pointerEvents = "";
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
  // Gender modal opens only when user clicks «Приступить к анализу»
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
        VALIDATE_KEY_ENDPOINT + "?t=" + Date.now(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Gemini-Key": key
          },
          body: JSON.stringify({}),
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
      showToast("Gemini API ключ проверен и сохранён.");
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
  // Do NOT auto-open gender modal on page load.
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
const LANDMARK_SUGGESTIONS_ENDPOINT = API_ENDPOINT.replace(/\/analyze$/, "/landmark-suggestions");
const LANDMARK_SUGGESTIONS_ENABLED = true;

// Dense client-side face landmarks. Gemini remains the semantic/analysis
// engine, while MediaPipe Face Landmarker supplies stable geometric points
// for alignment and measurement overlays. If the model cannot be loaded,
// the app safely falls back to the Worker landmarks.
const FACE_LANDMARKER_VERSION = "0.10.22";
const FACE_LANDMARKER_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${FACE_LANDMARKER_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/* ============================================================
   LANDMARK DEFINITIONS — Manual verification system
   FRONT: 52 points | PROFILE: 31 points
============================================================ */

const FRONT_LANDMARKS = [
  { id: "hairline", label: "Линия роста волос", tech: "hairline", mp: 10, desc: "Центр линии роста волос на лбу. Ищите самую верхнюю точку, где волосы встречаются с кожей лба." },
  { id: "leftTemple", label: "Левый висок", tech: "leftTemple", mp: 54, desc: "Самая боковая точка височной области слева." },
  { id: "rightTemple", label: "Правый висок", tech: "rightTemple", mp: 284, desc: "Самая боковая точка височной области справа." },
  { id: "leftBrowOuter", label: "Внешний край левой брови", tech: "leftBrowOuter", mp: 46, desc: "Самый внешний (латеральный) конец левой брови." },
  { id: "leftBrowPeak", label: "Пик левой брови", tech: "leftBrowPeak", mp: 70, desc: "Самая высокая точка арки левой брови." },
  { id: "leftBrowInner", label: "Внутренний край левой брови", tech: "leftBrowInner", mp: 55, desc: "Внутренний (медиальный) конец левой брови у переносицы." },
  { id: "glabella", label: "Глабелла", tech: "glabella", mp: 9, desc: "Точка между бровями на переносице, самая выступающая." },
  { id: "rightBrowInner", label: "Внутренний край правой брови", tech: "rightBrowInner", mp: 285, desc: "Внутренний конец правой брови." },
  { id: "rightBrowPeak", label: "Пик правой брови", tech: "rightBrowPeak", mp: 300, desc: "Самая высокая точка арки правой брови." },
  { id: "rightBrowOuter", label: "Внешний край правой брови", tech: "rightBrowOuter", mp: 276, desc: "Самый внешний конец правой брови." },
  { id: "rightBrowArch", label: "Арка правой брови", tech: "rightBrowArch", mp: 334, desc: "Средняя точка арки правой брови." },
  { id: "leftEyeLateralCanthus", label: "Внешний угол левого глаза", tech: "leftEyeLateralCanthus", mp: 33, desc: "Внешний уголок левого глаза (латеральный кант)." },
  { id: "leftEyeUpper", label: "Верхнее веко левого глаза", tech: "leftEyeUpper", mp: 159, desc: "Центр верхнего века левого глаза." },
  { id: "leftEyeInner", label: "Внутренний угол левого глаза", tech: "leftEyeInner", mp: 133, desc: "Внутренний уголок левого глаза." },
  { id: "leftEyeLower", label: "Низ левого глаза", tech: "leftEyeLower", mp: 145, desc: "Центр нижнего века левого глаза." },
  { id: "leftEyelidHoodEnd", label: "Конец века левого глаза", tech: "leftEyelidHoodEnd", mp: 46, desc: "Конец капюшона верхнего века слева." },
  { id: "rightEyeInner", label: "Внутренний угол правого глаза", tech: "rightEyeInner", mp: 362, desc: "Внутренний уголок правого глаза." },
  { id: "rightEyeUpper", label: "Верхнее веко правого глаза", tech: "rightEyeUpper", mp: 386, desc: "Центр верхнего века правого глаза." },
  { id: "rightEyeLateralCanthus", label: "Внешний угол правого глаза", tech: "rightEyeLateralCanthus", mp: 263, desc: "Внешний уголок правого глаза." },
  { id: "rightEyeLower", label: "Низ правого глаза", tech: "rightEyeLowerEyelid", mp: 374, desc: "Центр нижнего века правого глаза." },
  { id: "leftCheek", label: "Левая скула", tech: "leftCheek", mp: 234, desc: "Самая выступающая точка левой скулы." },
  { id: "rightCheek", label: "Правая скула", tech: "rightCheek", mp: 454, desc: "Самая выступающая точка правой скулы." },
  { id: "noseBridge", label: "Переносица", tech: "noseBridge", mp: 168, desc: "Центр переносицы между глазами." },
  { id: "leftNoseBridge", label: "Левая переносица", tech: "leftNoseBridge", mp: 6, desc: "Левая сторона переносицы." },
  { id: "rightNoseBridge", label: "Правая переносица", tech: "rightNoseBridge", mp: 197, desc: "Правая сторона переносицы." },
  { id: "noseTip", label: "Кончик носа", tech: "noseTip", mp: 1, desc: "Самый выступающий кончик носа." },
  { id: "leftNostril", label: "Левое крыло носа", tech: "leftNostril", mp: 98, desc: "Самая боковая точка левого крыла носа." },
  { id: "rightNostril", label: "Правое крыло носа", tech: "rightNostril", mp: 327, desc: "Самая боковая точка правого крыла носа." },
  { id: "nasalBase", label: "Под носом", tech: "nasalBase", mp: 2, desc: "Точка под носом (субназале), где нос встречается с верхней губой." },
  { id: "leftMouthCorner", label: "Левый уголок рта", tech: "leftMouthCorner", mp: 61, desc: "Левый уголок рта." },
  { id: "mouthMiddle", label: "Центр губ", tech: "mouthMiddle", mp: 13, desc: "Центр линии смыкания губ." },
  { id: "rightMouthCorner", label: "Правый уголок рта", tech: "rightMouthCorner", mp: 291, desc: "Правый уголок рта." },
  { id: "upperLip", label: "Верхняя губа", tech: "upperLip", mp: 0, desc: "Центр верхней губы (куприд)." },
  { id: "lowerLip", label: "Нижняя губа", tech: "lowerLip", mp: 17, desc: "Центр нижней губы." },
  { id: "chinBottom", label: "Низ подбородка", tech: "chinBottom", mp: 152, desc: "Самая нижняя точка подбородка." },
  { id: "leftJaw", label: "Левый угол челюсти", tech: "leftJaw", mp: 172, desc: "Угол нижней челюсти слева (гонион)." },
  { id: "rightJaw", label: "Правый угол челюсти", tech: "rightJaw", mp: 397, desc: "Угол нижней челюсти справа." },
  { id: "leftOuterEar", label: "Левое ухо (внешнее)", tech: "leftOuterEar", mp: 234, desc: "Самая боковая точка левого уха." },
  { id: "rightOuterEar", label: "Правое ухо", tech: "rightOuterEar", mp: 454, desc: "Самая боковая точка правого уха." },
  { id: "neckLeft", label: "Левая сторона шеи", tech: "neckLeft", mp: 176, desc: "Точка на левой стороне шеи под челюстью." },
  { id: "neckRight", label: "Правая сторона шеи", tech: "neckRight", mp: 400, desc: "Точка на правой стороне шеи под челюстью." },
  { id: "foreheadCenter", label: "Центр лба", tech: "foreheadCenter", mp: 10, desc: "Центральная точка лба." },
  { id: "leftEyeCenter", label: "Центр левого глаза", tech: "leftEyeCenter", mp: 468, desc: "Центр зрачка левого глаза." },
  { id: "rightEyeCenter", label: "Центр правого глаза", tech: "rightEyeCenter", mp: 473, desc: "Центр зрачка правого глаза." },
  { id: "philtrum", label: "Фильтрум", tech: "philtrum", mp: 164, desc: "Центр фильтрума (бороздка над верхней губой)." },
  { id: "leftCheekbone", label: "Левая скуловая дуга", tech: "leftCheekbone", mp: 116, desc: "Точка на левой скуловой дуге." },
  { id: "rightCheekbone", label: "Правая скуловая дуга", tech: "rightCheekbone", mp: 345, desc: "Точка на правой скуловой дуге." },
  { id: "leftJawline", label: "Левая линия челюсти", tech: "leftJawline", mp: 150, desc: "Средняя точка левой линии челюсти." },
  { id: "rightJawline", label: "Правая линия челюсти", tech: "rightJawline", mp: 379, desc: "Средняя точка правой линии челюсти." },
  { id: "menton", label: "Ментон", tech: "menton", mp: 175, desc: "Самая нижняя точка подбородка в центре." },
  { id: "leftAlar", label: "Левое крыло (аляр)", tech: "leftAlar", mp: 48, desc: "Точка крепления левого крыла носа." },
  { id: "rightAlar", label: "Правое крыло (аляр)", tech: "rightAlar", mp: 278, desc: "Точка крепления правого крыла носа." }
];

const PROFILE_LANDMARKS = [
  { id: "profile_glabella", label: "Глабелла", tech: "glabella", mp: null, desc: "Точка между бровями на профиле." },
  { id: "profile_nasion", label: "Насион", tech: "nasion", mp: null, desc: "Точка впадины у корня носа." },
  { id: "profile_supratip", label: "Супратип", tech: "supratip", mp: null, desc: "Точка на спинке носа чуть выше кончика." },
  { id: "profile_pronasale", label: "Кончик носа", tech: "pronasale", mp: null, desc: "Самый выступающий кончик носа." },
  { id: "profile_columella", label: "Колумелла", tech: "columella", mp: null, desc: "Нижняя точка колумеллы носа." },
  { id: "profile_subnasale", label: "Субназале", tech: "subnasale", mp: null, desc: "Точка, где нос встречается с верхней губой." },
  { id: "profile_labiale_superius", label: "Верхняя губа", tech: "labialeSuperius", mp: null, desc: "Самая передняя точка верхней губы." },
  { id: "profile_labiale_inferius", label: "Нижняя губа", tech: "labialeInferius", mp: null, desc: "Самая передняя точка нижней губы." },
  { id: "profile_pogonion", label: "Погонион", tech: "pogonion", mp: null, desc: "Самая выступающая точка подбородка." },
  { id: "profile_menton", label: "Ментон", tech: "menton", mp: null, desc: "Самая нижняя точка подбородка." },
  { id: "profile_gonion", label: "Угол челюсти", tech: "gonion", mp: null, desc: "Угол нижней челюсти." },
  { id: "profile_chin_neck", label: "Шейная точка", tech: "chinNeck", mp: null, desc: "Точка перехода подбородка в шею." },
  { id: "profile_orbitale", label: "Орбитале", tech: "orbitale", mp: null, desc: "Самая нижняя точка глазницы." },
  { id: "profile_tragion", label: "Межкозелковкая вырезка", tech: "tragion", mp: null, desc: "Точка в межкозелковой вырезке уха." },
  { id: "profile_zygomatic", label: "Скуловой бугор", tech: "zygomatic", mp: null, desc: "Выступающая точка скулы на профиле." },
  { id: "profile_lower_eyelid", label: "Нижнее веко", tech: "lowerEyelid", mp: null, desc: "Точка нижнего века." },
  { id: "profile_upper_eyelid", label: "Верхнее веко", tech: "upperEyelid", mp: null, desc: "Точка верхнего века." },
  { id: "profile_forehead", label: "Лоб (профиль)", tech: "forehead", mp: null, desc: "Выступающая точка лба." },
  { id: "profile_nose_bridge", label: "Спинка носа", tech: "noseBridge", mp: null, desc: "Средняя точка спинки носа." },
  { id: "profile_ala", label: "Крыло носа", tech: "ala", mp: null, desc: "Крыло носа на профиле." },
  { id: "profile_stomion", label: "Стомион", tech: "stomion", mp: null, desc: "Точка смыкания губ." },
  { id: "profile_soft_tissue_gnathion", label: "Мягкотканный гнатион", tech: "gnathion", mp: null, desc: "Нижняя передняя точка подбородка." },
  { id: "profile_cervical", label: "Шейная точка (низ)", tech: "cervical", mp: null, desc: "Точка на шее." },
  { id: "profile_ear_top", label: "Верх уха", tech: "earTop", mp: null, desc: "Верхняя точка уха." },
  { id: "profile_ear_bottom", label: "Низ уха", tech: "earBottom", mp: null, desc: "Нижняя точка уха." },
  { id: "profile_jaw_angle_low", label: "Угол челюсти (низ)", tech: "jawAngleLow", mp: null, desc: "Нижняя точка угла челюсти." },
  { id: "profile_sublabiale", label: "Сублабиале", tech: "sublabiale", mp: null, desc: "Точка под нижней губой." },
  { id: "profile_trichion", label: "Трихион", tech: "trichion", mp: null, desc: "Точка линии роста волос на профиле." },
  { id: "profile_sellion", label: "Селлион", tech: "sellion", mp: null, desc: "Самая глубокая точка корня носа." },
  { id: "profile_rhinion", label: "Ринион", tech: "rhinion", mp: null, desc: "Точка на спинке носа." },
  { id: "profile_infraorbitale", label: "Инфраорбитале", tech: "infraorbitale", mp: null, desc: "Точка под глазом." }
];

let faceLandmarkerPromise = null;
let lastClientLandmarks = null;
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

/* Landmark Editor state */
let landmarkEditorActive = false;
let landmarkEditorMode = "front"; // "front" | "profile"
let landmarkEditorIndex = 0;
let confirmedFrontLandmarks = {};
let confirmedProfileLandmarks = {};
// AI/MediaPipe proposals are intentionally kept separate from confirmed data.
// A proposal only becomes authoritative when the user confirms that step.
let suggestedFrontLandmarks = {};
let suggestedProfileLandmarks = {};
let landmarkSuggestionRequestId = 0;
let editorImageScale = 1;
let editorImageTx = 0;
let editorImageTy = 0;
let editorIsDragging = false;
let editorDragStartX = 0;
let editorDragStartY = 0;
let editorDragStartTx = 0;
let editorDragStartTy = 0;
let pendingAnalysisFile = null;
let pendingProfileFile = null;
let autoDetectedFront = null;
let autoDetectedMesh = null; // full MediaPipe 478-point mesh (normalized) for precise howto pins & mapping

let autoDetectedProfile = null;

// Profile preparation uses one canonical working image. Every downstream
// profile operation (AI suggestions, manual points, metrics and overlays)
// uses this exact transformed image.
let profileWorkingFile = null;
let profileWorkingObjectUrl = null;
let profileRotationDegrees = 0;
let profileMirrored = false;

/* Capture / onboarding flow. This sits in front of the existing uploader and
   deliberately does not change the Worker request contract. */
const captureFlow = document.getElementById("captureFlow");
const captureFlowBody = document.getElementById("captureFlowBody");
const captureFlowTitle = document.getElementById("captureFlowTitle");
const captureFlowCounter = document.getElementById("captureFlowCounter");
const captureFlowProgress = document.getElementById("captureFlowProgress");
const captureFlowNext = document.getElementById("captureFlowNext");
const captureFlowBack = document.getElementById("captureFlowBack");
const captureFlowClose = document.getElementById("captureFlowClose");
let captureMode = "front";
let captureStep = 0;

const CAPTURE_GUIDES = {
  front: [
    { title:"Камера на уровне лица", good:"Камера строго напротив лица", bad:"Снизу или сверху", text:"Держите камеру прямо перед лицом, на уровне глаз. Так пропорции не искажаются." },
    { title:"Используйте основную камеру", good:"Чёткое и естественное изображение", bad:"Размытое селфи", text:"Основная камера обычно даёт более чистую геометрию. Если нужно видеть себя — используйте зеркало." },
    { title:"Отойдите и включите зум", good:"Около 2 м · зум ×2–×3", bad:"Селфи с вытянутой руки", text:"Большая дистанция уменьшает перспективное искажение лица." },
    { title:"Покажите контур лица", good:"Уши и линия роста волос видны", bad:"Волосы закрывают лицо", text:"Откройте овал лица, уши и линию роста волос. Не используйте сильные тени." },
    { title:"Без мимики", good:"Спокойное лицо · рот закрыт", bad:"Улыбка или нахмуренные брови", text:"Смотрите прямо и расслабленно. Лёгкая естественная мимика допустима, но нейтральное лицо точнее." }
  ],
  profile: [
    { title:"Профиль ровно 90°", good:"Виден чистый боковой контур", bad:"Голова повернута под углом", text:"Поверните голову строго в сторону. В кадре должен быть один читаемый профиль." },
    { title:"Волосы и контур лица", good:"Контур открыт", bad:"Лицо перекрыто волосами", text:"Уберите волосы от лица, чтобы были видны лоб, нос, губы, челюсть и подбородок." },
    { title:"Свет и фон", good:"Ровное освещение", bad:"Жёсткие тени", text:"Используйте нейтральный фон и ровный свет. Не снимайте в контровом свете." },
    { title:"Проверьте профиль", good:"Нос направлен вправо", bad:"Сильный наклон головы", text:"После загрузки можно будет автоматически выровнять кадр перед анализом." }
  ]
};


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
  if (name !== "result") {
    closeMetricReferenceViewer();
  }

  const target = document.getElementById(`screen-${name}`);

  if (!target) return;

  screens.forEach(screen => {
    const active = screen === target;

    screen.classList.toggle("active", active);
    if (active) {
      screen.hidden = false;
      screen.removeAttribute("aria-hidden");
      screen.classList.remove("screen-enter");
      void screen.offsetWidth;
      screen.classList.add("screen-enter");
    } else {
      // Force fully out of layout — prevents home hero / other screens from leaking when scrolling
      screen.hidden = true;
      screen.setAttribute("aria-hidden", "true");
      screen.classList.remove("screen-enter");
    }
  });

  currentScreen = name;

  updateNavigation(name);

  window.scrollTo({
    top: 0,
    behavior: "instant" in document.documentElement.style ? "instant" : "auto"
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

function openFrontFilePickerDirect() {
  if (!fileInput) {
    showToast("Не найден загрузчик фотографии.");
    return;
  }
  fileInput.value = "";
  fileInput.click();
}

const CAPTURE_GUIDES_STORAGE_KEY = "facemetric_skip_capture_guides";
function shouldSkipCaptureGuides() { return localStorage.getItem(CAPTURE_GUIDES_STORAGE_KEY) === "1"; }
function setSkipCaptureGuides(value) { try { localStorage.setItem(CAPTURE_GUIDES_STORAGE_KEY, value ? "1" : "0"); } catch {} }

function openCaptureFlow(mode = "front") {
  captureMode = mode === "profile" ? "profile" : "front";
  if (shouldSkipCaptureGuides()) {
    if (captureMode === "front") openFrontFilePickerDirect(); else profileFileInput?.click();
    return;
  }
  if (!captureFlow || !captureFlowBody) {
    if (mode === "front") openFrontFilePickerDirect();
    else profileFileInput?.click();
    return;
  }
  captureStep = 0;
  const skip = document.getElementById("captureSkipGuides");
  if (skip) skip.checked = shouldSkipCaptureGuides();
  captureFlow.hidden = false;
  captureFlow.style.pointerEvents = "";
  captureFlow.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => captureFlow.classList.add("is-open"));
  renderCaptureFlow();
}

function closeCaptureFlow() {
  if (!captureFlow) return;
  captureFlow.classList.remove("is-open");
  captureFlow.setAttribute("aria-hidden", "true");
  // Stop blocking clicks immediately while fade-out runs
  captureFlow.style.pointerEvents = "none";
  window.setTimeout(() => {
    if (!captureFlow.classList.contains("is-open")) {
      captureFlow.hidden = true;
      captureFlow.style.pointerEvents = "";
    }
  }, 220);
}

function renderCaptureFlow() {
  if (!captureFlowBody) return;
  const guides = CAPTURE_GUIDES[captureMode] || CAPTURE_GUIDES.front;
  const isUpload = captureStep >= guides.length;
  const guide = guides[Math.min(captureStep, guides.length - 1)];
  const total = guides.length + 1;
  if (captureFlowTitle) captureFlowTitle.textContent = captureMode === "front" ? "Подготовим анфас" : "Подготовим профиль";
  if (captureFlowCounter) captureFlowCounter.textContent = `${Math.min(captureStep + 1, total)} / ${total}`;
  if (captureFlowProgress) captureFlowProgress.style.width = `${((Math.min(captureStep + 1, total)) / total) * 100}%`;
  if (captureFlowBack) captureFlowBack.disabled = captureStep === 0;
  if (captureFlowNext) captureFlowNext.innerHTML = isUpload ? (captureMode === "front" ? `Загрузить анфас <span>→</span>` : `Загрузить профиль <span>→</span>`) : `Далее <span>→</span>`;

  if (isUpload) {
    captureFlowBody.innerHTML = `
      <div class="capture-upload-state">
        <div class="capture-upload-state__icon">⌁</div>
        <div class="eyebrow">${captureMode === "front" ? "FRONT VIEW" : "PROFILE VIEW"}</div>
        <h2>${captureMode === "front" ? "Загрузите фото анфас" : "Загрузите фото профиля"}</h2>
        <p>${captureMode === "front" ? "Чёткое фото прямо в камеру, без сильного наклона и перспективных искажений." : "Чистый боковой ракурс. Контур носа, губ и челюсти должен быть виден полностью."}</p>
        <div class="capture-upload-state__drop"><span>↑</span><strong>Выбрать изображение</strong><small>JPG, PNG или WEBP</small></div>
        ${captureMode === "profile" ? '<button type="button" class="capture-skip-profile">Пропустить профиль</button>' : ''}
      </div>`;
  } else {
    const goodFaceClass = captureMode === "profile" ? "capture-face capture-face--profile" : "capture-face capture-face--front";
    const badFaceClass = captureMode === "profile" ? "capture-face capture-face--profile-bad" : "capture-face capture-face--bad";
    captureFlowBody.innerHTML = `
      <article class="capture-guide-card">
        <div class="capture-guide-card__step">ШАГ ${captureStep + 1} ИЗ ${guides.length}</div>
        <h2>${escapeHtml(guide.title)}</h2>
        <div class="capture-guide-compare">
          <div class="capture-guide-visual capture-guide-visual--good"><div class="${goodFaceClass}"></div><b>✓ ${escapeHtml(guide.good)}</b></div>
          <div class="capture-guide-visual capture-guide-visual--bad"><div class="${badFaceClass}"></div><b>× ${escapeHtml(guide.bad)}</b></div>
        </div>
        <p>${escapeHtml(guide.text)}</p>
      </article>`;
  }
}

function openFilePicker() { openCaptureFlow("front"); }
function openProfileCaptureFlow() { openCaptureFlow("profile"); }


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


async function getFaceLandmarker() {
  if (faceLandmarkerPromise) return faceLandmarkerPromise;
  faceLandmarkerPromise = (async () => {
    try {
      const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${FACE_LANDMARKER_VERSION}`);
      const fileset = await vision.FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL);
      const common = {
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45
      };
      // GPU is faster, but some browsers / WebViews fail before returning any
      // landmarks. Fall back to CPU instead of silently opening an empty editor.
      try {
        return await vision.FaceLandmarker.createFromOptions(fileset, {
          ...common,
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: "GPU" }
        });
      } catch (gpuError) {
        console.warn("FaceMetric: GPU landmark detector unavailable; retrying on CPU.", gpuError);
        return await vision.FaceLandmarker.createFromOptions(fileset, {
          ...common,
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: "CPU" }
        });
      }
    } catch (error) {
      console.warn("FaceMetric: automatic landmark detector unavailable.", error);
      faceLandmarkerPromise = null;
      return null;
    }
  })();
  return faceLandmarkerPromise;
}

function pointFromLm(landmarks, index, confidence = 0.98) {
  const p = landmarks?.[index];
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)), confidence };
}

function sortedPair(a, b) {
  if (!a || !b) return [a, b];
  return a.x <= b.x ? [a, b] : [b, a];
}

function buildDenseFrontLandmarks(mesh) {
  if (!Array.isArray(mesh) || mesh.length < 400) return null;
  const raw = {};
  const put = (name, index, confidence = 0.98) => {
    const p = pointFromLm(mesh, index, confidence);
    if (p) raw[name] = p;
  };

  // MediaPipe Face Mesh stable anchors. Left/right are assigned by image X,
  // not by anatomical naming, so mirrored photos remain consistent.
  const eyeA = sortedPair(pointFromLm(mesh, 33), pointFromLm(mesh, 263));
  const eyeInner = sortedPair(pointFromLm(mesh, 133), pointFromLm(mesh, 362));
  const browA = sortedPair(pointFromLm(mesh, 70), pointFromLm(mesh, 300));
  const browOuter = sortedPair(pointFromLm(mesh, 46), pointFromLm(mesh, 276));
  const mouth = sortedPair(pointFromLm(mesh, 61), pointFromLm(mesh, 291));
  const noseW = sortedPair(pointFromLm(mesh, 98), pointFromLm(mesh, 327));
  const jaw = sortedPair(pointFromLm(mesh, 172), pointFromLm(mesh, 397));
  const cheek = sortedPair(pointFromLm(mesh, 234), pointFromLm(mesh, 454));

  if (eyeA[0]) raw.left_eye_outer = eyeA[0];
  if (eyeA[1]) raw.right_eye_outer = eyeA[1];
  if (eyeInner[0]) raw.left_eye_inner = eyeInner[0];
  if (eyeInner[1]) raw.right_eye_inner = eyeInner[1];
  if (browA[0]) raw.left_brow_inner = browA[0];
  if (browA[1]) raw.right_brow_inner = browA[1];
  if (browOuter[0]) raw.left_brow_outer = browOuter[0];
  if (browOuter[1]) raw.right_brow_outer = browOuter[1];
  if (mouth[0]) raw.mouth_left = mouth[0];
  if (mouth[1]) raw.mouth_right = mouth[1];
  if (noseW[0]) raw.nose_left = noseW[0];
  if (noseW[1]) raw.nose_right = noseW[1];
  if (jaw[0]) raw.left_jaw = jaw[0];
  if (jaw[1]) raw.right_jaw = jaw[1];
  if (cheek[0]) raw.left_cheekbone = cheek[0];
  if (cheek[1]) raw.right_cheekbone = cheek[1];

  put("forehead_center", 10);
  put("nose_bridge", 168);
  put("nose_tip", 1);
  put("upper_lip_center", 13);
  put("lower_lip_center", 14);
  put("chin", 152);

  return Object.keys(raw).length >= 10 ? raw : null;
}

// Profile landmarks are intentionally only suggestions. MediaPipe gives us a
// stable face mesh; these anchors seed the existing 31-point editor so the
// user can make the final anatomical correction instead of placing from zero.
const PROFILE_AUTO_MP = {
  profile_glabella: 9, profile_nasion: 168, profile_supratip: 6,
  profile_pronasale: 1, profile_columella: 2, profile_subnasale: 2,
  profile_labiale_superius: 13, profile_labiale_inferius: 14,
  profile_pogonion: 152, profile_menton: 152, profile_gonion: 172,
  profile_chin_neck: 199, profile_orbitale: 145, profile_tragion: 234,
  profile_zygomatic: 234, profile_lower_eyelid: 145, profile_upper_eyelid: 159,
  profile_forehead: 10, profile_nose_bridge: 6, profile_ala: 98,
  profile_stomion: 13, profile_soft_tissue_gnathion: 152, profile_cervical: 199,
  profile_ear_top: 127, profile_ear_bottom: 132, profile_jaw_angle_low: 172,
  profile_sublabiale: 17, profile_trichion: 10, profile_sellion: 168,
  profile_rhinion: 6, profile_infraorbitale: 145
};

function applyLandmarkSuggestionsToEditor(raw, mode, options = {}) {
  const list = mode === "profile" ? PROFILE_LANDMARKS : FRONT_LANDMARKS;
  const target = mode === "profile" ? confirmedProfileLandmarks : confirmedFrontLandmarks;
  const clean = sanitizeAISuggestedLandmarks(raw, list.map(lm => lm.id));
  let applied = 0;
  for (const lm of list) {
    const pt = clean[lm.id];
    if (!pt || (options.overwrite !== true && target[lm.id])) continue;
    target[lm.id] = { ...pt, source: pt.source || "gemini_suggestion" };
    applied++;
  }
  window.__facemetricLandmarkDebug = { ...(window.__facemetricLandmarkDebug || {}), [mode]: { requested:list.length, received:Object.keys(clean).length, applied, ids:Object.keys(clean) } };
  if (landmarkEditorActive && landmarkEditorMode === mode) requestAnimationFrame(() => { renderConfirmedDots(); updateLandmarkEditorUI(); });
  return { clean, applied };
}

function sanitizeAISuggestedLandmarks(raw, expectedIds) {
  const out = {};
  const allowed = new Set(expectedIds || []);
  for (const [id, pt] of Object.entries(raw || {})) {
    const x = Number(pt?.x), y = Number(pt?.y), confidence = Number(pt?.confidence);
    if (!allowed.has(id) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) continue;
    out[id] = { x, y, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5, source: "gemini_suggestion" };
  }
  return out;
}

async function requestAILandmarkSuggestions(file, mode, options = {}) {
  if (!file) return null;
  const allIds = (mode === "profile" ? PROFILE_LANDMARKS : FRONT_LANDMARKS).map(lm => lm.id);
  const ids = Array.isArray(options.ids) && options.ids.length ? options.ids.filter(id => allIds.includes(id)) : allIds;
  if (!ids.length) return null;
  const key = getGeminiApiKey();
  if (!key) return null;
  const body = new FormData(); body.append("file", file, file.name || `${mode}.jpg`); body.append("mode", mode); body.append("landmark_ids", JSON.stringify(ids));
  if (options.confirmed && typeof options.confirmed === "object") body.append("confirmed_landmarks", JSON.stringify(options.confirmed));
  if (options.targetId) body.append("target_landmark", options.targetId);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(LANDMARK_SUGGESTIONS_ENDPOINT, { method:"POST", headers:{"X-Gemini-Key":key,"Accept":"application/json"}, body, signal:controller.signal, cache:"no-store" });
    const rawText = await response.text(); let data = null; try { data = rawText ? JSON.parse(rawText) : null; } catch {}
    if (!response.ok || !data?.success) throw new Error(data?.detail || `AI landmark endpoint failed (${response.status})`);
    const clean = sanitizeAISuggestedLandmarks(data.landmarks, ids);
    console.info(`FaceMetric AI ${mode}: ${Object.keys(clean).length}/${ids.length}`, clean);
    window.__facemetricLandmarkDebug = { ...(window.__facemetricLandmarkDebug || {}), [mode]: { requested:ids.length, received:Object.keys(clean).length, workerCount:data.count ?? null, endpoint:LANDMARK_SUGGESTIONS_ENDPOINT } };
    return Object.keys(clean).length ? clean : null;
  } catch (error) {
    console.warn("FaceMetric: AI landmark suggestions unavailable.", error);
    window.__facemetricLandmarkDebug = { ...(window.__facemetricLandmarkDebug || {}), [mode]: { requested:ids.length, error:error?.message || String(error), endpoint:LANDMARK_SUGGESTIONS_ENDPOINT } };
    return null;
  } finally { clearTimeout(timeout); }
}

async function detectProfileLandmarksFromUrl(src) {
  if (!src) return null;
  try {
    const mesh = await detectFaceMeshFromSource(src);
    if (!mesh) return null;
    const out = {};
    for (const lm of PROFILE_LANDMARKS) {
      const index = PROFILE_AUTO_MP[lm.id];
      const pt = Number.isInteger(index) ? pointFromLm(mesh, index, 0.82) : null;
      if (pt) out[lm.id] = pt;
    }
    return Object.keys(out).length ? out : null;
  } catch (error) {
    console.warn("FaceMetric: profile auto landmark detection failed.", error);
    return null;
  }
}

async function detectFaceMeshFromSource(src) {
  if (!src) return null;
  const detector = await getFaceLandmarker();
  if (!detector) return null;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  try {
    if (img.decode) await img.decode();
    else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const result = detector.detect(img);
    const mesh = result?.faceLandmarks?.[0];
    return Array.isArray(mesh) && mesh.length >= 400 ? mesh : null;
  } catch (error) {
    console.warn("FaceMetric: automatic landmark detection failed for editor image.", error);
    return null;
  }
}

function seedFrontEditorFromMesh(mesh) {
  if (!Array.isArray(mesh) || mesh.length < 400) return 0;
  let count = 0;
  for (const lm of FRONT_LANDMARKS) {
    if (!Number.isInteger(lm.mp)) continue;
    const pt = pointFromLm(mesh, lm.mp, 0.82);
    if (!pt) continue;
    if (!confirmedFrontLandmarks[lm.id]) {
      confirmedFrontLandmarks[lm.id] = pt;
      count++;
    }
  }
  return count;
}

async function detectDenseFrontLandmarks() {
  if (!analysisImage) return null;
  if (!analysisImage.complete || !analysisImage.naturalWidth) {
    await new Promise(resolve => {
      const done = () => { analysisImage.removeEventListener("load", done); resolve(); };
      analysisImage.addEventListener("load", done, { once: true });
    });
  }
  const detector = await getFaceLandmarker();
  if (!detector) return null;
  try {
    let result = detector.detect(analysisImage);
    let mesh = result?.faceLandmarks?.[0];
    if (!Array.isArray(mesh) || mesh.length < 400) {
      mesh = await detectFaceMeshFromSource(selectedObjectUrl);
    }
    autoDetectedMesh = Array.isArray(mesh) && mesh.length >= 400 ? mesh : null;
    const landmarks = buildDenseFrontLandmarks(mesh);
    if (landmarks) {
      lastClientLandmarks = landmarks;
      return landmarks;
    }
  } catch (error) {
    console.warn("FaceMetric: dense landmark detection failed.", error);
    autoDetectedMesh = null;
  }
  return null;
}

function mergeClientFrontLandmarks(result, dense) {
  if (!result || !dense) return result;
  const front = result.views?.front;
  if (!front) return result;
  front.landmarks = { ...(front.landmarks || {}), ...dense };
  front.landmarks_count = Object.keys(front.landmarks).length;
  result.landmarks = { ...(result.landmarks || {}), ...dense };
  result.landmarks_count = Object.keys(result.landmarks).length;
  result.landmark_source = "mediapipe-face-landmarker";
  result.landmark_detector = {
    name: "MediaPipe Face Landmarker",
    version: FACE_LANDMARKER_VERSION,
    geometric_points: Object.keys(dense).length
  };
  return result;
}

function applySameAlignmentTransform(element, alignment, frameElement = null) {
  if (!element || !alignment?.available) return;
  const rect = (frameElement || element.parentElement || element).getBoundingClientRect();
  const tx = (0.5 - Number(alignment.center_x || 0.5)) * rect.width;
  const ty = (0.5 - Number(alignment.center_y || 0.5)) * rect.height;
  const rotate = Number(alignment.correction_degrees) || 0;
  const scale = Number(alignment.scale) || 1;
  element.style.transformOrigin = "50% 50%";
  element.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
}

function handleFileSelected(file) {
  closeCaptureFlow();
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

  // New front photo → clear previous profile so it does not carry over
  selectedProfileFile = null;
  revokeSelectedProfileObjectUrl();
  if (profileUploadName) profileUploadName.textContent = "Необязательно · профиль войдёт в общий рейтинг";
  if (profileFileInput) profileFileInput.value = "";

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
  // Hide loading block until user starts analysis
  if (loadingContent) {
    loadingContent.classList.add("is-hidden");
    loadingContent.hidden = true;
  }
  showScreen("analysis");

  setAnalysisState("ГОТОВО К АНАЛИЗУ");
  showProfileUploadControl();
  updateDualPhotoStrip();
  updateAnalysisButtonState();

  // Offer profile guide only if no profile yet
  window.setTimeout(() => {
    if (selectedFile === file && !selectedProfileFile) {
      openProfileCaptureFlow();
    }
  }, 280);

  showToast("Анфас загружен. Можно добавить профиль или сразу начать анализ.");
}

function revokeProfileWorkingObjectUrl() {
  if (profileWorkingObjectUrl) { try { URL.revokeObjectURL(profileWorkingObjectUrl); } catch {} }
  profileWorkingObjectUrl = null;
}

async function renderProfileWorkingFile(file, rotation = profileRotationDegrees, mirrored = profileMirrored) {
  const bitmap = await createImageBitmap(file);
  const rad = rotation * Math.PI / 180;
  const c = document.createElement("canvas");
  // keep a stable square-ish bounding box so rotation never clips the profile
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  c.width = Math.ceil(bitmap.width * cos + bitmap.height * sin);
  c.height = Math.ceil(bitmap.width * sin + bitmap.height * cos);
  const ctx = c.getContext("2d");
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rad);
  ctx.scale(mirrored ? -1 : 1, 1);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close?.();
  const blob = await new Promise(resolve => c.toBlob(resolve, "image/jpeg", .96));
  if (!blob) throw new Error("Не удалось подготовить профиль");
  return new File([blob], "profile-aligned.jpg", { type:"image/jpeg" });
}

async function openProfileAlignment() {
  if (!selectedProfileFile) return;
  profileRotationDegrees = 0;
  profileMirrored = false;
  // Normalize orientation before the user fine-tunes rotation: MediaPipe nose
  // point is compared with the visible ear-side point. If the nose points left,
  // mirror into the canonical "nose right" coordinate system.
  try {
    const mesh = await detectFaceMeshFromSource(selectedProfileObjectUrl);
    const nose = mesh?.[1], earSide = mesh?.[234] || mesh?.[454];
    if (nose && earSide && Number(nose.x) < Number(earSide.x)) profileMirrored = true;
  } catch (e) { console.warn("Profile orientation auto-detect unavailable", e); }
  const img = document.getElementById("profile-align-image");
  if (img) { img.src = selectedProfileObjectUrl; img.style.transform = "rotate(0deg) scaleX(1)"; }
  const range = document.getElementById("profile-rotate-range");
  if (range) range.value = 0;
  updateProfileAlignmentUI();
  showScreen("profile-align");
}
function updateProfileAlignmentUI() {
  const angle = document.getElementById("profile-rotate-value");
  const img = document.getElementById("profile-align-image");
  const range = document.getElementById("profile-rotate-range");
  if (angle) angle.textContent = `${profileRotationDegrees.toFixed(1)}°`;
  if (range) range.value = profileRotationDegrees;
  if (img) img.style.transform = `rotate(${profileRotationDegrees}deg) scaleX(${profileMirrored ? -1 : 1})`;
}
async function confirmProfileAlignment() {
  if (!selectedProfileFile) return;
  const button = document.getElementById("profile-align-confirm");
  if (button) { button.disabled = true; button.textContent = "ПОДГОТАВЛИВАЕМ…"; }
  try {
    profileWorkingFile = await renderProfileWorkingFile(selectedProfileFile);
    revokeProfileWorkingObjectUrl();
    profileWorkingObjectUrl = URL.createObjectURL(profileWorkingFile);
    // Canonical source from this point on.
    pendingProfileFile = profileWorkingFile;
    await openProfileLandmarkEditorWithAutoSuggestions();
  } catch (e) {
    console.error(e); showToast("Не удалось выровнять профиль.");
  } finally { if (button) { button.disabled = false; button.textContent = "ВЫГЛЯДИТ РОВНО"; } }
}

function handleProfileFileSelected(file) {
  closeCaptureFlow();
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
  updateDualPhotoStrip();
  updateAnalysisButtonState();
  showToast("Профиль добавлен. Выровняйте его перед разметкой.");
}

function showProfileUploadControl() {
  const card = document.getElementById("profile-upload-card");
  if (!card) return;
  // Hide "add profile" once profile is already present — dual strip shows both
  if (selectedProfileFile) {
    card.hidden = true;
    card.classList.remove("is-ready");
  } else {
    card.hidden = false;
    card.classList.add("is-ready");
  }
}

function updateDualPhotoStrip() {
  const strip = document.getElementById("dual-photo-strip");
  const frontImg = document.getElementById("dual-front-img");
  const profileImg = document.getElementById("dual-profile-img");
  const profileLabel = document.getElementById("dual-profile-label");
  const addBtn = document.getElementById("dual-add-profile");
  const profileCard = document.getElementById("profile-upload-card");
  const mainPreview = document.querySelector("#screen-analysis .analysis-preview");

  if (!strip) return;

  if (!selectedObjectUrl) {
    strip.hidden = true;
    strip.classList.remove("has-profile");
    if (mainPreview) mainPreview.hidden = false;
    return;
  }

  // Dual strip replaces the large single preview until analysis runs
  strip.hidden = false;
  if (mainPreview) mainPreview.hidden = true;

  if (frontImg) {
    frontImg.src = selectedObjectUrl;
    frontImg.hidden = false;
  }

  const hasProfile = Boolean(selectedProfileFile && selectedProfileObjectUrl);
  strip.classList.toggle("has-profile", hasProfile);

  if (hasProfile) {
    if (profileImg) {
      profileImg.src = selectedProfileObjectUrl;
      profileImg.hidden = false;
    }
    if (addBtn) {
      addBtn.hidden = true;
      addBtn.style.display = "none";
      addBtn.setAttribute("aria-hidden", "true");
    }
    if (profileLabel) profileLabel.textContent = "ПРОФИЛЬ";
    if (profileCard) profileCard.hidden = true;
  } else {
    if (profileImg) {
      profileImg.removeAttribute("src");
      profileImg.hidden = true;
    }
    if (addBtn) {
      addBtn.hidden = false;
      addBtn.style.display = "";
      addBtn.removeAttribute("aria-hidden");
    }
    if (profileLabel) profileLabel.textContent = "ПРОФИЛЬ";
    if (profileCard) {
      profileCard.hidden = true; // dual strip already has +
      profileCard.classList.remove("is-ready");
    }
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
  }, 380);
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
  const score = getMetricNumericScore(metric);
  if (score !== null) {
    if (score < 5) return "#ff5368";
    if (score < 7) return "#f2c75c";
    return "#55d98b";
  }

  const status = String(metric?.value?.status || "").toLowerCase();
  if (status === "poor") return "#ff5368";
  if (status === "average") return "#f2c75c";
  if (status === "good") return "#55d98b";
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

  // Gemini is allowed to choose the landmark names for the metric.
  // Once it returns them, the renderer uses those exact client landmark
  // coordinates instead of guessing a different geometry in the frontend.
  const aiNames = Array.isArray(selectedNames)
    ? selectedNames.filter(Boolean)
    : [];

  if (aiNames.length >= 2) {
    return aiNames.slice(0, -1).map((name, i) => [name, aiNames[i + 1]]);
  }

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


function getMetricFocusConfig(key, viewType = "front") {
  const k = String(key || "").split(".").pop().toLowerCase();
  if (viewType === "profile") {
    const profile = {
      nasofacial_angle: { landmarks:["profile_glabella","profile_nasion","profile_pronasale"], zoom:2.05 },
      nasolabial_angle: { landmarks:["profile_pronasale","profile_subnasale","profile_labiale_superius"], zoom:2.35 },
      gonial_angle: { landmarks:["profile_pogonion","profile_gonion","profile_chin_neck"], zoom:1.9 },
      nose_chin_projection: { landmarks:["profile_nasion","profile_pronasale","profile_pogonion"], zoom:2.0 },
      profile_projection_balance: { landmarks:["profile_pronasale","profile_labiale_superius","profile_pogonion"], zoom:1.85 },
      profile_harmony: { landmarks:["profile_glabella","profile_nasion","profile_pronasale","profile_pogonion","profile_menton"], zoom:1.45 }
    };
    return profile[k] || { landmarks:[], zoom:1.35 };
  }
  const exact = {
    face_aspect_ratio:{landmarks:["left_cheekbone","right_cheekbone","forehead_center","chin"],zoom:1.18},
    total_facial_width_to_height_ratio:{landmarks:["left_cheekbone","right_cheekbone","forehead_center","chin"],zoom:1.18},
    face_width_to_height_ratio:{landmarks:["left_cheekbone","right_cheekbone","forehead_center","chin"],zoom:1.18},
    brow_length_to_face_width_ratio:{landmarks:["left_brow_inner","left_brow_outer","right_brow_inner","right_brow_outer"],zoom:1.8},
    eyebrow_low_settedness:{landmarks:["left_brow_inner","left_brow_outer","right_brow_inner","right_brow_outer","left_eye_inner","right_eye_inner"],zoom:1.95},
    brow_symmetry:{landmarks:["left_brow_inner","left_brow_outer","right_brow_inner","right_brow_outer"],zoom:1.95},
    eye_separation_ratio:{landmarks:["left_eye_inner","right_eye_inner"],zoom:2.1},
    eye_spacing:{landmarks:["left_eye_inner","right_eye_inner"],zoom:2.1},
    one_eye_apart_test:{landmarks:["left_eye_inner","right_eye_inner","left_eye_outer","right_eye_outer"],zoom:2.0},
    eye_aspect_ratio:{landmarks:["left_eye_inner","left_eye_outer","right_eye_inner","right_eye_outer"],zoom:2.15},
    lateral_canthal_tilt:{landmarks:["left_eye_inner","left_eye_outer","right_eye_inner","right_eye_outer"],zoom:2.1},
    eye_alignment:{landmarks:["left_eye_inner","right_eye_inner"],zoom:2.0},
    nose_width:{landmarks:["nose_left","nose_right","nose_tip"],zoom:2.2},
    intercanthal_nasal_width_ratio:{landmarks:["left_eye_inner","right_eye_inner","nose_left","nose_right"],zoom:2.05},
    mouth_width_to_nose_width_ratio:{landmarks:["mouth_left","mouth_right","nose_left","nose_right"],zoom:2.0},
    mouth_width:{landmarks:["mouth_left","mouth_right"],zoom:2.35},
    lower_lip_to_upper_lip_ratio:{landmarks:["upper_lip_center","lower_lip_center","mouth_left","mouth_right"],zoom:2.4},
    mouth_corner_position:{landmarks:["mouth_left","mouth_right","upper_lip_center","lower_lip_center"],zoom:2.35},
    mouth_symmetry:{landmarks:["mouth_left","mouth_right","upper_lip_center","lower_lip_center"],zoom:2.25},
    nose_length:{landmarks:["nose_bridge","nose_tip"],zoom:2.2},
    nose_tip_position:{landmarks:["nose_bridge","nose_tip","nose_left","nose_right"],zoom:2.25},
    tip_rotation_angle:{landmarks:["nose_bridge","nose_tip","upper_lip_center"],zoom:2.15},
    ipsilateral_alar_angle:{landmarks:["nose_left","nose_tip","upper_lip_center"],zoom:2.15},
    jaw_width:{landmarks:["left_jaw","right_jaw"],zoom:1.65},
    jaw_symmetry:{landmarks:["left_jaw","right_jaw","chin"],zoom:1.65},
    jaw_frontal_angle:{landmarks:["left_cheekbone","left_jaw","chin","right_jaw","right_cheekbone"],zoom:1.55},
    jaw_angle:{landmarks:["left_cheekbone","left_jaw","chin","right_jaw","right_cheekbone"],zoom:1.55},
    cheekbone_height:{landmarks:["left_cheekbone","right_cheekbone","left_eye_inner","right_eye_inner"],zoom:1.7},
    cheekbone_prominence:{landmarks:["left_cheekbone","right_cheekbone","left_jaw","right_jaw"],zoom:1.65},
    cheek_symmetry:{landmarks:["left_cheekbone","right_cheekbone"],zoom:1.7},
    chin_width:{landmarks:["left_jaw","chin","right_jaw"],zoom:1.75},
    chin_definition:{landmarks:["left_jaw","chin","right_jaw"],zoom:1.8},
    chin_to_philtrum_ratio:{landmarks:["upper_lip_center","chin"],zoom:1.95},
    midface_ratio:{landmarks:["left_eye_inner","right_eye_inner","upper_lip_center","chin"],zoom:1.55},
    mid_to_lower_face:{landmarks:["left_eye_inner","right_eye_inner","upper_lip_center","chin"],zoom:1.55},
    top_third:{landmarks:["forehead_center","left_eye_inner","right_eye_inner"],zoom:1.55},
    upper_to_lower_third:{landmarks:["forehead_center","left_eye_inner","right_eye_inner","chin"],zoom:1.4},
    symmetry:{landmarks:["left_eye_inner","right_eye_inner","mouth_left","mouth_right","left_jaw","right_jaw"],zoom:1.3},
    overall_symmetry:{landmarks:["left_eye_inner","right_eye_inner","mouth_left","mouth_right","left_jaw","right_jaw"],zoom:1.3},
    neck_width:{landmarks:["left_jaw","right_jaw","chin"],zoom:1.25},
    ear_protrusion_ratio:{landmarks:["left_cheekbone","right_cheekbone"],zoom:1.2},
    facial_depth:{landmarks:["profile_nasion","profile_pronasale","profile_pogonion"],zoom:1.6}
  };
  if (exact[k]) return exact[k];
  if (/brow|eyebrow/.test(k)) return {landmarks:["left_brow_inner","left_brow_outer","right_brow_inner","right_brow_outer"],zoom:1.9};
  if (/eye|canthal|intercanthal/.test(k)) return {landmarks:["left_eye_inner","left_eye_outer","right_eye_inner","right_eye_outer"],zoom:2.0};
  if (/nose|alar|nasal|tip/.test(k)) return {landmarks:["nose_bridge","nose_tip","nose_left","nose_right"],zoom:2.15};
  if (/mouth|lip|philtrum/.test(k)) return {landmarks:["mouth_left","mouth_right","upper_lip_center","lower_lip_center"],zoom:2.25};
  if (/jaw|chin|gonial/.test(k)) return {landmarks:["left_cheekbone","left_jaw","chin","right_jaw","right_cheekbone"],zoom:1.6};
  if (/cheek|midface|third/.test(k)) return {landmarks:["left_cheekbone","right_cheekbone","left_eye_inner","right_eye_inner","chin"],zoom:1.5};
  return {landmarks:[],zoom:1.25};
}

function getMetricFocusPoints(metric, view) {
  const config = getMetricFocusConfig(metric?.key, view?.type === "profile" ? "profile" : "front");
  const points = getOverlayPoints(view);
  const names = (Array.isArray(metric?.value?.landmarks) && metric.value.landmarks.length)
    ? metric.value.landmarks
    : config.landmarks;
  return names.filter(name => points[name]).map(name => ({ name, ...points[name] }));
}

function animateMetricLine(canvas, view, metric, duration = 720) {
  if (!canvas || !view || !metric) return;
  const start = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const frame = now => {
    const t = Math.min(1, (now - start) / duration);
    drawFaceLandmarkNetwork(canvas, view, metric, ease(t));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function animateMetricFocus(metric) {
  const visual = document.getElementById("result-visual");
  if (!visual || !currentAnalysis || !metric) return;
  const media = visual.querySelector(".result-visual__media");
  const canvas = document.getElementById("result-landmark-canvas");
  const image = visual.querySelector(".result-visual__image");
  const view = getActiveView(currentAnalysis) || currentAnalysis.frontal || {};
  const points = getMetricFocusPoints(metric, view);
  const config = getMetricFocusConfig(metric.key, view?.type === "profile" ? "profile" : "front");
  if (!media || !canvas || !points.length) {
    drawResultMetricOverlay(metric);
    return;
  }

  const rect = media.getBoundingClientRect();
  const px = points.reduce((s,p) => s + Number(p.x), 0) / points.length;
  const py = points.reduce((s,p) => s + Number(p.y), 0) / points.length;
  const scale = Math.max(1.05, Math.min(2.65, Number(config.zoom) || 1.25));
  const tx = (0.5 - px) * rect.width * (scale - 1);
  const ty = (0.5 - py) * rect.height * (scale - 1);

  media.style.setProperty("--metric-focus-x", `${tx.toFixed(1)}px`);
  media.style.setProperty("--metric-focus-y", `${ty.toFixed(1)}px`);
  media.style.setProperty("--metric-focus-scale", scale.toFixed(3));
  media.classList.remove("metric-focus-zoom");
  void media.offsetWidth;
  media.classList.add("metric-focus-zoom");

  image?.classList.add("metric-image-focus");
  window.setTimeout(() => image?.classList.remove("metric-image-focus"), 900);

  animateMetricLine(canvas, view, metric, 720);

  let hud = visual.querySelector(".metric-focus-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.className = "metric-focus-hud";
    media.appendChild(hud);
  }
  const numeric = getMetricNumericScore(metric);
  const score = numeric === null ? "—" : `${formatMetricScore(numeric)}/10`;
  hud.innerHTML = `<span class="metric-focus-hud__eyebrow">LIVE METRIC</span><strong>${getRussianLabel(metric.key)}</strong><b>${score}</b>`;
  hud.dataset.level = numeric === null ? "neutral" : getMetricLevel(numeric);
  hud.classList.remove("is-visible");
  void hud.offsetWidth;
  hud.classList.add("is-visible");

  window.clearTimeout(animateMetricFocus._timer);
  animateMetricFocus._timer = window.setTimeout(() => {
    media.classList.remove("metric-focus-zoom");
    hud?.classList.remove("is-visible");
  }, 2200);
}

function getOverlayImageForCanvas(canvas) {
  if (!canvas) return null;
  if (canvas.id === "result-landmark-canvas") return $(".result-visual__image", canvas.parentElement || document);
  return analysisImage;
}

function getImageContentBox(image, frameWidth, frameHeight) {
  if (!image || !image.naturalWidth || !image.naturalHeight) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }
  const style = getComputedStyle(image);
  const fit = style.objectFit || "fill";
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (fit === "fill") return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  const containScale = Math.min(frameWidth / iw, frameHeight / ih);
  const coverScale = Math.max(frameWidth / iw, frameHeight / ih);
  const scale = fit === "cover" ? coverScale : containScale;
  const width = iw * scale;
  const height = ih * scale;
  return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height };
}


/* ============================================================
   CONFIRMED LANDMARK METRIC PIPELINE
   The Landmark Editor is the authoritative geometric source.
============================================================ */
const METRIC_DEFINITIONS = {
  jaw_width:{view:"front",landmarks:["left_jaw","right_jaw"],measurement:"distance"},
  nose_width:{view:"front",landmarks:["nose_left","nose_right"],measurement:"distance"},
  nose_length:{view:"front",landmarks:["nose_bridge","nose_tip"],measurement:"distance"},
  mouth_width:{view:"front",landmarks:["mouth_left","mouth_right"],measurement:"distance"},
  eye_spacing:{view:"front",landmarks:["left_eye_inner","right_eye_inner"],measurement:"distance"},
  face_aspect_ratio:{view:"front",landmarks:["left_cheekbone","right_cheekbone","forehead_center","chin"],measurement:"ratio"},
  nasofacial_angle:{view:"profile",landmarks:["profile_glabella","profile_nasion","profile_pronasale"],measurement:"angle"},
  nasolabial_angle:{view:"profile",landmarks:["profile_pronasale","profile_subnasale","profile_labiale_superius"],measurement:"angle"},
  gonial_angle:{view:"profile",landmarks:["profile_pogonion","profile_gonion","profile_chin_neck"],measurement:"angle"},
  nose_chin_projection:{view:"profile",landmarks:["profile_nasion","profile_pronasale","profile_pogonion"],measurement:"projection"}
};
function fmDist(a,b){return Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));}
function fmAngle(a,b,c){const u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y};const d=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);return d?Math.acos(clamp((u.x*v.x+u.y*v.y)/d,-1,1))*180/Math.PI:null;}
function fmMeasure(def,pts){if(def.measurement==="distance")return fmDist(pts[0],pts[1]);if(def.measurement==="ratio"){const w=fmDist(pts[0],pts[1]),h=fmDist(pts[2],pts[3]);return h?w/h:null;}if(def.measurement==="angle")return fmAngle(pts[0],pts[1],pts[2]);if(def.measurement==="projection")return fmDist(pts[0],pts[1])/(fmDist(pts[0],pts[2])||1);return null;}
function enrichMetricsFromConfirmedLandmarks(result){
  if(!result||!result.metrics)return result;
  const views=result.views||{};
  const walk=(obj,path=[])=>{if(!obj||typeof obj!=="object")return;
    Object.entries(obj).forEach(([k,v])=>{const def=METRIC_DEFINITIONS[k];if(def&&v&&typeof v==="object"){
      const lm=(def.view==="profile"?views.profile:views.front)?.landmarks||{};
      const pts=def.landmarks.map(n=>lm[n]); const ok=pts.every(p=>p&&Number.isFinite(+p.x)&&Number.isFinite(+p.y));
      v.landmarks=[...def.landmarks]; v.view=def.view;
      if(ok){const measurement=fmMeasure(def,pts); if(measurement!==null){v.measurement=measurement;v.measurement_source="confirmed_landmarks";v.status=v.status||"measured";}}
      else if(!v.score && v.status==="insufficient data") v.status="insufficient data";
    } else if(v&&typeof v==="object")walk(v,path.concat(k));});
  };walk(result.metrics);return result;
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
  const overlayImage = getOverlayImageForCanvas(canvas);
  const contentBox = getImageContentBox(overlayImage, width, height);
  const xy = name => ({
    x: contentBox.x + Number(points[name].x) * contentBox.width,
    y: contentBox.y + Number(points[name].y) * contentBox.height
  });

  const selectedNames = metric
    ? (Array.isArray(metric.value?.landmarks) && metric.value.landmarks.length
        ? metric.value.landmarks
        : getMetricLandmarkNames(metric.key, viewType))
    : names;

  const pairs = viewType === "profile"
    ? [["profile_forehead","profile_glabella"],["profile_glabella","profile_nasion"],["profile_nasion","profile_pronasale"],["profile_pronasale","profile_subnasale"],["profile_subnasale","profile_labiale_superius"],["profile_labiale_superius","profile_labiale_inferius"],["profile_labiale_inferius","profile_pogonion"],["profile_pogonion","profile_menton"],["profile_menton","profile_chin_neck"]]
    : [["left_eye_outer","left_eye_inner"],["left_eye_inner","right_eye_inner"],["right_eye_inner","right_eye_outer"],["left_brow_inner","left_brow_outer"],["right_brow_inner","right_brow_outer"],["nose_bridge","nose_tip"],["nose_left","nose_tip"],["nose_tip","nose_right"],["mouth_left","mouth_right"],["forehead_center","nose_bridge"],["nose_bridge","upper_lip_center"],["upper_lip_center","lower_lip_center"],["lower_lip_center","chin"],["left_cheekbone","left_jaw"],["left_jaw","chin"],["chin","right_jaw"],["right_jaw","right_cheekbone"]];

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
    const value = getMetricNumericScore(metric);
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
  if (!getClassificationSettings() || !adultConfirmed) {
    openClassificationModal();
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

    // Reuse the exact landmarks detected before the API request.
    // This avoids running MediaPipe twice for the same image and keeps the
    // Worker and frontend on one coordinate set.
    try {
      mergeClientFrontLandmarks(result, lastClientLandmarks);
    } catch (error) {
      console.warn("FaceMetric: landmark merge skipped.", error);
    }

    // The profile editor already has user-confirmed coordinates. Keep them in
    // the final result so the profile view cannot silently disappear after a
    // successful two-photo analysis.
    if (
      profileFile &&
      confirmedProfileLandmarks &&
      Object.keys(confirmedProfileLandmarks).length
    ) {
      result.views = result.views || {};
      result.views.profile = result.views.profile || {};
      result.views.profile.landmarks = {
        ...(result.views.profile.landmarks || {}),
        ...confirmedProfileLandmarks
      };
      result.views.profile.available = true;
      result.views.profile.confirmed = true;
      result.profile = result.profile || {};
      result.profile.available = true;
      result.profile.confirmed = true;
    }

    // Recalculate alignment from the final geometric landmarks so the image,
    // canvas and downstream measurements all share the same coordinate frame.
    result.alignment = normalizeAlignmentSet(
      result.alignment,
      result.views?.front?.landmarks || result.landmarks || {},
      result.views?.profile?.landmarks || {}
    );

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

    enrichMetricsFromConfirmedLandmarks(result);

    currentAnalysis = result;
    resetMetricSelection();
    applyAnalysisAlignment(result);
    requestAnimationFrame(() => animateAnalysisNetwork(result));
    if (alignmentStatus) {
      alignmentStatus.textContent = "ЛИЦО ВЫРОВНЕНО ✓";
      alignmentStatus.dataset.state = "done";
    }
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

  // Detect precise front landmarks before the server analysis so the Worker
  // can use the same coordinates when producing geometry metrics.
  // Confirmed manual landmarks are authoritative. Never overwrite them with a
  // second automatic MediaPipe pass after the user has placed the points.
  let denseLandmarks = window.__facemetricClientLandmarks || lastClientLandmarks;
  if (!denseLandmarks || !Object.keys(denseLandmarks).length) {
    try {
      denseLandmarks = await detectDenseFrontLandmarks();
    } catch (error) {
      console.warn("FaceMetric: pre-analysis landmark detection skipped.", error);
    }
  }
  if (denseLandmarks && Object.keys(denseLandmarks).length) {
    formData.append("client_landmarks", JSON.stringify(denseLandmarks));
  }

  if (profileFile) {
    formData.append(
      "profile",
      profileFile,
      profileFile.name || "profile.jpg"
    );

    // The profile landmark editor stores coordinates separately from front
    // landmarks. Send the confirmed profile geometry with the actual profile
    // image so the Worker can use both views in the same analysis.
    if (
      confirmedProfileLandmarks &&
      Object.keys(confirmedProfileLandmarks).length
    ) {
      formData.append(
        "client_profile_landmarks",
        JSON.stringify(confirmedProfileLandmarks)
      );
    }

    formData.append("profile_confirmed", "true");
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
      getScoreClassification(
        score,
        source.gender === "female" || source.gender === "male"
          ? source.gender
          : selectedGender
      ) || normalizeClassification(
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

function applyImageAlignment(image, alignment, frameElement = null) {
  if (!image || !alignment?.available) return;
  const rect = (frameElement || image.parentElement || image).getBoundingClientRect();
  const tx = (0.5 - Number(alignment.center_x || 0.5)) * rect.width;
  const ty = (0.5 - Number(alignment.center_y || 0.5)) * rect.height;
  const rotate = Number(alignment.correction_degrees) || 0;
  const scale = Number(alignment.scale) || 1;
  image.style.transformOrigin = "50% 50%";
  image.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
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
    applySameAlignmentTransform(analysisImage, alignment, analysisFrame);
    applySameAlignmentTransform(landmarkCanvas, alignment, analysisFrame);
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

  renderHealth(result.metrics);

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
      requestAnimationFrame(() => {
        applySameAlignmentTransform(image, alignment, visual);
        const resultCanvas = $("#result-landmark-canvas", visual);
        applySameAlignmentTransform(resultCanvas, alignment, visual);
      });
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
      const hasScore = Number.isFinite(Number(value.score));
      const hasValue = Number.isFinite(Number(value.value));
      // Do not render placeholder/insufficient rows as if they were measurements.
      if (hasScore || hasValue) result.push([path, value]);
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
  const metricObject = isObject(value) && Object.prototype.hasOwnProperty.call(value, "score")
    ? value
    : null;

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

  const numeric = normalizeMetricValue(metricObject ? metricObject.score : value);
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
    normalizeMetricValue(value);

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

  const visual =
    document.createElement(
      "div"
    );

  visual.className =
    "metric-inspector__visual";

  const face =
    document.createElement(
      "div"
    );

  face.className =
    "metric-inspector__face";

  const zoneElement =
    document.createElement(
      "div"
    );

  zoneElement.className =
    "metric-inspector__zone";

  zoneElement.dataset.zone =
    zone.key;

  face.appendChild(
    zoneElement
  );

  visual.appendChild(
    face
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
    visual,
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
  const alignment = currentAnalysis?.alignment?.[view?.type === "profile" ? "profile" : "front"];
  if (alignment?.available) applySameAlignmentTransform(canvas, alignment, visual);
}

function getMetricNumericScore(metric) {
  if (!metric) return null;
  const value = metric.value;

  // The score is the only value that belongs on the 0–10 UI scale.
  // Never mistake a raw ratio/degree/percentage measurement for a score.
  if (isObject(value)) {
    const explicit = normalizeMetricValue(value.score);
    if (explicit !== null && explicit >= 0 && explicit <= 10) {
      return explicit;
    }

    // Graceful fallback for older payloads that omitted `score` but did
    // provide a qualitative status.
    const status = String(value.status || "").toLowerCase();
    if (status === "good") return 8;
    if (status === "average") return 6;
    if (status === "poor") return 3.5;
  }

  return null;
}

function getMetricRawLandmarks(metric) {
  if (!metric || !isObject(metric.value)) return [];
  return Array.isArray(metric.value.landmarks) ? metric.value.landmarks : [];
}

function getMetricReferenceItems() {
  return $$(".scale-card[data-metric]")
    .map(card => ({
      key: card.dataset.metric,
      value: currentAnalysis?.metrics
        ? getNestedValue(currentAnalysis.metrics, card.dataset.metric)
        : null
    }))
    .filter(item => item.key);
}

function getNestedValue(object, path) {
  if (!object || !path) return null;
  return String(path).split(".").reduce((acc, part) => acc == null ? null : acc[part], object);
}

function metricReferenceGradient(score) {
  const value = score == null ? 0 : clamp(score, 0, 10);
  return `linear-gradient(90deg, #d84d63 0%, #d7a84a 48%, #4fc98b 100%)`;
}

function metricReferenceGraph(score) {
  const value = score == null ? 5 : clamp(score, 0, 10);
  const x = 24 + value * 15.2;
  return `
    <svg class="metric-reference-graph" viewBox="0 0 200 76" aria-hidden="true">
      <path class="metric-reference-axis" d="M12 62H188" />
      <path class="metric-reference-curve" d="M12 62 C42 62 45 16 100 16 C155 16 158 62 188 62" />
      <path class="metric-reference-fill" d="M12 62 C42 62 45 16 100 16 C155 16 158 62 188 62 Z" />
      <line class="metric-reference-marker" x1="${x}" y1="10" x2="${x}" y2="62" />
      <circle class="metric-reference-dot" cx="${x}" cy="10" r="3.5" />
    </svg>`;
}

function animateMetricReferenceScore(element, target) {
  if (!element) return;
  if (!Number.isFinite(target)) {
    element.textContent = "—";
    return;
  }
  const start = performance.now();
  const duration = 700;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const tick = now => {
    const p = Math.min(1, (now - start) / duration);
    element.textContent = `${formatMetricScore(target * ease(p))}`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function closeMetricReferenceViewer() {
  const modal = document.getElementById("metric-reference-viewer");
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.classList.remove("metric-reference-open");
  if (window.__faceMetricReferenceKeyHandler) {
    document.removeEventListener("keydown", window.__faceMetricReferenceKeyHandler);
    window.__faceMetricReferenceKeyHandler = null;
  }
  window.setTimeout(() => modal.remove(), 260);
}

function openMetricReferenceViewer(metric) {
  if (!metric || !currentAnalysis) return;

  closeMetricReferenceViewer();

  const view = getActiveView(currentAnalysis) || currentAnalysis.frontal || { type: "front", landmarks: {} };
  const source = getViewImageSource(view);
  const score = getMetricNumericScore(metric);
  const value = metric?.value;
  const zone = getMetricZone(metric.key);
  const focus = getMetricFocusConfig(metric.key, view?.type === "profile" ? "profile" : "front");
  const points = getMetricFocusPoints(metric, view);
  const items = getMetricReferenceItems();
  const index = Math.max(0, items.findIndex(item => item.key === metric.key));
  const prev = items[index - 1] || null;
  const next = items[index + 1] || null;

  const modal = document.createElement("div");
  modal.id = "metric-reference-viewer";
  modal.className = "metric-reference-viewer";
  modal.innerHTML = `
    <div class="metric-reference-viewer__backdrop" data-close-metric></div>
    <section class="metric-reference-viewer__dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(getRussianLabel(metric.key))}">
      <button class="metric-reference-viewer__close" type="button" data-close-metric aria-label="Закрыть">×</button>
      <button class="metric-reference-viewer__nav metric-reference-viewer__nav--prev" type="button" data-metric-prev ${prev ? "" : "disabled"} aria-label="Предыдущая метрика">‹</button>
      <button class="metric-reference-viewer__nav metric-reference-viewer__nav--next" type="button" data-metric-next ${next ? "" : "disabled"} aria-label="Следующая метрика">›</button>

      <div class="metric-reference-viewer__titlebar">
        <div>
          <span class="metric-reference-viewer__eyebrow">FACIAL METRIC</span>
          <h2>${escapeHtml(getRussianLabel(metric.key))}</h2>
        </div>
        <span class="metric-reference-viewer__index">${index + 1} / ${Math.max(items.length, 1)}</span>
      </div>

      <div class="metric-reference-viewer__body">
        <div class="metric-reference-viewer__visual-wrap">
          <div class="metric-reference-viewer__visual">
            <div class="metric-reference-viewer__media">
              <div class="metric-reference-viewer__zoom-layer">
                <img class="metric-reference-viewer__image" alt="Фокус метрики" src="${source || ""}">
                <canvas class="metric-reference-viewer__canvas" aria-hidden="true"></canvas>
              </div>
              <div class="metric-reference-viewer__scan"></div>
              <div class="metric-reference-viewer__corner c1"></div>
              <div class="metric-reference-viewer__corner c2"></div>
              <div class="metric-reference-viewer__corner c3"></div>
              <div class="metric-reference-viewer__corner c4"></div>
              <div class="metric-reference-viewer__metric-tag">${escapeHtml(getRussianLabel(metric.key))}</div>
            </div>
          </div>
        </div>

        <aside class="metric-reference-viewer__panel">
          <div class="metric-reference-scoreline">
            <div>
              <span>SCORE</span>
              <strong><b data-metric-score>—</b><small>/10</small></strong>
            </div>
            <span class="metric-reference-scoreline__status" data-metric-status>${score == null ? (value == null || String(value).trim() === "" ? "Недостаточно данных" : "Данные доступны") : getMetricStatus(score)}</span>
          </div>

          <div class="metric-reference-bar" style="--metric-position:${score == null ? 50 : score * 10}%; --metric-gradient:${metricReferenceGradient(score)}">
            <i></i>
          </div>

          <div class="metric-reference-tabs" role="tablist">
            <button class="is-active" type="button" data-ref-tab="overview">Обзор</button>
            <button type="button" data-ref-tab="geometry">Геометрия</button>
            <button type="button" data-ref-tab="interpretation">Интерпретация</button>
          </div>

          <div class="metric-reference-content is-active" data-ref-panel="overview">
            <span class="metric-reference-label">ABOUT THIS METRIC</span>
            <h3>${escapeHtml(zone.label || "Измерение лица")}</h3>
            <p>${escapeHtml(zone.description || "Метрика рассчитывается по видимым точкам лица и оценивается с учётом качества изображения.")}</p>
            <div class="metric-reference-mini">
              <span>LANDMARKS</span>
              <strong>${points.length || getMetricRawLandmarks(metric).length || "—"}</strong>
            </div>
          </div>

          <div class="metric-reference-content" data-ref-panel="geometry">
            <span class="metric-reference-label">LANDMARK GEOMETRY</span>
            <div class="metric-reference-landmarks">
              ${(points.length ? points : getMetricRawLandmarks(metric).map(name => ({name}))).map(p => `<span>${escapeHtml(String(p.name || "landmark"))}</span>`).join("") || `<em>Точки для этой метрики не определены.</em>`}
            </div>
            <p>Линии строятся по координатам landmark-модели. Gemini не должен произвольно перемещать эти точки.</p>
          </div>

          <div class="metric-reference-content" data-ref-panel="interpretation">
            <span class="metric-reference-label">INTERPRETATION</span>
            <h3 data-metric-interpretation>${score == null ? (value == null || String(value).trim() === "" ? "Недостаточно данных" : "Данные доступны") : getMetricStatus(score)}</h3>
            <p>Значение отображается вместе с визуальной геометрией и шкалой. Для метрик, требующих другого ракурса, используется соответствующий view.</p>
            ${metricReferenceGraph(score)}
          </div>
        </aside>
      </div>
    </section>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("metric-reference-open");

  const media = modal.querySelector(".metric-reference-viewer__media");
  const zoomLayer = modal.querySelector(".metric-reference-viewer__zoom-layer");
  const image = modal.querySelector(".metric-reference-viewer__image");
  const canvas = modal.querySelector(".metric-reference-viewer__canvas");
  const tag = modal.querySelector(".metric-reference-viewer__metric-tag");
  const scoreElement = modal.querySelector("[data-metric-score]");

  const focusApply = () => {
    if (!media || !zoomLayer || !canvas || !image) return;
    const frame = media.getBoundingClientRect();
    const px = points.length ? points.reduce((sum, p) => sum + Number(p.x || 0.5), 0) / points.length : 0.5;
    const py = points.length ? points.reduce((sum, p) => sum + Number(p.y || 0.5), 0) / points.length : 0.5;
    const scale = Math.max(1, Math.min(2.25, Number(focus.zoom) || 1.25));
    const tx = (0.5 - px) * frame.width * (scale - 1);
    const ty = (0.5 - py) * frame.height * (scale - 1);

    zoomLayer.style.setProperty("--ref-focus-x", `${tx.toFixed(1)}px`);
    zoomLayer.style.setProperty("--ref-focus-y", `${ty.toFixed(1)}px`);
    zoomLayer.style.setProperty("--ref-focus-scale", scale.toFixed(3));

    const alignment = currentAnalysis?.alignment?.[view?.type === "profile" ? "profile" : "front"];
    if (alignment?.available) {
      applySameAlignmentTransform(zoomLayer, alignment, media);
    } else {
      zoomLayer.style.transform = "none";
    }

    drawFaceLandmarkNetwork(canvas, view, metric, 0);
    requestAnimationFrame(() => {
      zoomLayer.classList.add("is-focused");
      animateMetricLine(canvas, view, metric, 760);
      tag?.classList.add("is-visible");
    });
  };

  if (image?.complete) {
    requestAnimationFrame(focusApply);
  } else {
    image?.addEventListener("load", focusApply, { once: true });
  }

  animateMetricReferenceScore(scoreElement, score);

  modal.querySelectorAll("[data-close-metric]").forEach(el => el.addEventListener("click", closeMetricReferenceViewer));
  modal.querySelector("[data-metric-prev]")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (prev) openMetricReferenceViewer(prev);
  });
  modal.querySelector("[data-metric-next]")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (next) openMetricReferenceViewer(next);
  });
  modal.querySelectorAll("[data-ref-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.refTab;
      modal.querySelectorAll("[data-ref-tab]").forEach(b => b.classList.toggle("is-active", b === button));
      modal.querySelectorAll("[data-ref-panel]").forEach(panel => panel.classList.toggle("is-active", panel.dataset.refPanel === target));
    });
  });

  window.__faceMetricReferenceKeyHandler = event => {
    if (!document.getElementById("metric-reference-viewer")) return;
    if (event.key === "Escape") closeMetricReferenceViewer();
    if (event.key === "ArrowLeft" && prev) openMetricReferenceViewer(prev);
    if (event.key === "ArrowRight" && next) openMetricReferenceViewer(next);
  };
  document.addEventListener("keydown", window.__faceMetricReferenceKeyHandler);
  window.setTimeout(() => {
    modal.classList.add("is-open");
    modal.querySelector(".metric-reference-viewer__dialog")?.focus?.();
  }, 20);
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
    const metricNames = Array.isArray(value?.landmarks) ? value.landmarks : [];
    const isProfileMetric = metricNames.some(name => String(name).startsWith("profile_"));
    if (isProfileMetric && currentAnalysis.has_profile && activeResultView !== "profile") {
      activeResultView = "profile";
      ensureResultFace(currentAnalysis);
      renderViewSelector(currentAnalysis);
    }
    renderMetricInspector(currentAnalysis);
    drawMetricOverlay(activeMetric);
    animateMetricFocus(activeMetric);
    openMetricReferenceViewer(activeMetric);
  }

  const inspector = $("#metric-inspector");
  const visual = $("#result-visual");

  visual?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  window.setTimeout(() => {
    inspector?.classList.add("metric-inspector--focused");
    window.setTimeout(() => inspector?.classList.remove("metric-inspector--focused"), 900);
  }, 180);
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

function renderHealth(metrics = {}) {
  if (!healthContent) {
    return;
  }

  healthContent.innerHTML = "";

  const visible = [
    ...getGroup(metrics, ["skin_hair"]),
    ...getGroup(metrics, ["visible_features"]),
    ...getGroup(metrics, ["health"])
  ];
  if (visible.length) {
    renderFeaturePanel(healthContent, "Видимые признаки", "Только визуальные признаки, которые различимы на фотографии; это не медицинская диагностика.", visible);
    return;
  }

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
  clearLandmarkEditorState();

  selectedFile = null;
  selectedProfileFile = null;
  currentAnalysis = null;
  lastClientLandmarks = null;

  activeResultView = "front";
  activeMetric = null;
  selectedGender = "male";
  adultConfirmed = false;
  profileWorkingFile = null;
  revokeProfileWorkingObjectUrl();

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
  if (profileCard) {
    profileCard.classList.remove("is-ready");
    profileCard.hidden = true;
  }
  const dualStrip = document.getElementById("dual-photo-strip");
  if (dualStrip) {
    dualStrip.hidden = true;
    dualStrip.classList.remove("has-profile");
  }
  const dualFront = document.getElementById("dual-front-img");
  const dualProf = document.getElementById("dual-profile-img");
  const dualAdd = document.getElementById("dual-add-profile");
  if (dualFront) dualFront.removeAttribute("src");
  if (dualProf) {
    dualProf.removeAttribute("src");
    dualProf.hidden = true;
  }
  if (dualAdd) {
    dualAdd.hidden = false;
    dualAdd.style.display = "";
  }
  const mainPreview = document.querySelector("#screen-analysis .analysis-preview");
  if (mainPreview) mainPreview.hidden = false;
  if (loadingContent) {
    loadingContent.classList.add("is-hidden");
    loadingContent.hidden = true;
  }

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
  window.setTimeout(() => openClassificationModal({ force:true }), 180);
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

  if (
    typeof value === "object"
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


function normalizeMetricValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return null;

  if (typeof value === "object") {
    const candidates = [
      value.value,
      value.measurement,
      value.numericValue,
      value.numeric_value,
      value.score,
      value.result
    ];
    for (const candidate of candidates) {
      const n = normalizeMetricValue(candidate);
      if (n != null) return n;
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/,/g, ".")
    .replace(/(\d)\s*°/g, "$1")
    .replace(/%/g, "")
    .replace(/\s+/g, " ");

  const match = cleaned.match(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)/);
  if (!match) return null;

  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
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
  `;

  document.head.appendChild(
    style
  );
}


/* ============================================================
   EVENTS
============================================================ */

function initClassificationSettings() {
  // Restore saved classification settings once, after all lexical declarations exist.
  const saved = getClassificationSettings();

  if (saved) {
    selectedGender = saved.gender;
    adultConfirmed = saved.adultConfirmed;
  }

  if (genderSelect) {
    genderSelect.value = selectedGender;
    genderSelect.addEventListener("change", () => {
      selectedGender = genderSelect.value === "female" ? "female" : "male";
    });
  }

  if (adultConfirm) {
    adultConfirm.checked = adultConfirmed;
    adultConfirm.addEventListener("change", () => {
      adultConfirmed = Boolean(adultConfirm.checked);
      updateAnalysisButtonState();
    });
  }

  updateAnalysisButtonState();
}

function updateAnalysisButtonState() {
  if (!startAnalysisButton) return;
  // Sync memory from localStorage so button is not stuck disabled
  const saved = getClassificationSettings();
  if (saved?.adultConfirmed) {
    adultConfirmed = true;
    selectedGender = saved.gender === "female" ? "female" : "male";
  }
  const ready = Boolean(selectedFile) && adultConfirmed;
  startAnalysisButton.disabled = !ready;
  startAnalysisButton.removeAttribute("aria-disabled");
  startAnalysisButton.title = !ready
    ? (!selectedFile ? "Сначала загрузите анфас" : "Подтвердите пол и 18+")
    : "Начать анализ";
}

function bindEvents() {
  uploadButton?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      if (!getGeminiApiKey()) {
        openGeminiKeyModal();
        showToast("Сначала введи Gemini API ключ.");
        return;
      }
      // Every new analysis starts with an explicit profile/18+ confirmation.
      // Saved values only prefill the modal; they do not silently skip it.
      openClassificationModal({ force: true });
      return;
    }
  );

  document.getElementById("dual-add-profile")?.addEventListener("click", event => {
    event.preventDefault();
    openProfileCaptureFlow();
  });

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
      if (!adultConfirmed) {
        openClassificationModal({ force: true });
        return;
      }
      startAnalysisButton.disabled = true;
      beginLandmarkVerification(selectedFile, selectedProfileFile);
    }
  );

  document.getElementById("captureSkipGuides")?.addEventListener("change", event => {
    setSkipCaptureGuides(Boolean(event.target.checked));
  });
  ["profile-align-back", "profile-align-back-bottom"].forEach(id => document.getElementById(id)?.addEventListener("click", () => showScreen("analysis")));
  document.getElementById("profile-rotate-range")?.addEventListener("input", event => { profileRotationDegrees = Number(event.target.value) || 0; updateProfileAlignmentUI(); });
  document.getElementById("profile-rotate-minus")?.addEventListener("click", () => { profileRotationDegrees = Math.max(-30, profileRotationDegrees - .5); updateProfileAlignmentUI(); });
  document.getElementById("profile-rotate-plus")?.addEventListener("click", () => { profileRotationDegrees = Math.min(30, profileRotationDegrees + .5); updateProfileAlignmentUI(); });
  document.getElementById("profile-rotate-reset")?.addEventListener("click", () => { profileRotationDegrees = 0; profileMirrored = false; updateProfileAlignmentUI(); });
  document.getElementById("profile-align-mirror")?.addEventListener("click", () => { profileMirrored = !profileMirrored; updateProfileAlignmentUI(); });
  document.getElementById("profile-align-confirm")?.addEventListener("click", confirmProfileAlignment);

  profileUploadButton?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      if (!selectedFile) {
        showToast("Сначала добавь фотографию анфас.");
        return;
      }
      openProfileCaptureFlow();
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

  captureFlowNext?.addEventListener("click", () => {
    const guides = CAPTURE_GUIDES[captureMode] || CAPTURE_GUIDES.front;
    if (captureStep < guides.length) {
      captureStep++;
      renderCaptureFlow();
      return;
    }
    if (captureMode === "front") openFrontFilePickerDirect();
    else profileFileInput?.click();
  });
  captureFlowBack?.addEventListener("click", () => {
    if (captureStep > 0) { captureStep--; renderCaptureFlow(); }
  });
  captureFlowClose?.addEventListener("click", closeCaptureFlow);
  captureFlow?.querySelector(".capture-flow__backdrop")?.addEventListener("click", closeCaptureFlow);
  captureFlowBody?.addEventListener("click", event => {
    if (event.target.closest(".capture-upload-state__drop")) {
      if (captureMode === "front") openFrontFilePickerDirect();
      else profileFileInput?.click();
    }
    if (event.target.closest(".capture-skip-profile")) {
      closeCaptureFlow();
      showToast("Профиль пропущен — анфас будет проанализирован отдельно.");
    }
  });

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



/* ============================================================
   LANDMARK VERIFICATION EDITOR
============================================================ */

function getLandmarkList(mode) {
  return mode === "profile" ? PROFILE_LANDMARKS : FRONT_LANDMARKS;
}

function clearLandmarkEditorState() {
  confirmedFrontLandmarks = {};
  confirmedProfileLandmarks = {};
  suggestedFrontLandmarks = {};
  suggestedProfileLandmarks = {};
  landmarkSuggestionRequestId++;
  landmarkEditorIndex = 0;
  landmarkEditorMode = "front";
  landmarkEditorActive = false;
  editorImageScale = 1;
  editorImageTx = 0;
  editorImageTy = 0;
  autoDetectedFront = null;
  autoDetectedProfile = null;
  profileWorkingFile = null;
  revokeProfileWorkingObjectUrl();
  autoDetectedMesh = null;
  pendingAnalysisFile = null;
  pendingProfileFile = null;
}

async function beginLandmarkVerification(file, profileFile = null) {
  clearLandmarkEditorState();
  pendingAnalysisFile = file;
  pendingProfileFile = profileFile;

  // Load MediaPipe geometry only as a private fallback. Nothing is written to
  // confirmed landmarks here: the editor asks for help one landmark at a time.
  try {
    if (analysisImage && selectedObjectUrl) {
      if (!analysisImage.complete) await new Promise(res => { analysisImage.onload = res; analysisImage.onerror = res; setTimeout(res, 2000); });
      autoDetectedFront = await detectDenseFrontLandmarks();
      if (!autoDetectedMesh && selectedObjectUrl) autoDetectedMesh = await detectFaceMeshFromSource(selectedObjectUrl);
    }
  } catch (e) {
    console.warn("Auto landmark detect failed", e);
  }

  openLandmarkEditor("front");
}

function openLandmarkEditor(mode) {
  landmarkEditorMode = mode;
  landmarkEditorIndex = 0;
  landmarkEditorActive = true;
  editorImageScale = 1;
  editorImageTx = 0;
  editorImageTy = 0;

  showScreen("landmark-editor");

  const img = $("#landmark-editor-image");
  const src =
    mode === "profile"
      ? (profileWorkingObjectUrl || selectedProfileObjectUrl)
      : selectedObjectUrl;

  // Always start on «Фото» tab so user sees the image + reference card
  $("#tab-photo")?.classList.add("is-active");
  $("#tab-howto")?.classList.remove("is-active");
  $("#panel-photo")?.classList.add("is-active");
  $("#panel-howto")?.classList.remove("is-active");
  const refCard = document.getElementById("landmark-ref-card");
  if (refCard) refCard.style.display = "";

  if (img && src) {
    img.style.display = "block";
    img.style.visibility = "visible";
    const apply = () => {
      editorImageScale = 1;
      editorImageTx = 0;
      editorImageTy = 0;
      layoutEditorImage();
      applyEditorTransform();
      // Force the complete auto-seeded map to be painted immediately after
      // the image gets real dimensions.
      renderConfirmedDots();
      updateLandmarkEditorUI();
      // Auto-center on the current suggested point for quick refinement.
      centerOnCurrentLandmark();
      ensureCurrentLandmarkSuggestion();
    };
    if (img.getAttribute("src") === src && img.complete && img.naturalWidth > 0) {
      apply();
    } else {
      img.onload = () => apply();
      img.onerror = () => {
        console.warn("Landmark editor image failed to load", src);
        showToast("Не удалось загрузить фото в редактор.");
      };
      img.src = src;
    }
  } else {
    console.warn("No image URL for landmark editor", mode, !!src);
    showToast("Фото не найдено для разметки. Загрузите анфас заново.");
  }

  updateLandmarkEditorUI();
  bindLandmarkEditorEvents();
  applyEditorTransform();
}

function updateLandmarkEditorUI() {
  const list = getLandmarkList(landmarkEditorMode);
  const total = list.length;
  const idx = Math.min(landmarkEditorIndex, total - 1);
  const lm = list[idx];
  if (!lm) return;

  const stepEl = $("#landmark-step-label");
  const titleEl = $("#landmark-title");
  const techEl = $("#landmark-tech");
  const pctEl = $("#landmark-pct");
  const howtoTitle = $("#howto-title");
  const howtoDesc = $("#howto-desc");
  const header = document.querySelector(".landmark-editor__header");

  if (stepEl) {
    const confirmedCount = list.filter(item => getConfirmedMap()[item.id]).length;
    const suggestionCount = list.filter(item => getSuggestedMap()[item.id]).length;
    stepEl.textContent = `${idx + 1} из ${total} · подтверждено: ${confirmedCount}${suggestionCount ? ` · ИИ-подсказка` : ""}`;
  }
  if (titleEl) titleEl.textContent = lm.label;
  if (techEl) techEl.textContent = `${lm.tech} (${landmarkEditorMode === "front" ? "анфас" : "профиль"})`;
  const pct = ((idx + 1) / total * 100).toFixed(1);
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (header) header.style.setProperty("--le-progress", `${pct}%`);

  if (howtoTitle) howtoTitle.textContent = lm.label;
  if (howtoDesc) howtoDesc.textContent = lm.desc || "";
  const howtoTitleFull = $("#howto-title-full");
  const howtoDescFull = $("#howto-desc-full");
  if (howtoTitleFull) howtoTitleFull.textContent = lm.label;
  if (howtoDescFull) howtoDescFull.textContent = lm.desc || "";
  updateHowtoReference(lm);

  const prevBtn = $("#le-prev");
  const nextBtn = $("#le-next");
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) {
    nextBtn.textContent = idx >= total - 1 ? "ГОТОВО" : "ДАЛЕЕ";
  }

  // Render confirmed dots
  renderConfirmedDots();
  // Center image on current landmark if already confirmed or auto
  centerOnCurrentLandmark();
}

/** Fill «Как найти»: static anatomical reference image with red pin (FaceTheory style).
 *  Uses pre-generated crops from web/refs/{front|profile}/{id}.jpg — NOT the user photo.
 */
function updateHowtoReference(lm) {
  const boxes = [
    document.getElementById("howto-ref-img"),
    document.getElementById("howto-ref-img-large")
  ].filter(Boolean);
  if (!boxes.length) return;

  const mode = landmarkEditorMode === "profile" ? "profile" : "front";
  const id = lm?.id || "";
  // Static pre-cropped reference with baked-in red pin
  const src = id ? `refs/${mode}/${id}.jpg` : null;

  boxes.forEach((box) => {
    box.innerHTML = "";
    if (!src) {
      box.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:13px;padding:16px;text-align:center">Нет референса для этой точки</div>';
      return;
    }
    const img = document.createElement("img");
    img.alt = lm?.label || "Как найти";
    img.draggable = false;
    img.src = src;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.objectPosition = "center center";
    img.onerror = () => {
      box.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:13px;padding:16px;text-align:center">Референс загружается…</div>';
    };
    box.appendChild(img);
    // Pin is already baked into the static image — no extra CSS pin needed
  });
}

function getConfirmedMap() {
  return landmarkEditorMode === "front" ? confirmedFrontLandmarks : confirmedProfileLandmarks;
}
function getSuggestedMap() {
  return landmarkEditorMode === "front" ? suggestedFrontLandmarks : suggestedProfileLandmarks;
}

function getCurrentSuggestionFallback(lm) {
  if (!lm) return null;
  if (landmarkEditorMode === "front") {
    if (lm.mp != null && autoDetectedMesh) return pointFromLm(autoDetectedMesh, lm.mp, 0.72);
    return autoDetectedFront?.[lm.id] || null;
  }
  return autoDetectedProfile?.[lm.id] || null;
}

async function ensureCurrentLandmarkSuggestion() {
  const list = getLandmarkList(landmarkEditorMode);
  const lm = list[landmarkEditorIndex];
  if (!lm) return;
  const confirmed = getConfirmedMap();
  const suggested = getSuggestedMap();
  if (confirmed[lm.id] || suggested[lm.id]) return;

  const mode = landmarkEditorMode;
  const index = landmarkEditorIndex;
  const requestId = ++landmarkSuggestionRequestId;

  // IMPORTANT: never leave the editor waiting for Gemini. First place a
  // local face-AI/MediaPipe estimate for THIS point, then let Gemini refine it.
  const fallback = getCurrentSuggestionFallback(lm);
  if (fallback) {
    suggested[lm.id] = { ...fallback, source: "local_ai_step_suggestion" };
    if (landmarkEditorActive && landmarkEditorMode === mode && landmarkEditorIndex === index) {
      renderConfirmedDots();
      updateLandmarkEditorUI();
      centerOnCurrentLandmark();
    }
    showToast(`Предварительная позиция: ${lm.label}`);
  }

  const file = mode === "profile" ? (profileWorkingFile || pendingProfileFile) : pendingAnalysisFile;
  if (!file || !getGeminiApiKey() || !LANDMARK_SUGGESTIONS_ENABLED) {
    if (!fallback) showToast("Не удалось предложить позицию — поставьте точку вручную.");
    return;
  }

  showToast(`ИИ уточняет точку: ${lm.label}…`);
  const ai = await requestAILandmarkSuggestions(file, mode, {
    ids: [lm.id],
    targetId: lm.id,
    confirmed
  });

  if (requestId !== landmarkSuggestionRequestId || landmarkEditorMode !== mode || landmarkEditorIndex !== index) return;
  if (ai?.[lm.id]) {
    suggested[lm.id] = { ...ai[lm.id], source: "gemini_step_suggestion" };
    showToast(`ИИ предложил позицию: ${lm.label}`);
  } else if (fallback) {
    showToast(`Используется предварительная позиция: ${lm.label}`);
  } else {
    showToast("ИИ не вернул позицию — поставьте точку вручную.");
  }

  if (landmarkEditorActive && landmarkEditorMode === mode && landmarkEditorIndex === index) {
    renderConfirmedDots();
    updateLandmarkEditorUI();
    centerOnCurrentLandmark();
  }
}

/** Size the image-wrap exactly to the fitted image so % coords match the photo */
function layoutEditorImage() {
  const viewport = $("#landmark-viewport");
  const wrap = $("#landmark-image-wrap");
  const img = $("#landmark-editor-image");
  if (!viewport || !wrap || !img || !img.naturalWidth) return false;

  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (vw <= 0 || vh <= 0) return false;

  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const fit = Math.min((vw * 0.92) / nw, (vh * 0.92) / nh);
  const dw = Math.max(1, nw * fit);
  const dh = Math.max(1, nh * fit);

  wrap.style.width = dw + "px";
  wrap.style.height = dh + "px";
  wrap.style.left = "50%";
  wrap.style.top = "50%";

  img.style.width = "100%";
  img.style.height = "100%";
  img.style.maxWidth = "none";
  img.style.maxHeight = "none";
  img.style.objectFit = "fill";

  applyEditorTransform();
  return true;
}

function renderConfirmedDots() {
  const container = $("#landmark-confirmed-dots");
  if (!container) return;
  container.innerHTML = "";
  const map = getConfirmedMap();
  const list = getLandmarkList(landmarkEditorMode);

  list.forEach((lm) => {
    const confirmed = map[lm.id];
    const suggestion = getSuggestedMap()[lm.id];
    const p = confirmed || suggestion;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const dot = document.createElement("div");
    dot.className = confirmed ? "dot" : "dot is-suggestion";
    // wrap is now exactly the image size → % matches photo pixels
    dot.style.left = (p.x * 100) + "%";
    dot.style.top = (p.y * 100) + "%";
    if (lm.id === getLandmarkList(landmarkEditorMode)[landmarkEditorIndex]?.id) {
      dot.classList.add("is-current");
    }
    container.appendChild(dot);
  });
}

function centerOnCurrentLandmark() {
  const list = getLandmarkList(landmarkEditorMode);
  const lm = list[landmarkEditorIndex];
  if (!lm) return;
  const map = getConfirmedMap();
  let p = map[lm.id] || getSuggestedMap()[lm.id] || null;
  // Fallback to mesh index if no AI proposal is available
  if (!p && lm.mp != null && autoDetectedMesh && landmarkEditorMode === "front") {
    p = pointFromLm(autoDetectedMesh, lm.mp);
  }
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;

  // Auto-zoom a bit for fine features so the point is easy to refine (like FaceTheory)
  const fineIds = new Set([
    "leftEyeLateralCanthus","rightEyeLateralCanthus","leftEyeInner","rightEyeInner",
    "leftEyeUpper","rightEyeUpper","leftEyeLower","rightEyeLower","leftEyelidHoodEnd",
    "leftBrowPeak","rightBrowPeak","rightBrowArch","leftBrowInner","rightBrowInner",
    "noseTip","leftNostril","rightNostril","nasalBase","philtrum","mouthMiddle",
    "leftAlar","rightAlar","glabella","leftNoseBridge","rightNoseBridge"
  ]);
  if (editorImageScale < 1.4 && fineIds.has(lm.id)) {
    editorImageScale = 1.6;
  } else if (editorImageScale < 1.1) {
    editorImageScale = 1.25;
  }

  const wrap = $("#landmark-image-wrap");
  if (!wrap) return;
  // Ensure layout so offsetWidth is valid
  layoutEditorImage();
  const w = wrap.offsetWidth || 1;
  const h = wrap.offsetHeight || 1;
  // Point under crosshair (viewport center)
  editorImageTx = -(p.x - 0.5) * w * editorImageScale;
  editorImageTy = -(p.y - 0.5) * h * editorImageScale;
  applyEditorTransform();
}

function applyEditorTransform() {
  const wrap = $("#landmark-image-wrap");
  if (!wrap) return;
  wrap.style.transformOrigin = "center center";
  wrap.style.transform =
    `translate(calc(-50% + ${editorImageTx}px), calc(-50% + ${editorImageTy}px)) scale(${editorImageScale})`;
  const zoomLabel = $("#le-zoom-label");
  if (zoomLabel) {
    const z = Math.round(editorImageScale * 10) / 10;
    zoomLabel.textContent = (Number.isInteger(z) ? z : z.toFixed(1)) + "×";
  }
}

function getCrosshairNormalizedPoint() {
  // Crosshair is fixed at the center of the viewport.
  // Map that screen point onto the image using its transformed bounding box.
  const viewport = $("#landmark-viewport");
  const img = $("#landmark-editor-image");
  const wrap = $("#landmark-image-wrap");
  if (!viewport || !img || !img.naturalWidth) return null;

  const vr = viewport.getBoundingClientRect();
  const cx = vr.left + vr.width / 2;
  const cy = vr.top + vr.height / 2;

  // Prefer wrap rect if it matches image size; fallback to img
  const target = (wrap && wrap.offsetWidth > 0) ? wrap : img;
  const ir = target.getBoundingClientRect();
  if (ir.width <= 0 || ir.height <= 0) return null;

  const nx = (cx - ir.left) / ir.width;
  const ny = (cy - ir.top) / ir.height;

  return {
    x: Math.min(1, Math.max(0, nx)),
    y: Math.min(1, Math.max(0, ny)),
    confidence: 1
  };
}

function confirmCurrentLandmark() {
  const list = getLandmarkList(landmarkEditorMode);
  const lm = list[landmarkEditorIndex];
  if (!lm) return;
  // Ensure layout is up-to-date so % coords match the visible image under crosshair
  layoutEditorImage();
  const pt = getCrosshairNormalizedPoint();
  if (!pt) {
    showToast("Не удалось определить координату. Попробуйте изменить зум.");
    return;
  }
  const map = getConfirmedMap();
  map[lm.id] = { ...pt, source: "user_confirmed" };
  delete getSuggestedMap()[lm.id];
  // Also keep sparse aliases for existing metric system
  if (landmarkEditorMode === "front") {
    const alias = {
      leftEyeLateralCanthus: "left_eye_outer",
      rightEyeLateralCanthus: "right_eye_outer",
      leftEyeInner: "left_eye_inner",
      rightEyeInner: "right_eye_inner",
      leftBrowInner: "left_brow_inner",
      rightBrowInner: "right_brow_inner",
      leftBrowOuter: "left_brow_outer",
      rightBrowOuter: "right_brow_outer",
      leftMouthCorner: "mouth_left",
      rightMouthCorner: "mouth_right",
      leftNostril: "nose_left",
      rightNostril: "nose_right",
      leftJaw: "left_jaw",
      rightJaw: "right_jaw",
      leftCheek: "left_cheekbone",
      rightCheek: "right_cheekbone",
      noseBridge: "nose_bridge",
      noseTip: "nose_tip",
      upperLip: "upper_lip_center",
      lowerLip: "lower_lip_center",
      chinBottom: "chin",
      foreheadCenter: "forehead_center"
    };
    if (alias[lm.id]) {
      // store under both for compatibility
      confirmedFrontLandmarks[alias[lm.id]] = pt;
    }
  }
  renderConfirmedDots();
}

async function openProfileLandmarkEditorWithAutoSuggestions() {
  // MediaPipe may provide a fallback for the current point, but never confirms
  // all 31 points. Gemini is queried only when the user reaches each step.
  if (!autoDetectedProfile) {
    try { autoDetectedProfile = await detectProfileLandmarksFromUrl(profileWorkingObjectUrl || selectedProfileObjectUrl); }
    catch (error) { console.warn("Profile fallback detection failed", error); }
  }
  openLandmarkEditor("profile");
}

function goNextLandmark() {
  confirmCurrentLandmark();
  const list = getLandmarkList(landmarkEditorMode);
  if (landmarkEditorIndex >= list.length - 1) {
    // finished this mode
    if (landmarkEditorMode === "front") {
      if (pendingProfileFile && selectedProfileObjectUrl) {
        // Seed the existing profile editor before it opens. These are only
        // approximate suggestions; every point remains editable/confirmable.
        openProfileAlignment();
        return;
      } else {
        finishLandmarkVerification();
        return;
      }
    } else {
      finishLandmarkVerification();
      return;
    }
  }
  landmarkEditorIndex++;
  landmarkSuggestionRequestId++;
  updateLandmarkEditorUI();
  ensureCurrentLandmarkSuggestion();
}

function goPrevLandmark() {
  if (landmarkEditorIndex <= 0) return;
  landmarkEditorIndex--;
  landmarkSuggestionRequestId++;
  updateLandmarkEditorUI();
  ensureCurrentLandmarkSuggestion();
}

function resetCurrentLandmark() {
  const list = getLandmarkList(landmarkEditorMode);
  const lm = list[landmarkEditorIndex];
  if (!lm) return;
  const map = getConfirmedMap();
  delete map[lm.id];
  delete getSuggestedMap()[lm.id];
  landmarkSuggestionRequestId++;
  renderConfirmedDots();
  showToast("Точка сброшена — ИИ ищет её заново…");
  ensureCurrentLandmarkSuggestion();
}

function finishLandmarkVerification() {
  landmarkEditorActive = false;
  // Build the sparse client landmarks expected by the rest of the system (metrics + Worker)
  const sparse = {};
  // Comprehensive alias map: new camelCase / descriptive ids → classic snake_case keys used by metrics & overlays
  const aliasMap = {
    leftEyeLateralCanthus: "left_eye_outer",
    rightEyeLateralCanthus: "right_eye_outer",
    leftEyeInner: "left_eye_inner",
    rightEyeInner: "right_eye_inner",
    leftEyeUpper: "left_eye_upper",
    rightEyeUpper: "right_eye_upper",
    leftEyeLower: "left_eye_lower",
    rightEyeLower: "right_eye_lower",
    leftEyeCenter: "left_eye_center",
    rightEyeCenter: "right_eye_center",
    leftBrowInner: "left_brow_inner",
    rightBrowInner: "right_brow_inner",
    leftBrowOuter: "left_brow_outer",
    rightBrowOuter: "right_brow_outer",
    leftBrowPeak: "left_brow_peak",
    rightBrowPeak: "right_brow_peak",
    rightBrowArch: "right_brow_arch",
    leftMouthCorner: "mouth_left",
    rightMouthCorner: "mouth_right",
    mouthMiddle: "mouth_middle",
    leftNostril: "nose_left",
    rightNostril: "nose_right",
    leftAlar: "nose_left_alar",
    rightAlar: "nose_right_alar",
    leftJaw: "left_jaw",
    rightJaw: "right_jaw",
    leftJawline: "left_jawline",
    rightJawline: "right_jawline",
    leftCheek: "left_cheekbone",
    rightCheek: "right_cheekbone",
    leftCheekbone: "left_cheekbone",
    rightCheekbone: "right_cheekbone",
    noseBridge: "nose_bridge",
    leftNoseBridge: "left_nose_bridge",
    rightNoseBridge: "right_nose_bridge",
    noseTip: "nose_tip",
    nasalBase: "nasal_base",
    upperLip: "upper_lip_center",
    lowerLip: "lower_lip_center",
    chinBottom: "chin",
    menton: "menton",
    foreheadCenter: "forehead_center",
    hairline: "hairline",
    glabella: "glabella",
    philtrum: "philtrum",
    leftTemple: "left_temple",
    rightTemple: "right_temple",
    leftOuterEar: "left_ear",
    rightOuterEar: "right_ear",
    neckLeft: "neck_left",
    neckRight: "neck_right",
    leftEyelidHoodEnd: "left_eyelid_hood"
  };
  for (const [newId, oldKey] of Object.entries(aliasMap)) {
    if (confirmedFrontLandmarks[newId]) {
      sparse[oldKey] = { ...confirmedFrontLandmarks[newId] };
    }
  }
  // Keep original ids too so nothing is lost
  Object.assign(sparse, confirmedFrontLandmarks);
  // Ensure classic keys that metrics expect are present even if only under new id
  if (confirmedFrontLandmarks.chinBottom && !sparse.chin) sparse.chin = confirmedFrontLandmarks.chinBottom;
  if (confirmedFrontLandmarks.noseTip && !sparse.nose_tip) sparse.nose_tip = confirmedFrontLandmarks.noseTip;
  if (confirmedFrontLandmarks.noseBridge && !sparse.nose_bridge) sparse.nose_bridge = confirmedFrontLandmarks.noseBridge;
  if (confirmedFrontLandmarks.foreheadCenter && !sparse.forehead_center) sparse.forehead_center = confirmedFrontLandmarks.foreheadCenter;
  if (confirmedFrontLandmarks.upperLip && !sparse.upper_lip_center) sparse.upper_lip_center = confirmedFrontLandmarks.upperLip;
  if (confirmedFrontLandmarks.lowerLip && !sparse.lower_lip_center) sparse.lower_lip_center = confirmedFrontLandmarks.lowerLip;

  lastClientLandmarks = sparse;

  // Store full confirmed for potential future use / debugging
  window.__facemetricConfirmedFront = { ...confirmedFrontLandmarks };
  window.__facemetricConfirmedProfile = { ...confirmedProfileLandmarks };
  window.__facemetricClientLandmarks = { ...sparse };

  // Show loading animation then start real analysis (matches FaceTheory flow)
  showScreen("analysis");
  if (loadingContent) {
    loadingContent.classList.remove("is-hidden");
    loadingContent.hidden = false;
  }
  setAnalysisState("АНАЛИЗИРУЕМ…");
  startAnalysis(pendingAnalysisFile, pendingProfileFile);
}

let landmarkEventsBound = false;
function bindLandmarkEditorEvents() {
  if (landmarkEventsBound) return;
  landmarkEventsBound = true;

  $("#le-next")?.addEventListener("click", () => goNextLandmark());
  $("#le-prev")?.addEventListener("click", () => goPrevLandmark());
  $("#le-undo")?.addEventListener("click", () => resetCurrentLandmark());
  $("#landmark-confirm-btn")?.addEventListener("click", () => {
    confirmCurrentLandmark();
    goNextLandmark();
  });
  function zoomEditorBy(delta) {
    const prev = editorImageScale;
    const next = Math.min(4, Math.max(0.5, prev + delta));
    if (next === prev) return;
    // Keep the same image point under the crosshair while zooming
    const ratio = next / prev;
    editorImageTx *= ratio;
    editorImageTy *= ratio;
    editorImageScale = next;
    applyEditorTransform();
  }

  $("#le-zoom-in")?.addEventListener("click", () => zoomEditorBy(0.25));
  $("#le-zoom-out")?.addEventListener("click", () => zoomEditorBy(-0.25));

  $("#tab-photo")?.addEventListener("click", () => {
    $("#tab-photo")?.classList.add("is-active");
    $("#tab-howto")?.classList.remove("is-active");
    $("#panel-photo")?.classList.add("is-active");
    $("#panel-howto")?.classList.remove("is-active");
    const refCard = document.getElementById("landmark-ref-card");
    if (refCard) refCard.style.display = "";
    requestAnimationFrame(() => {
      layoutEditorImage();
      renderConfirmedDots();
    });
  });
  $("#tab-howto")?.addEventListener("click", () => {
    $("#tab-howto")?.classList.add("is-active");
    $("#tab-photo")?.classList.remove("is-active");
    $("#panel-howto")?.classList.add("is-active");
    $("#panel-photo")?.classList.remove("is-active");
    const refCard = document.getElementById("landmark-ref-card");
    if (refCard) refCard.style.display = "none";
    updateLandmarkEditorUI();
  });

  $("#landmark-editor-close")?.addEventListener("click", () => {
    landmarkEditorActive = false;
    startAnalysisButton?.removeAttribute("disabled");
    showScreen("analysis");
    showToast("Разметка отменена");
  });

  // Drag / pan
  const viewport = $("#landmark-viewport");
  if (viewport) {
    viewport.addEventListener("pointerdown", (e) => {
      editorIsDragging = true;
      editorDragStartX = e.clientX;
      editorDragStartY = e.clientY;
      editorDragStartTx = editorImageTx;
      editorDragStartTy = editorImageTy;
      viewport.setPointerCapture?.(e.pointerId);
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!editorIsDragging) return;
      editorImageTx = editorDragStartTx + (e.clientX - editorDragStartX);
      editorImageTy = editorDragStartTy + (e.clientY - editorDragStartY);
      applyEditorTransform();
    });
    viewport.addEventListener("pointerup", () => { editorIsDragging = false; });
    viewport.addEventListener("pointercancel", () => { editorIsDragging = false; });

    // Pinch / wheel zoom
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const prev = editorImageScale;
      const next = Math.min(4, Math.max(0.5, prev + delta));
      if (next === prev) return;
      const ratio = next / prev;
      editorImageTx *= ratio;
      editorImageTy *= ratio;
      editorImageScale = next;
      applyEditorTransform();
    }, { passive: false });
  }
}

// Extend startNewAnalysis to clear landmark state


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
