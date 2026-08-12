const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const DEFAULT_MODEL = "gemini-2.5-flash";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==================================================
    // CORS
    // ==================================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // ==================================================
    // HEALTH CHECK
    // ==================================================

    if (url.pathname === "/api/health") {
      return json({
        success: true,
        service: "facebot-gemini",
        status: "ok",
        model: env.GEMINI_MODEL || DEFAULT_MODEL
      });
    }

    // ==================================================
    // ANALYZE
    // ==================================================

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
        console.error(
          "FaceBot Worker error:",
          error
        );

        return json(
          {
            success: false,
            detail:
              error?.message ||
              "Internal analysis error."
          },
          500
        );
      }
    }

    // ==================================================
    // STATIC ASSETS
    // ==================================================

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

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


// ======================================================
// ANALYZE
// ======================================================

async function analyze(request, env) {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return json(
      {
        success: false,
        detail:
          "GEMINI_API_KEY is not configured in Worker secrets."
      },
      500
    );
  }

  // --------------------------------------------------
  // Check content type
  // --------------------------------------------------

  const contentType =
    request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return json(
      {
        success: false,
        detail:
          "Expected multipart/form-data."
      },
      400
    );
  }

  // --------------------------------------------------
  // Read form
  // --------------------------------------------------

  const form = await request.formData();

  const file = form.get("file");

  if (
    !file ||
    typeof file.arrayBuffer !== "function"
  ) {
    return json(
      {
        success: false,
        detail:
          "No image file was provided."
      },
      400
    );
  }

  // --------------------------------------------------
  // Validate MIME type
  // --------------------------------------------------

  const mimeType =
    file.type || "application/octet-stream";

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

  // --------------------------------------------------
  // Validate file size
  // --------------------------------------------------

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

  if (file.size <= 0) {
    return json(
      {
        success: false,
        detail:
          "The selected image is empty."
      },
      400
    );
  }

  // --------------------------------------------------
  // Convert image to base64
  // --------------------------------------------------

  const bytes =
    new Uint8Array(
      await file.arrayBuffer()
    );

  const base64 =
    uint8ToBase64(bytes);

  // --------------------------------------------------
  // Gemini model
  // --------------------------------------------------

  const model =
    env.GEMINI_MODEL ||
    DEFAULT_MODEL;

  // --------------------------------------------------
  // Prompt
  // --------------------------------------------------

  const prompt = `
You are the facial-analysis engine for FaceBot.

Analyze ONLY the visible facial geometry in the supplied photograph.

IMPORTANT:
- Do not identify the person.
- Do not infer race or ethnicity.
- Do not infer health or medical conditions.
- Do not infer personality, intelligence, sexuality, criminality, or other sensitive traits.
- Analyze only visible facial structure.
- Do not claim to have run MediaPipe.
- Do not claim to have run ExtraTrees.
- Do not invent measurements that cannot be reliably observed.
- Do not provide medical diagnosis.
- Return ONLY valid JSON.

If there is no clearly usable face:
- face_count must be 0
- score must be null
- metrics may be empty
- production_features may be empty

The score must be a number from 0 to 10 or null.

Keep the score internally consistent with the visible observations.

Return this structure:

{
  "face_count": 1,
  "score": 0,
  "metrics": {
    "face_geometry": {
      "face_aspect_ratio": "medium",
      "facial_width_height": "balanced",
      "midface_proportion": "medium"
    },
    "symmetry": {
      "overall_symmetry": "medium"
    },
    "eyes": {
      "eye_spacing": "balanced",
      "eye_aspect_ratio": "medium"
    },
    "eyebrows": {
      "brow_position": "medium",
      "brow_shape": "medium"
    },
    "nose": {
      "nose_width": "medium",
      "nose_length": "medium"
    },
    "jaw": {
      "jaw_width": "medium",
      "jaw_definition": "medium"
    },
    "chin": {
      "chin_projection": "medium",
      "chin_width": "medium"
    },
    "cheeks": {
      "cheek_prominence": "medium"
    },
    "lips_mouth": {
      "mouth_width": "medium",
      "lip_proportion": "balanced"
    }
  },

  "production_features": {
    "facial_width": "medium",
    "facial_height": "medium",
    "jaw_width": "medium",
    "chin_projection": "medium",
    "cheek_prominence": "medium",
    "eye_spacing": "balanced",
    "nose_width": "medium",
    "nose_length": "medium",
    "mouth_width": "medium",
    "midface_length": "medium",
    "symmetry": "medium"
  }
}

Use approximately 20-35 useful feature values.

Use concise metric names.

Qualitative values may include:
"low"
"medium"
"high"
"narrow"
"wide"
"short"
"long"
"balanced"
"asymmetric"
"uncertain"

Do not fabricate exact physical measurements in millimeters.

The score should reflect only visible facial geometry and should not automatically be high.
`;

  // --------------------------------------------------
  // Gemini endpoint
  // --------------------------------------------------

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

  // --------------------------------------------------
  // Gemini request
  // --------------------------------------------------

  const body = {
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
            text: prompt
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.15,
      response_mime_type:
        "application/json"
    }
  };

  const geminiResponse =
    await fetch(
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
          JSON.stringify(body)
      }
    );

  const geminiData =
    await geminiResponse.json();

  // --------------------------------------------------
  // Gemini error
  // --------------------------------------------------

  if (!geminiResponse.ok) {
    console.error(
      "Gemini API response:",
      geminiData
    );

    const message =
      geminiData?.error?.message ||
      `Gemini API error (${geminiResponse.status})`;

    throw new Error(message);
  }

  // --------------------------------------------------
  // Extract text
  // --------------------------------------------------

  const text =
    extractGeminiText(
      geminiData
    );

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  // --------------------------------------------------
  // Parse JSON
  // --------------------------------------------------

  const parsed =
    parseJsonResponse(text);

  // --------------------------------------------------
  // Normalize
  // --------------------------------------------------

  const normalized =
    normalizeAnalysis(
      parsed,
      model
    );

  return json(
    normalized,
    200
  );
}


// ======================================================
// GEMINI RESPONSE
// ======================================================

function extractGeminiText(data) {
  const candidates =
    data?.candidates;

  if (!Array.isArray(candidates)) {
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
      (part) =>
        typeof part?.text === "string"
    )
    .map(
      (part) =>
        part.text
    )
    .join("\n")
    .trim();
}


// ======================================================
// JSON PARSER
// ======================================================

function parseJsonResponse(text) {
  let cleaned =
    String(text).trim();

  // Remove ```json
  if (
    cleaned.startsWith("```json")
  ) {
    cleaned =
      cleaned.slice(7);
  }

  // Remove ```
  if (
    cleaned.startsWith("```")
  ) {
    cleaned =
      cleaned.slice(3);
  }

  if (
    cleaned.endsWith("```")
  ) {
    cleaned =
      cleaned.slice(
        0,
        -3
      );
  }

  cleaned =
    cleaned.trim();

  // Direct parse
  try {
    return JSON.parse(
      cleaned
    );
  } catch (_) {}

  // Try to recover JSON object
  const start =
    cleaned.indexOf("{");

  const end =
    cleaned.lastIndexOf("}");

  if (
    start >= 0 &&
    end > start
  ) {
    const candidate =
      cleaned.slice(
        start,
        end + 1
      );

    try {
      return JSON.parse(
        candidate
      );
    } catch (_) {}
  }

  throw new Error(
    "Gemini returned invalid JSON."
  );
}


// ======================================================
// NORMALIZATION
// ======================================================

function normalizeAnalysis(
  data,
  model
) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "Invalid analysis payload."
    );
  }

  let faceCount =
    Number(
      data.face_count
    );

  if (
    !Number.isFinite(
      faceCount
    )
  ) {
    faceCount = 1;
  }

  faceCount =
    Math.max(
      0,
      Math.round(
        faceCount
      )
    );

  // --------------------------------------------------
  // Score
  // --------------------------------------------------

  let score =
    data.score;

  if (
    score === null ||
    score === undefined ||
    score === ""
  ) {
    score = null;
  } else {
    score =
      Number(score);

    if (
      !Number.isFinite(score)
    ) {
      score = null;
    } else {
      score =
        clamp(
          score,
          0,
          10
        );

      score =
        Math.round(
          score * 100
        ) / 100;
    }
  }

  // --------------------------------------------------
  // Metrics
  // --------------------------------------------------

  const metrics =
    isPlainObject(
      data.metrics
    )
      ? data.metrics
      : {};

  // --------------------------------------------------
  // Production features
  // --------------------------------------------------

  const production =
    isPlainObject(
      data.production_features
    )
      ? data.production_features
      : {};

  const detectedFeatures =
    countLeaves(
      metrics
    );

  const featureCount =
    countLeaves(
      production
    );

  // --------------------------------------------------
  // Final response
  // --------------------------------------------------

  return {
    success: true,

    score,

    face_count:
      faceCount,

    landmarks_count:
      null,

    detected_features:
      detectedFeatures,

    feature_count:
      featureCount,

    model,

    metrics,

    production_features:
      production,

    generated_at:
      new Date().toISOString()
  };
}


// ======================================================
// HELPERS
// ======================================================

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function countLeaves(object) {
  if (
    !isPlainObject(object)
  ) {
    return 0;
  }

  let count = 0;

  for (
    const value of
    Object.values(object)
  ) {
    if (
      isPlainObject(value)
    ) {
      count +=
        countLeaves(value);
    } else {
      count += 1;
    }
  }

  return count;
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


function uint8ToBase64(bytes) {
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


// ======================================================
// RESPONSE
// ======================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type",

    "Cache-Control":
      "no-store"
  };
}


function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
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
