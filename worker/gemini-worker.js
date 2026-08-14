"use strict";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const DEFAULT_MODEL = "gemini-3.6-flash";

// Deployment marker: 2026-08-15-landmark-ui-objective-v2
const WORKER_BUILD = "2026-08-15-gender-normalize-fix-v2";

const SCORE_MIN = 0;
const SCORE_MAX = 10;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ========================================================
    // CORS
    // ========================================================

    if (request.method === "OPTIONS") {
      return json(null, 204);
    }

    // ========================================================
    // HEALTH
    // ========================================================

    if (url.pathname === "/api/health") {
      return json({
        success: true,
        service: "facebot-gemini",
        status: "ok",
        model: env.GEMINI_MODEL || DEFAULT_MODEL,
        build: WORKER_BUILD,
        cors_headers: "Content-Type,Accept,X-Gemini-Key"
      });
    }

    // ========================================================
    // VALIDATE USER GEMINI KEY
    // ========================================================

    if (url.pathname === "/api/validate-key") {
      if (request.method !== "GET" && request.method !== "POST") {
        return json(
          {
            success: false,
            detail: "Method not allowed."
          },
          405
        );
      }

      return await validateGeminiKey(request, env);
    }

    // ========================================================
    // ANALYZE
    // ========================================================

    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") {
        return json(
          {
            success: false,
            detail: "Method not allowed."
          },
          405
        );
      }

      try {
        return await analyze(request, env);
      } catch (error) {
        console.error("FACEBOT WORKER ERROR:", error);
        console.error("STACK:", error?.stack);

        return json(
          {
            success: false,
            detail:
              error?.message ||
              "Internal server error."
          },
          500
        );
      }
    }

    // ========================================================
    // DEFAULT
    // ========================================================

    return new Response(
      "FaceBot Gemini Worker is running.",
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type":
            "text/plain; charset=UTF-8"
        }
      }
    );
  }
};


// ============================================================
// VALIDATE USER GEMINI KEY
// ============================================================

async function validateGeminiKey(request, env) {
  const apiKey =
    request.headers.get("X-Gemini-Key")?.trim() || "";

  if (!apiKey) {
    return json(
      {
        success: false,
        code: "GEMINI_KEY_REQUIRED",
        detail: "Gemini API key is required."
      },
      400
    );
  }

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models";

  let response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey
      }
    });
  } catch (error) {
    console.error("GEMINI KEY VALIDATION NETWORK ERROR:", error);

    return json(
      {
        success: false,
        code: "GEMINI_UNAVAILABLE",
        detail: "Не удалось подключиться к Gemini для проверки ключа."
      },
      502
    );
  }

  let data = null;
  const raw = await response.text();

  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (response.ok) {
    return json({
      success: true,
      code: "GEMINI_KEY_VALID",
      model: env.GEMINI_MODEL || DEFAULT_MODEL
    });
  }

  const message =
    data?.error?.message ||
    `Gemini key validation failed (HTTP ${response.status}).`;

  const lower = message.toLowerCase();

  if (response.status === 429) {
    return json(
      {
        success: false,
        code: "GEMINI_QUOTA_EXCEEDED",
        detail: "Лимит Gemini API исчерпан. Используйте другой ключ или попробуйте позже.",
        gemini_status: 429
      },
      429
    );
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    lower.includes("api key") &&
      (lower.includes("invalid") || lower.includes("not valid") || lower.includes("expired"))
  ) {
    return json(
      {
        success: false,
        code: "GEMINI_INVALID_KEY",
        detail: "Gemini API ключ недействителен или не имеет доступа к Gemini API.",
        gemini_status: response.status
      },
      401
    );
  }

  return json(
    {
      success: false,
      code: "GEMINI_API_ERROR",
      detail: message,
      gemini_status: response.status
    },
    response.status >= 400 && response.status < 600
      ? response.status
      : 502
  );
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

async function analyze(request, env) {
  const headerKey =
    request.headers.get("X-Gemini-Key")?.trim() || "";

  // BYOK key from the browser takes precedence. The Worker secret
  // remains as an optional server-side fallback for deployments
  // that still use GEMINI_API_KEY.
  const apiKey =
    headerKey ||
    String(env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    return json(
      {
        success: false,
        code: "GEMINI_KEY_REQUIRED",
        detail:
          "Gemini API key is required. Enter your key in the FaceMetric app."
      },
      400
    );
  }

  const contentType =
    request.headers.get("content-type") || "";

  if (
    !contentType
      .toLowerCase()
      .includes("multipart/form-data")
  ) {
    return json(
      {
        success: false,
        detail:
          "Expected multipart/form-data."
      },
      400
    );
  }

  // ========================================================
  // PARSE FILE
  // ========================================================

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error(
      "FORM DATA PARSE ERROR:",
      error
    );

    return json(
      {
        success: false,
        detail:
          "Could not parse multipart/form-data.",
        error:
          error?.message ||
          "Unknown multipart parsing error."
      },
      400
    );
  }

  const file = formData.get("file");
  const profileFile = formData.get("profile");
  const gender = formData.get("gender") === "female" ? "female" : "male";
  const adultConfirmed = formData.get("adult_confirmed") === "true";

  if (
    !file ||
    typeof file.arrayBuffer !== "function"
  ) {
    return json(
      {
        success: false,
        detail:
          "No image file was provided. Expected field: file."
      },
      400
    );
  }

  const mimeType = file.type || "";

  if (!ALLOWED_TYPES.has(mimeType)) {
    return json(
      {
        success: false,
        detail:
          "Only JPG, PNG and WEBP images are supported."
      },
      400
    );
  }

  if (file.size <= 0) {
    return json(
      {
        success: false,
        detail:
          "The image file is empty."
      },
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return json(
      {
        success: false,
        detail:
          "Image is too large. Maximum size is 15 MB."
      },
      413
    );
  }

  if (profileFile && typeof profileFile.arrayBuffer === "function") {
    const profileMimeType = profileFile.type || "";
    if (!ALLOWED_TYPES.has(profileMimeType)) {
      return json(
        { success: false, detail: "Only JPG, PNG and WEBP profile images are supported." },
        400
      );
    }
    if (profileFile.size <= 0) {
      return json(
        { success: false, detail: "The profile image file is empty." },
        400
      );
    }
    if (profileFile.size > MAX_FILE_SIZE) {
      return json(
        { success: false, detail: "Profile image is too large. Maximum size is 15 MB." },
        413
      );
    }
  }

  // ========================================================
  // IMAGE -> BASE64
  // ========================================================

  let base64;
  let profileBase64 = null;

  try {
    const bytes =
      new Uint8Array(
        await file.arrayBuffer()
      );

    base64 = uint8ToBase64(bytes);

    if (profileFile && typeof profileFile.arrayBuffer === "function") {
      const profileBytes = new Uint8Array(await profileFile.arrayBuffer());
      profileBase64 = uint8ToBase64(profileBytes);
    }
  } catch (error) {
    console.error(
      "IMAGE READ ERROR:",
      error
    );

    return json(
      {
        success: false,
        detail:
          "Could not read uploaded image.",
        error:
          error?.message ||
          "Unknown image read error."
      },
      400
    );
  }

  // ========================================================
  // GEMINI PROMPT
  // ========================================================

  const prompt = `
You are the landmark-detection engine for FaceBot.

Your task is NOT to invent beauty scores. Your only job is to locate
visible facial landmarks and describe pose/quality. FaceBot will calculate
all numeric metrics and scores itself from the returned coordinates.

Do NOT identify the person.
Do NOT infer race, ethnicity, health, personality, intelligence, sexuality,
religion, politics, or any other sensitive personal attribute.
Do not invent measurements, scores, ideal ranges, or beauty ratings.
Do not fill a field just because it exists. If a point is not reliably visible,
omit it or set its confidence low.

COORDINATES
Return normalized coordinates:
x=0..1 from left to right
y=0..1 from top to bottom.
Coordinates are approximate visual landmarks, not medical-grade measurements.

IMAGE 1 is the frontal/primary image.
IMAGE 2, when supplied, is a separate optional profile image of the same person.
Analyze each image independently. Never copy coordinates or values from image 1
into image 2.

FRONTAL LANDMARKS (use these names when visible):
left_eye_inner, left_eye_outer, right_eye_inner, right_eye_outer,
left_brow_inner, left_brow_outer, right_brow_inner, right_brow_outer,
nose_bridge, nose_tip, nose_left, nose_right, mouth_left, mouth_right,
upper_lip_center, lower_lip_center, chin, left_jaw, right_jaw,
left_cheekbone, right_cheekbone, forehead_center.

PROFILE LANDMARKS (only for IMAGE 2):
profile_forehead, profile_glabella, profile_nasion, profile_pronasale,
profile_subnasale, profile_labiale_superius, profile_labiale_inferius,
profile_pogonion, profile_menton, profile_gonion, profile_chin_neck,
profile_nose_tip.

For every point return {x,y,confidence}. Confidence is 0..1.

POSE
For each image return:
- view type: frontal, near_frontal, profile, near_profile, three_quarter, unknown
- confidence
- image_quality
- frontal_suitability / profile_suitability as applicable
- roll angle and correction angle in degrees

QUALITY RULES
A point hidden by hair, hand, glasses glare, heavy shadow, cropping, or extreme
pose should be omitted or have low confidence.
If no usable face exists, return face_count=0.

OUTPUT ONLY VALID JSON with exactly this general structure:
{
  "face_count": 1,
  "view": {
    "type": "frontal",
    "confidence": 0.0,
    "frontal_suitability": 0.0,
    "profile_suitability": 0.0,
    "image_quality": 0.0,
    "roll": {"angle_degrees": 0.0,"correction_degrees": 0.0,"confidence": 0.0}
  },
  "frontal": {
    "available": true,
    "confidence": 0.0,
    "landmarks": {}
  },
  "profile": {
    "available": false,
    "confidence": 0.0,
    "landmarks": {}
  },
  "landmarks": {}
}

If IMAGE 2 is absent, profile.available MUST be false and profile.landmarks MUST be {}.
If IMAGE 2 is present but unusable, profile.available=false. Never fabricate profile data.
`

  // ========================================================
  // GEMINI REQUEST
  // ========================================================

  const model =
    env.GEMINI_MODEL ||
    DEFAULT_MODEL;

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          },
          {
            text: profileBase64
              ? "IMAGE 1 — FRONT / FRONTAL VIEW"
              : "IMAGE — FRONT / FRONTAL VIEW"
          },
          ...(profileBase64
            ? [
                {
                  inline_data: {
                    mime_type: profileFile.type,
                    data: profileBase64
                  }
                },
                {
                  text: "IMAGE 2 — PROFILE VIEW. This is the optional profile photo of the same person."
                }
              ]
            : []),
          {
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.15,
      responseMimeType: "application/json"
    }
  };

  // ========================================================
  // GEMINI API CALL
  // ========================================================

  let geminiResponse;

  try {
    geminiResponse = await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey
        },

        body:
          JSON.stringify(
            requestBody
          )
      }
    );
  } catch (error) {
    console.error(
      "GEMINI NETWORK ERROR:",
      error
    );

    return json(
      {
        success: false,
        detail:
          "Could not connect to Gemini API.",
        error:
          error?.message ||
          "Network error."
      },
      502
    );
  }

  // ========================================================
  // READ GEMINI RESPONSE
  // ========================================================

  let rawResponse = "";

  try {
    rawResponse =
      await geminiResponse.text();
  } catch (error) {
    console.error(
      "GEMINI RESPONSE READ ERROR:",
      error
    );

    return json(
      {
        success: false,
        detail:
          "Could not read Gemini response.",
        error:
          error?.message ||
          "Unknown response error."
      },
      502
    );
  }

  console.log(
    "GEMINI HTTP STATUS:",
    geminiResponse.status
  );

  console.log(
    "GEMINI RESPONSE LENGTH:",
    rawResponse.length
  );

  if (!rawResponse.trim()) {
    return json(
      {
        success: false,
        detail:
          `Gemini returned an empty response (HTTP ${geminiResponse.status}).`
      },
      502
    );
  }

  let geminiData;

  try {
    geminiData =
      JSON.parse(rawResponse);
  } catch (error) {
    console.error(
      "GEMINI API JSON PARSE ERROR:",
      error
    );

    console.error(
      "RAW RESPONSE:",
      rawResponse.slice(0, 5000)
    );

    return json(
      {
        success: false,
        detail:
          `Gemini API returned invalid JSON (HTTP ${geminiResponse.status}).`,
        error:
          error?.message ||
          "JSON parse error."
      },
      502
    );
  }

  // ========================================================
  // GEMINI HTTP ERROR
  // ========================================================

  if (!geminiResponse.ok) {
    const message =
      geminiData?.error?.message ||
      `Gemini API error (${geminiResponse.status}).`;

    const lowerMessage = message.toLowerCase();

    let code = "GEMINI_API_ERROR";
    let detail = message;
    let status = geminiResponse.status;

    if (geminiResponse.status === 429) {
      code = "GEMINI_QUOTA_EXCEEDED";
      detail =
        "Лимит Gemini API исчерпан. Введите другой Gemini API ключ или попробуйте позже.";
      status = 429;
    } else if (
      geminiResponse.status === 401 ||
      geminiResponse.status === 403 ||
      (geminiResponse.status === 400 &&
        lowerMessage.includes("api key") &&
        (lowerMessage.includes("invalid") ||
          lowerMessage.includes("not valid") ||
          lowerMessage.includes("expired")))
    ) {
      code = "GEMINI_INVALID_KEY";
      detail =
        "Gemini API ключ недействителен или не имеет доступа к Gemini API.";
      status = 401;
    }

    console.error(
      "GEMINI API ERROR:",
      JSON.stringify(
        geminiData,
        null,
        2
      )
    );

    return json(
      {
        success: false,
        code,
        detail,
        gemini_status: geminiResponse.status
      },
      status
    );
  }

  // ========================================================
  // EXTRACT MODEL TEXT
  // ========================================================

  const text =
    extractGeminiText(
      geminiData
    );

  if (!text) {
    console.error(
      "GEMINI RETURNED NO TEXT"
    );

    return json(
      {
        success: false,
        detail:
          "Gemini returned no analysis text."
      },
      502
    );
  }

  console.log(
    "GEMINI ANALYSIS:",
    text.slice(0, 5000)
  );

  // ========================================================
  // PARSE ANALYSIS JSON
  // ========================================================

  let parsed;

  try {
    parsed =
      parseJsonResponse(text);
  } catch (error) {
    console.error(
      "ANALYSIS JSON ERROR:",
      error
    );

    console.error(
      "ANALYSIS TEXT:",
      text.slice(0, 10000)
    );

    return json(
      {
        success: false,
        detail:
          "Gemini returned invalid analysis JSON.",
        error:
          error?.message ||
          "Analysis JSON parse error."
      },
      502
    );
  }

  // ========================================================
  // NORMALIZE
  // ========================================================

  let normalized;

  try {
    normalized =
      normalizeAnalysis(
        parsed,
        model,
        gender,
        adultConfirmed
      );
  } catch (error) {
    console.error(
      "NORMALIZATION ERROR:",
      error
    );

    return json(
      {
        success: false,
        detail:
          error?.message ||
          "Could not normalize analysis."
      },
      502
    );
  }

  return json(
    normalized
  );
}


// ============================================================
// EXTRACT GEMINI TEXT
// ============================================================

function extractGeminiText(data) {
  const candidates =
    data?.candidates;

  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    return "";
  }

  const parts =
    candidates[0]
      ?.content
      ?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .filter(
      part =>
        typeof part?.text === "string"
    )
    .map(
      part =>
        part.text
    )
    .join("\n")
    .trim();
}


// ============================================================
// ROBUST JSON PARSER
// ============================================================

function parseJsonResponse(text) {
  let cleaned =
    String(text || "").trim();

  if (!cleaned) {
    throw new Error(
      "Gemini analysis text is empty."
    );
  }

  cleaned =
    cleaned.replace(
      /^```json\s*/i,
      ""
    );

  cleaned =
    cleaned.replace(
      /^```\s*/i,
      ""
    );

  cleaned =
    cleaned.replace(
      /\s*```$/i,
      ""
    );

  cleaned = cleaned.trim();

  try {
    return JSON.parse(
      cleaned
    );
  } catch (error) {
    console.warn(
      "DIRECT JSON PARSE FAILED:",
      error?.message
    );
  }

  const start =
    cleaned.indexOf("{");

  if (start < 0) {
    throw new Error(
      "Gemini response does not contain a JSON object."
    );
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let i = start;
    i < cleaned.length;
    i++
  ) {
    const char =
      cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (
      char === "\\" &&
      inString
    ) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth++;
    }

    if (char === "}") {
      depth--;

      if (depth === 0) {
        const candidate =
          cleaned.slice(
            start,
            i + 1
          );

        try {
          return JSON.parse(
            candidate
          );
        } catch (error) {
          console.warn(
            "RECOVERED JSON PARSE FAILED:",
            error?.message
          );
        }
      }
    }
  }

  throw new Error(
    "Gemini returned incomplete JSON."
  );
}


// ============================================================
// NORMALIZE ANALYSIS
// ============================================================

function normalizeAnalysis(data, model, gender = "male", adultConfirmed = false) {
  if (!isPlainObject(data)) {
    throw new Error("Invalid analysis payload.");
  }

  const faceCount = normalizeInteger(data.face_count, 0, 20);
  if (faceCount <= 0) {
    return {
      success: true,
      score: null,
      percent: null,
      face_count: 0,
      landmarks_count: 0,
      detected_features: 0,
      feature_count: 0,
      model,
      analysis_method: "deterministic_geometry_v1",
      metric_source: "landmark_geometry",
      reference_note: "Приложение использует фиксированные продуктовые референсные диапазоны; это не медицинская или научная норма.",
      view: normalizeView(data.view),
      frontal: { available: false, confidence: 0, harmony: null, landmarks: {}, metrics: {} },
      profile: { available: false, confidence: 0, harmony: null, landmarks: {}, metrics: {}, landmarks_count: 0 },
      landmarks: {},
      tier: getTier(null),
      sections: emptySections(),
      metrics: {},
      production_features: emptyProduction(),
      generated_at: new Date().toISOString()
    };
  }

  const view = normalizeView(data.view);
  const frontalRaw = isPlainObject(data.frontal) ? data.frontal : {};
  const profileRaw = isPlainObject(data.profile) ? data.profile : {};
  const frontLandmarks = normalizeLandmarks(
    frontalRaw.landmarks || data.landmarks || {}
  );
  const profileLandmarks = normalizeLandmarks(profileRaw.landmarks || {});

  const frontQuality = clamp01(
    averageNumbers([
      frontalRaw.confidence,
      view.confidence,
      view.image_quality,
      view.frontal_suitability
    ])
  );
  const profileAvailable = Boolean(
    profileRaw.available && Object.keys(profileLandmarks).length >= 3
  );
  const profileQuality = clamp01(
    averageNumbers([
      profileRaw.confidence,
      view.profile_suitability,
      profileRaw.image_quality
    ])
  );

  const frontAlignment = calculateAlignment(frontLandmarks, "front");
  const normalizedFrontLandmarks = applyAlignmentToLandmarks(frontLandmarks, frontAlignment);
  const front = buildFrontalGeometry(normalizedFrontLandmarks, frontQuality);
  const profileAlignment = calculateAlignment(profileLandmarks, "profile");
  const normalizedProfileLandmarks = applyAlignmentToLandmarks(profileLandmarks, profileAlignment);
  const profile = profileAvailable
    ? buildProfileGeometry(normalizedProfileLandmarks, profileQuality)
    : { available: false, confidence: profileQuality, harmony: null, landmarks: normalizedProfileLandmarks, metrics: {}, landmarks_count: Object.keys(normalizedProfileLandmarks).length || null };

  const frontScores = metricScores(front.metrics);
  const profileScores = metricScores(profile.metrics);
  const frontalHarmony = weightedMean(frontScores, frontQuality);
  const profileHarmony = profile.available ? weightedMean(profileScores, profileQuality) : null;

  const combined = profileHarmony !== null
    ? weightedMean([
        { score: frontalHarmony, weight: 0.7 },
        { score: profileHarmony, weight: 0.3 }
      ], 1)
    : frontalHarmony;

  const score = combined === null ? null : clampScore(combined);
  const sections = buildSections(front.metrics, profile.metrics, frontQuality, profileQuality, profile.available);
  const production = {
    overall_harmony: score,
    frontal_harmony: frontalHarmony,
    profile_harmony: profileHarmony,
    facial_definition: sections.features,
    angularity: sections.angularity,
    proportions: sections.proportions,
    symmetry: sections.symmetry,
    confidence: profile.available ? weightedMean([
      { score: frontQuality * 10, weight: 0.7 },
      { score: profileQuality * 10, weight: 0.3 }
    ], 1) / 10 : frontQuality,
    dimorphism: null
  };

  const metrics = front.metrics;
  const allLandmarks = normalizedFrontLandmarks;

  return {
    success: true,
    score,
    percent: score === null ? null : Math.round(score * 10),
    face_count: faceCount,
    landmarks_count: Object.keys(allLandmarks).length || null,
    detected_features: countLeaves(metrics),
    feature_count: countLeaves(metrics),
    model,
    analysis_method: "deterministic_geometry_v1",
      metric_source: "landmark_geometry",
      reference_note: "Приложение использует фиксированные продуктовые референсные диапазоны; это не медицинская или научная норма.",
    view,
    frontal: {
      available: true,
      confidence: frontQuality,
      harmony: frontalHarmony,
      landmarks: normalizedFrontLandmarks,
      metrics: front.metrics,
      landmarks_count: Object.keys(frontLandmarks).length || null
    },
    profile,
    landmarks: allLandmarks,
    gender,
    adult_confirmed: adultConfirmed,
    tier: adultConfirmed ? getTier(score, gender) : { name: null, level: null },
    sections,
    metrics,
    production_features: production,
    alignment: { front: frontAlignment, profile: profileAlignment },
    generated_at: new Date().toISOString()
  };
}

function emptySections() {
  return { harmony: null, dimorphism: null, features: null, angularity: null, symmetry: null, proportions: null };
}

function emptyProduction() {
  return { overall_harmony: null, frontal_harmony: null, profile_harmony: null, facial_definition: null, angularity: null, proportions: null, symmetry: null, confidence: null, dimorphism: null };
}

function clamp01(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function averageNumbers(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : 0;
}

function point(landmarks, name) {
  const p = landmarks[name];
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}

function dist(a,b) {
  if (!a || !b) return null;
  return Math.hypot(a.x-b.x, a.y-b.y);
}

function angle(a,b,c) {
  if (!a || !b || !c) return null;
  const ux=a.x-b.x, uy=a.y-b.y, vx=c.x-b.x, vy=c.y-b.y;
  const du=Math.hypot(ux,uy), dv=Math.hypot(vx,vy);
  if (!du || !dv) return null;
  const cos=Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(du*dv)));
  return Math.acos(cos)*180/Math.PI;
}

function scoreRange(value, min, max, tolerance) {
  if (value === null || !Number.isFinite(value)) return metric(null,null,"uncertain",min,max,null,[]);
  const center=(min+max)/2;
  const half=Math.max((max-min)/2,1e-6);
  const d=Math.abs(value-center);
  let score;
  let status;
  if (value >= min && value <= max) {
    const edge=Math.min(1,d/half);
    score=8.6-(edge*1.8);
    status="good";
  } else {
    const outside=value<min?min-value:value-max;
    const normalized=outside/Math.max(tolerance,1e-6);
    score=6.8-(normalized*3.2);
    status=outside <= tolerance ? "average" : "poor";
  }
  score=clampScore(Math.max(1,Math.min(9.4,score)));
  return metric(value,score,status,min,max,"ratio",[]);
}

function scoreCentered(value, target, tolerance, unit="ratio") {
  if (value === null || !Number.isFinite(value)) return metric(null,null,"uncertain",null,null,unit,[]);
  const d=Math.abs(value-target);
  const normalized=d/Math.max(tolerance,1e-6);
  const score=clampScore(Math.max(1,9.4-(normalized*5.6)));
  const status=d<=tolerance*0.45?"good":d<=tolerance?"average":"poor";
  return metric(value,score,status,target-tolerance,target+tolerance,unit,[]);
}

function metric(value,score,status,idealMin,idealMax,unit,landmarks) {
  return { value: value === null ? null : round(value,4), score: score === null ? null : round(score,1), status, ideal_min: idealMin === null ? null : round(idealMin,4), ideal_max: idealMax === null ? null : round(idealMax,4), unit, landmarks };
}

function metricWithPoints(m,names) { return {...m, landmarks:names.filter(Boolean)}; }
function round(v,n=4){ const p=10**n; return Math.round(v*p)/p; }


function normalizeHalfTurnAngle(degrees) {
  let angle = Number(degrees) || 0;
  while (angle > 90) angle -= 180;
  while (angle < -90) angle += 180;
  return angle;
}

function calculateAlignment(lm, type) {
  const entries = Object.entries(lm || {}).filter(([, p]) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
  if (entries.length < 3) {
    return { available: false, type, roll_degrees: 0, correction_degrees: 0, center_x: 0.5, center_y: 0.5, scale: 1, confidence: 0 };
  }

  const points = Object.fromEntries(entries);
  let roll = 0;
  let upsideDown = false;
  let axisStart = null;
  let axisEnd = null;

  if (type === "front") {
    const left = points.left_eye_inner || points.left_eye_outer;
    const right = points.right_eye_inner || points.right_eye_outer;
    if (left && right) {
      roll = normalizeHalfTurnAngle(Math.atan2(right.y - left.y, right.x - left.x) * 180 / Math.PI);
    }
    axisStart = points.forehead_center || points.nose_bridge || null;
    axisEnd = points.chin || null;
    // Eye-line roll cannot distinguish a normal face from a 180° rotated image.
    // The forehead -> chin axis does: in a normal image chin must be below forehead.
    if (axisStart && axisEnd && Number(axisEnd.y) < Number(axisStart.y)) upsideDown = true;
  } else {
    axisStart = points.profile_glabella || points.profile_nasion || points.profile_forehead || null;
    axisEnd = points.profile_pogonion || points.profile_menton || points.profile_chin_neck || null;
    if (axisStart && axisEnd) {
      roll = normalizeHalfTurnAngle(Math.atan2(axisEnd.x - axisStart.x, axisEnd.y - axisStart.y) * 180 / Math.PI);
      if (Number(axisEnd.y) < Number(axisStart.y)) upsideDown = true;
    }
  }

  let correction = -roll;
  if (upsideDown) correction += 180;
  while (correction > 180) correction -= 360;
  while (correction < -180) correction += 360;
  const xs = entries.map(([, p]) => Number(p.x));
  const ys = entries.map(([, p]) => Number(p.y));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const height = Math.max(maxY - minY, 0.01);
  const width = Math.max(maxX - minX, 0.01);
  const targetHeight = type === "front" ? 0.76 : 0.78;
  const targetWidth = type === "front" ? 0.68 : 0.62;
  const scale = Math.max(0.82, Math.min(1.45, Math.max(targetHeight / height, targetWidth / width)));
  const avgConfidence = entries.reduce((sum, [, p]) => sum + (Number(p.confidence) || 0), 0) / entries.length;

  return {
    available: true,
    type,
    roll_degrees: round(roll, 2),
    correction_degrees: round(correction, 2),
    center_x: round(centerX, 4),
    center_y: round(centerY, 4),
    scale: round(scale, 3),
    confidence: round(avgConfidence, 3)
  };
}


function applyAlignmentToLandmarks(lm, alignment) {
  if (!alignment?.available) return lm || {};
  const cx = Number(alignment.center_x ?? 0.5);
  const cy = Number(alignment.center_y ?? 0.5);
  const scale = Number(alignment.scale ?? 1) || 1;
  const angle = Number(alignment.correction_degrees ?? 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out = {};
  for (const [name, point] of Object.entries(lm || {})) {
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) continue;
    const sx = (Number(point.x) - cx) * scale;
    const sy = (Number(point.y) - cy) * scale;
    out[name] = {
      x: round(0.5 + sx * cos - sy * sin, 5),
      y: round(0.5 + sx * sin + sy * cos, 5),
      confidence: Number.isFinite(Number(point.confidence)) ? Number(point.confidence) : null
    };
  }
  return out;
}

function buildFrontalGeometry(lm, quality) {
  const le=point(lm,"left_eye_inner"), leO=point(lm,"left_eye_outer"), re=point(lm,"right_eye_inner"), reO=point(lm,"right_eye_outer");
  const nb=point(lm,"nose_bridge"), nt=point(lm,"nose_tip"), nl=point(lm,"nose_left"), nr=point(lm,"nose_right");
  const ml=point(lm,"mouth_left"), mr=point(lm,"mouth_right"), chin=point(lm,"chin"), lc=point(lm,"left_cheekbone"), rc=point(lm,"right_cheekbone"), lj=point(lm,"left_jaw"), rj=point(lm,"right_jaw"), fc=point(lm,"forehead_center"), ul=point(lm,"upper_lip_center"), ll=point(lm,"lower_lip_center");
  const eyeMid = le&&re ? {x:(le.x+re.x)/2,y:(le.y+re.y)/2} : null;
  const faceW=dist(lc,rc) ?? dist(lj,rj);
  const faceH=fc&&chin ? dist(fc,chin) : null;
  const metrics={};
  if (faceW && faceH) metrics.face_geometry={face_aspect_ratio:metricWithPoints(scoreRange(faceW/faceH,0.62,0.82,0.18),["left_cheekbone","right_cheekbone","forehead_center","chin"])};
  else metrics.face_geometry={};
  if (faceW) {
    metrics.symmetry={};
    if (le&&re&&eyeMid) metrics.symmetry.eye_alignment=metricWithPoints(scoreCentered(Math.abs(le.y-re.y)/faceW,0,0.035),["left_eye_inner","right_eye_inner"]);
    if (ml&&mr) metrics.symmetry.mouth_symmetry=metricWithPoints(scoreCentered(Math.abs(ml.y-mr.y)/faceW,0,0.035),["mouth_left","mouth_right"]);
    if (lj&&rj&&eyeMid) metrics.symmetry.jaw_symmetry=metricWithPoints(scoreCentered(Math.abs(lj.y-rj.y)/faceW,0,0.05),["left_jaw","right_jaw"]);
    if (lc&&rc) metrics.symmetry.cheek_symmetry=metricWithPoints(scoreCentered(Math.abs(lc.y-rc.y)/faceW,0,0.05),["left_cheekbone","right_cheekbone"]);
    const symVals=metricScores(metrics.symmetry); metrics.symmetry.overall_symmetry=metricWithPoints({value:symVals.length?round(symVals.reduce((a,x)=>a+x.score,0)/symVals.length/10,3):null,score:symVals.length?round(symVals.reduce((a,x)=>a+x.score,0)/symVals.length,1):null,status:symVals.length?"good":"uncertain",ideal_min:0.9,ideal_max:1,unit:"index",landmarks:["left_eye_inner","right_eye_inner","mouth_left","mouth_right","left_jaw","right_jaw"]},["left_eye_inner","right_eye_inner","mouth_left","mouth_right","left_jaw","right_jaw"]);
    metrics.eyes={};
    if (le&&re) metrics.eyes.eye_spacing=metricWithPoints(scoreRange(dist(le,re)/faceW,0.55,0.78,0.20),["left_eye_inner","right_eye_inner"]);
    if (le&&leO) metrics.eyes.left_eye_width=metricWithPoints(scoreRange(dist(le,leO)/faceW,0.10,0.20,0.10),["left_eye_inner","left_eye_outer"]);
    if (re&&reO) metrics.eyes.right_eye_width=metricWithPoints(scoreRange(dist(re,reO)/faceW,0.10,0.20,0.10),["right_eye_inner","right_eye_outer"]);
    if (nl&&nr) metrics.nose={nose_width:metricWithPoints(scoreRange(dist(nl,nr)/faceW,0.15,0.30,0.14),["nose_left","nose_right"])};
    else metrics.nose={};
    if (nb&&nt&&faceH) metrics.nose.nose_length=metricWithPoints(scoreRange(dist(nb,nt)/faceH,0.16,0.34,0.16),["nose_bridge","nose_tip"]);
    if (ml&&mr) metrics.lips_mouth={mouth_width:metricWithPoints(scoreRange(dist(ml,mr)/faceW,0.28,0.52,0.20),["mouth_left","mouth_right"])};
    else metrics.lips_mouth={};
    if (lj&&rj) metrics.jaw={jaw_width:metricWithPoints(scoreRange(dist(lj,rj)/faceW,0.62,1.02,0.30),["left_jaw","right_jaw"])};
    else metrics.jaw={};
    metrics.chin={};
    if (chin&&faceW&&lj&&rj) metrics.chin.chin_width=metricWithPoints(scoreRange(Math.min(dist(lj,chin),dist(rj,chin))/faceW,0.18,0.38,0.18),["left_jaw","right_jaw","chin"]);
    metrics.proportions={};
    if (fc&&eyeMid&&chin&&faceH) metrics.proportions.upper_to_lower_third=metricWithPoints(scoreRange(dist(fc,eyeMid)/dist(eyeMid,chin),0.78,1.22,0.50),["forehead_center","left_eye_inner","right_eye_inner","chin"]);
    if (eyeMid&&ul&&chin&&faceH) metrics.proportions.mid_to_lower_face=metricWithPoints(scoreRange(dist(eyeMid,ul)/dist(ul,chin),0.85,1.25,0.55),["left_eye_inner","right_eye_inner","upper_lip_center","chin"]);
    metrics.angularity={};
    if (lc&&lj&&rj&&rc) {
      const la=angle(lc,lj,chin), ra=angle(rc,rj,chin);
      if (la!==null&&ra!==null) metrics.angularity.jaw_angle=metricWithPoints(scoreRange((la+ra)/2,110,140,35),["left_cheekbone","left_jaw","chin","right_jaw","right_cheekbone"]);
    }
  }
  const featureScores=metricScores(metrics);
  const harmony=weightedMean(featureScores,quality);
  return {available:Object.keys(lm).length>=4,confidence:quality,harmony,landmarks:lm,metrics,landmarks_count:Object.keys(lm).length||null};
}

function buildProfileGeometry(lm, quality) {
  const gf=point(lm,"profile_glabella"), na=point(lm,"profile_nasion"), no=point(lm,"profile_pronasale"), sn=point(lm,"profile_subnasale"), ls=point(lm,"profile_labiale_superius"), li=point(lm,"profile_labiale_inferius"), po=point(lm,"profile_pogonion"), me=point(lm,"profile_menton"), go=point(lm,"profile_gonion"), ch=point(lm,"profile_chin_neck");
  const metrics={profile:{}};
  if (gf&&na&&no) metrics.profile.nasofacial_angle=metricWithPoints(scoreRange(180-angle(gf,na,no),30,40,18),["profile_glabella","profile_nasion","profile_pronasale"]);
  if (sn&&ls&&no) metrics.profile.nasolabial_angle=metricWithPoints(scoreRange(angle(no,sn,ls),90,110,35),["profile_pronasale","profile_subnasale","profile_labiale_superius"]);
  if (go&&po&&ch) metrics.profile.gonial_angle=metricWithPoints(scoreRange(180-angle(po,go,ch),115,135,35),["profile_pogonion","profile_gonion","profile_chin_neck"]);
  if (na&&no&&po) metrics.profile.nose_chin_projection=metricWithPoints(scoreCentered(Math.abs(no.x-po.x),0.16,0.12),["profile_nasion","profile_pronasale","profile_pogonion"]);
  if (no&&ls&&po) metrics.profile.profile_projection_balance=metricWithPoints(scoreCentered(Math.abs((no.x-ls.x)/(Math.abs(no.x-po.x)||1)),0.55,0.35),["profile_pronasale","profile_labiale_superius","profile_pogonion"]);
  const scores=metricScores(metrics); const harmony=weightedMean(scores,quality);
  return {available:Object.keys(lm).length>=4,confidence:quality,harmony,landmarks:lm,metrics,landmarks_count:Object.keys(lm).length||null};
}

function metricScores(obj) {
  const out=[];
  walkMetrics(obj,m=>{ if (m && Number.isFinite(Number(m.score))) out.push({score:Number(m.score),weight:1}); });
  return out;
}
function walkMetrics(obj,cb){
  if(!obj||typeof obj!=="object")return;
  if(Object.prototype.hasOwnProperty.call(obj,"score")&&Object.prototype.hasOwnProperty.call(obj,"status")){cb(obj);return;}
  Object.values(obj).forEach(v=>walkMetrics(v,cb));
}
function weightedMean(items,quality=1){
  if(!Array.isArray(items)||!items.length)return null;
  const normalized=items.filter(x=>x&&Number.isFinite(Number(x.score))).map(x=>({score:Number(x.score),weight:Number(x.weight)||1}));
  if(!normalized.length)return null;
  const sum=normalized.reduce((a,x)=>a+x.score*x.weight,0)/normalized.reduce((a,x)=>a+x.weight,0);
  const q=clamp01(quality);
  const qualityPenalty=q>=0.85?1:0.72+(q*0.28);
  return clampScore(sum*qualityPenalty);
}
function buildSections(front,profile,frontQ,profileQ,hasProfile){
  const sym=avgMetricGroup(front.symmetry);
  const prop=avgMetricGroup(front.proportions);
  const feat=avgMetricGroup({...(front.eyes||{}),...(front.nose||{}),...(front.lips_mouth||{}),...(front.jaw||{}),...(front.chin||{})});
  const ang=avgMetricGroup(front.angularity);
  return {harmony:avgNullable([sym,prop,feat,ang]),dimorphism:null,features:feat,angularity:ang,symmetry:sym,proportions:prop};
}
function avgMetricGroup(group){ const s=metricScores(group||{}); return s.length?round(s.reduce((a,x)=>a+x.score,0)/s.length,1):null; }
function avgNullable(vs){const n=vs.filter(Number.isFinite);return n.length?round(n.reduce((a,b)=>a+b,0)/n.length,1):null;}

// ============================================================
// VIEW NORMALIZATION
// ============================================================

function normalizeView(view) {
  const source =
    isPlainObject(view)
      ? view
      : {};

  const type =
    [
      "frontal",
      "near_frontal",
      "profile",
      "near_profile",
      "three_quarter",
      "unknown"
    ].includes(
      source.type
    )
      ? source.type
      : "unknown";

  const rollSource =
    isPlainObject(
      source.roll
    )
      ? source.roll
      : {};

  const angle =
    normalizeNumber(
      rollSource.angle_degrees,
      0,
      -90,
      90
    );

  const correction =
    normalizeNumber(
      rollSource.correction_degrees,
      -angle,
      -90,
      90
    );

  return {
    type,

    confidence:
      normalizeUnit(
        source.confidence
      ),

    frontal_suitability:
      normalizeUnit(
        source.frontal_suitability
      ),

    profile_suitability:
      normalizeUnit(
        source.profile_suitability
      ),

    image_quality:
      normalizeUnit(
        source.image_quality
      ),

    roll: {
      angle_degrees:
        angle,

      correction_degrees:
        correction,

      confidence:
        normalizeUnit(
          rollSource.confidence
        )
    }
  };
}


function normalizeViewResult(
  value,
  allowProfile
) {
  const source =
    isPlainObject(value)
      ? value
      : {};

  const available =
    Boolean(
      source.available
    );

  let harmony =
    normalizeNullableScore(
      source.harmony
    );

  if (
    !allowProfile &&
    harmony === null &&
    available
  ) {
    harmony =
      null;
  }

  return {
    available,
    confidence:
      normalizeUnit(
        source.confidence
      ),
    harmony
  };
}


// ============================================================
// LANDMARKS
// ============================================================

function normalizeLandmarks(
  landmarks
) {
  if (
    !isPlainObject(
      landmarks
    )
  ) {
    return {};
  }

  const result = {};

  Object.entries(
    landmarks
  ).forEach(
    ([name, value]) => {
      if (
        !isPlainObject(
          value
        )
      ) {
        return;
      }

      const x =
        normalizeNumber(
          value.x,
          null,
          0,
          1
        );

      const y =
        normalizeNumber(
          value.y,
          null,
          0,
          1
        );

      if (
        x === null ||
        y === null
      ) {
        return;
      }

      result[name] = {
        x,
        y,
        confidence:
          normalizeUnit(
            value.confidence
          )
      };
    }
  );

  return result;
}


// ============================================================
// METRICS
// ============================================================

function normalizeMetrics(
  metrics
) {
  if (
    !isPlainObject(
      metrics
    )
  ) {
    return {};
  }

  return normalizeMetricObject(
    metrics
  );
}


function normalizeMetricObject(
  object
) {
  const result = {};

  Object.entries(
    object
  ).forEach(
    ([key, value]) => {
      if (
        isPlainObject(
          value
        )
      ) {
        if (
          hasMetricFields(
            value
          )
        ) {
          result[key] =
            normalizeMetric(
              value
            );
        } else {
          result[key] =
            normalizeMetricObject(
              value
            );
        }

        return;
      }

      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        value === null
      ) {
        result[key] =
          normalizeScalarMetric(
            value
          );
      }
    }
  );

  return result;
}


function hasMetricFields(
  value
) {
  return [
    "value",
    "score",
    "status",
    "ideal_min",
    "ideal_max",
    "unit",
    "landmarks"
  ].some(
    key =>
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
  );
}


function normalizeMetric(
  metric
) {
  const value =
    normalizeNullableRawValue(
      metric.value
    );

  const score =
    normalizeNullableScore(
      metric.score
    );

  let status =
    [
      "good",
      "average",
      "poor",
      "uncertain"
    ].includes(
      metric.status
    )
      ? metric.status
      : "uncertain";

  const idealMin =
    normalizeNullableNumber(
      metric.ideal_min
    );

  const idealMax =
    normalizeNullableNumber(
      metric.ideal_max
    );

  const unit =
    metric.unit === null ||
    metric.unit === undefined
      ? null
      : String(
          metric.unit
        );

  const landmarks =
    Array.isArray(
      metric.landmarks
    )
      ? metric.landmarks
          .filter(
            value =>
              typeof value ===
              "string"
          )
          .slice(
            0,
            12
          )
      : [];

  return {
    value,
    score,
    status,
    ideal_min:
      idealMin,
    ideal_max:
      idealMax,
    unit,
    landmarks
  };
}


function normalizeScalarMetric(
  value
) {
  const numeric =
    normalizeNullableNumber(
      value
    );

  if (
    numeric !== null
  ) {
    return {
      value: numeric,
      score:
        numeric >= 0 &&
        numeric <= 10
          ? numeric
          : null,
      status:
        "uncertain",
      ideal_min: null,
      ideal_max: null,
      unit: null,
      landmarks: []
    };
  }

  return {
    value:
      value === undefined
        ? null
        : value,
    score: null,
    status:
      "uncertain",
    ideal_min: null,
    ideal_max: null,
    unit: null,
    landmarks: []
  };
}


// ============================================================
// SECTIONS
// ============================================================

function normalizeSections(
  sections
) {
  const source =
    isPlainObject(
      sections
    )
      ? sections
      : {};

  return {
    harmony:
      normalizeNullableScore(
        source.harmony
      ),

    dimorphism:
      normalizeNullableScore(
        source.dimorphism
      ),

    features:
      normalizeNullableScore(
        source.features
      ),

    angularity:
      normalizeNullableScore(
        source.angularity
      ),

    symmetry:
      normalizeNullableScore(
        source.symmetry
      ),

    proportions:
      normalizeNullableScore(
        source.proportions
      )
  };
}


// ============================================================
// PRODUCTION FEATURES
// ============================================================

function normalizeProductionFeatures(
  production,
  sections
) {
  const source =
    isPlainObject(
      production
    )
      ? production
      : {};

  return {
    overall_harmony:
      normalizeNullableScore(
        source.overall_harmony
      ) ??
      sections.harmony,

    frontal_harmony:
      normalizeNullableScore(
        source.frontal_harmony
      ),

    profile_harmony:
      normalizeNullableScore(
        source.profile_harmony
      ),

    facial_definition:
      normalizeNullableScore(
        source.facial_definition
      ) ??
      sections.features,

    angularity:
      normalizeNullableScore(
        source.angularity
      ) ??
      sections.angularity,

    proportions:
      normalizeNullableScore(
        source.proportions
      ) ??
      sections.proportions,

    symmetry:
      normalizeNullableScore(
        source.symmetry
      ) ??
      sections.symmetry,

    confidence:
      normalizeNullableScore(
        source.confidence
      ),

    dimorphism:
      normalizeNullableScore(
        source.dimorphism
      ) ??
      sections.dimorphism
  };
}


// ============================================================
// FALLBACK SCORE
// ============================================================

function clampScore(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.max(SCORE_MIN, Math.min(SCORE_MAX, number)) * 10) / 10;
}


function calculateFallbackOverallScore(
  sections,
  production
) {
  const values = [
    production.overall_harmony,
    production.frontal_harmony,
    production.facial_definition,
    production.angularity,
    production.proportions,
    production.symmetry
  ].filter(
    value =>
      Number.isFinite(
        Number(value)
      )
  );

  if (!values.length) {
    const sectionValues =
      Object.values(
        sections
      ).filter(
        value =>
          Number.isFinite(
            Number(value)
          )
      );

    if (!sectionValues.length) {
      return null;
    }

    return roundScore(
      average(
        sectionValues
      )
    );
  }

  return roundScore(
    average(values)
  );
}


// ============================================================
// TIER
// ============================================================

function getTier(
  score,
  gender = "male"
) {
  if (
    score === null ||
    !Number.isFinite(
      Number(score)
    )
  ) {
    return {
      name: null,
      level: null
    };
  }

  const value =
    Number(score);

  if (value < 2) {
    return {
      name: "Sub 3",
      level: getTierLevel(
        value,
        1,
        2
      )
    };
  }

  if (value < 4) {
    return {
      name: "Sub 5",
      level: getTierLevel(
        value,
        2,
        4
      )
    };
  }

  if (value < 5) {
    return {
      name: gender === "female" ? "LTB" : "LTN",
      level: getTierLevel(
        value,
        4,
        5
      )
    };
  }

  if (value < 5.5) {
    return {
      name: gender === "female" ? "MTB" : "MTN",
      level: getTierLevel(
        value,
        5,
        5.5
      )
    };
  }

  if (value < 6) {
    return {
      name: gender === "female" ? "HTB" : "HTN",
      level: getTierLevel(
        value,
        5.5,
        6
      )
    };
  }

  if (value < 7) {
    return {
      name: gender === "female" ? "Stacylite" : "Chadlite",
      level: getTierLevel(value, 6, 7)
    };
  }

  if (value < 8) {
    return {
      name: gender === "female" ? "Stacy" : "Chad",
      level: getTierLevel(value, 7, 8)
    };
  }

  if (value < 9) {
    return {
      name: gender === "female" ? "Stacy" : "Chad",
      level: getTierLevel(value, 8, 9)
    };
  }

  if (value < 10) {
    return {
      name: gender === "female" ? "Evalite" : "Adamlite",
      level: getTierLevel(value, 9, 10)
    };
  }

  return {
    name: gender === "female" ? "True Eva" : "True Adam",
    level: "base"
  };
}


function getTierLevel(
  score,
  min,
  max
) {
  const range =
    max - min;

  if (range <= 0) {
    return "base";
  }

  const position =
    (score - min) /
    range;

  if (position < 0.333) {
    return "low";
  }

  if (position < 0.666) {
    return "mid";
  }

  return "high";
}


// ============================================================
// GENERIC HELPERS
// ============================================================

function isPlainObject(
  value
) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function countLeaves(
  object
) {
  if (
    !isPlainObject(
      object
    )
  ) {
    return 0;
  }

  let count = 0;

  for (
    const value of
    Object.values(object)
  ) {
    if (
      isPlainObject(
        value
      )
    ) {
      count +=
        countLeaves(value);
    } else {
      count++;
    }
  }

  return count;
}


function average(
  values
) {
  if (
    !Array.isArray(
      values
    ) ||
    !values.length
  ) {
    return null;
  }

  const numbers =
    values
      .map(
        Number
      )
      .filter(
        Number.isFinite
      );

  if (!numbers.length) {
    return null;
  }

  return (
    numbers.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    ) /
    numbers.length
  );
}


function roundScore(
  value
) {
  if (
    value === null ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return null;
  }

  return (
    Math.round(
      clamp(
        Number(value),
        SCORE_MIN,
        SCORE_MAX
      ) * 100
    ) / 100
  );
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

  return roundScore(
    number
  );
}


function normalizeNullableScore(
  value
) {
  return normalizeScore(
    value
  );
}


function normalizeNullableNumber(
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


function normalizeNullableRawValue(
  value
) {
  if (
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    value === null
  ) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return null;
}


function normalizeNumber(
  value,
  fallback,
  min,
  max
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return fallback;
  }

  return clamp(
    number,
    min,
    max
  );
}


function normalizeInteger(
  value,
  fallback,
  max
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return fallback;
  }

  return Math.round(
    clamp(
      number,
      0,
      max
    )
  );
}


function normalizeUnit(
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

  return clamp(
    number,
    0,
    1
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


// ============================================================
// UINT8 -> BASE64
// ============================================================

function uint8ToBase64(
  bytes
) {
  const chunkSize =
    0x8000;

  let binary = "";

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length
        )
      );

    binary += String.fromCharCode(
      ...chunk
    );
  }

  return btoa(
    binary
  );
}


// ============================================================
// CORS
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET,POST,OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept, X-Gemini-Key"
  };
}


// ============================================================
// JSON RESPONSE
// ============================================================

function json(
  data,
  status = 200
) {
  return new Response(
    data === null
      ? null
      : JSON.stringify(
          data
        ),
    {
      status,

      headers: {
        ...corsHeaders(),

        "Content-Type":
          "application/json; charset=UTF-8"
      }
    }
  );
}
