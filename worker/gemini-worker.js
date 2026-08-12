const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const DEFAULT_MODEL = "gemini-3.6-flash";

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
    // HEALTH
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
        console.error("FaceBot Worker error:", error);

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
    // DEFAULT
    // ==================================================

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

  // ==================================================
  // MULTIPART
  // ==================================================

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

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error(
      "Multipart parsing error:",
      error
    );

    return json(
      {
        success: false,
        detail:
          "Could not parse multipart/form-data."
      },
      400
    );
  }

  const file = formData.get("file");

  if (
    !file ||
    typeof file.arrayBuffer !== "function"
  ) {
    return json(
      {
        success: false,
        detail:
          "No image file was provided. Expected field: file"
      },
      400
    );
  }

  // ==================================================
  // FILE VALIDATION
  // ==================================================

  const mimeType =
    file.type ||
    "application/octet-stream";

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
          "The image file is empty."
      },
      400
    );
  }

  // ==================================================
  // FILE -> BASE64
  // ==================================================

  const bytes =
    new Uint8Array(
      await file.arrayBuffer()
    );

  const base64 =
    uint8ToBase64(bytes);

  // ==================================================
  // MODEL
  // ==================================================

  const model =
    env.GEMINI_MODEL ||
    DEFAULT_MODEL;

  // ==================================================
  // PROMPT
  // ==================================================

  const prompt = `
You are the facial-analysis engine for FaceBot.

Analyze ONLY the visible facial geometry in the supplied photograph.

IMPORTANT RULES:

- Analyze only what is visibly present.
- Do not identify the person.
- Do not infer race or ethnicity.
- Do not infer health or medical conditions.
- Do not infer personality, intelligence, sexuality,
  criminality, or other sensitive traits.
- Do not claim to have run MediaPipe.
- Do not claim to have run ExtraTrees.
- Do not invent exact physical measurements in millimeters.
- Do not invent landmarks that cannot be seen.
- If the image is unclear, say so through lower confidence.
- Return ONLY valid JSON.
- All scores must be numeric values from 0 to 10.
- Scores should not automatically be high.
- If no usable face is visible, return face_count = 0
  and score = null.

Return this structure:

{
  "face_count": number,
  "score": number|null,

  "metrics": {
    "face_geometry": {
      "face_aspect_ratio": number|string,
      "facial_width_height": number|string,
      "midface_proportion": number|string
    },

    "symmetry": {
      "overall_symmetry": number|string,
      "left_right_balance": number|string
    },

    "eyes": {
      "eye_spacing": number|string,
      "eye_aspect_ratio": number|string,
      "eye_alignment": number|string
    },

    "eyebrows": {
      "brow_position": number|string,
      "brow_shape": number|string
    },

    "nose": {
      "nose_width": number|string,
      "nose_length": number|string,
      "nose_proportion": number|string
    },

    "jaw": {
      "jaw_width": number|string,
      "jaw_definition": number|string,
      "jaw_shape": number|string
    },

    "chin": {
      "chin_prominence": number|string,
      "chin_proportion": number|string
    },

    "cheeks": {
      "cheek_prominence": number|string,
      "cheek_definition": number|string
    },

    "lips_mouth": {
      "mouth_width": number|string,
      "lip_proportion": number|string
    },

    "midface": {
      "midface_balance": number|string
    }
  },

  "production_features": {
    "overall_harmony": number|string,
    "frontal_harmony": number|string,
    "facial_definition": number|string,
    "angularity": number|string,
    "proportions": number|string,
    "symmetry": number|string,
    "confidence": number|string
  }
}

Use approximately 20-35 useful feature values.

For uncertain observations use:
"low", "medium", "high", "balanced", or "uncertain".

Do not fabricate exact millimeter measurements.
`;

  // ==================================================
  // GEMINI REQUEST
  // ==================================================

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

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
      response_mime_type: "application/json"
    }
  };

  let geminiResponse;

  try {
    geminiResponse = await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify(body)
      }
    );
  } catch (error) {
    console.error(
      "Gemini network error:",
      error
    );

    return json(
      {
        success: false,
        detail:
          `Could not connect to Gemini API: ${
            error?.message || "network error"
          }`
      },
      502
    );
  }

  // ==================================================
  // IMPORTANT:
  // DO NOT USE geminiResponse.json()
  //
  // We read text first so an empty/non-JSON Gemini
  // response cannot cause:
  //
  // Unexpected end of JSON input
  // ==================================================

  const rawGeminiResponse =
    await geminiResponse.text();

  console.log(
    "Gemini HTTP status:",
    geminiResponse.status
  );

  console.log(
    "Gemini raw response length:",
    rawGeminiResponse.length
  );

  if (!rawGeminiResponse.trim()) {
    console.error(
      "Gemini returned an empty response."
    );

    return json(
      {
        success: false,
        detail:
          `Gemini returned an empty response (HTTP ${geminiResponse.status}).`
      },
      502
    );
  }

  let geminiData = null;

  try {
    geminiData =
      JSON.parse(rawGeminiResponse);
  } catch (error) {
    console.error(
      "Gemini returned non-JSON response:",
      rawGeminiResponse.slice(0, 2000)
    );

    return json(
      {
        success: false,
        detail:
          `Gemini returned invalid JSON (HTTP ${geminiResponse.status}).`
      },
      502
    );
  }

  // ==================================================
  // GEMINI API ERROR
  // ==================================================

  if (!geminiResponse.ok) {
    console.error(
      "Gemini API response:",
      geminiData
    );

    const message =
      geminiData?.error?.message ||
      `Gemini API error (${geminiResponse.status})`;

    return json(
      {
        success: false,
        detail: message
      },
      geminiResponse.status
    );
  }

  // ==================================================
  // EXTRACT TEXT
  // ==================================================

  const text =
    extractGeminiText(
      geminiData
    );

  if (!text) {
    console.error(
      "Gemini response contained no text:",
      JSON.stringify(geminiData).slice(0, 4000)
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

  // ==================================================
  // PARSE GEMINI JSON
  // ==================================================

  let parsed;

  try {
    parsed =
      parseJsonResponse(text);
  } catch (error) {
    console.error(
      "Gemini analysis JSON error:",
      error
    );

    console.error(
      "Gemini analysis text:",
      text.slice(0, 5000)
    );

    return json(
      {
        success: false,
        detail:
          "Gemini returned invalid analysis JSON."
      },
      502
    );
  }

  // ==================================================
  // NORMALIZE
  // ==================================================

  let normalized;

  try {
    normalized =
      normalizeAnalysis(
        parsed,
        model
      );
  } catch (error) {
    console.error(
      "Normalization error:",
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
    normalized,
    200
  );
}


// ======================================================
// GEMINI RESPONSE TEXT
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
  cleaned =
    cleaned.replace(
      /^```json\s*/i,
      ""
    );

  // Remove ```
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

  // First attempt
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Recover JSON object
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
      return JSON.parse(candidate);
    } catch (_) {
      // continue
    }
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

  if (!Number.isFinite(faceCount)) {
    faceCount = 1;
  }

  faceCount =
    Math.max(
      0,
      Math.round(faceCount)
    );

  let score =
    data.score;

  if (
    score === null ||
    score === undefined ||
    score === ""
  ) {
    score = null;
  } else {
    score = Number(score);

    if (!Number.isFinite(score)) {
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

  const metrics =
    isPlainObject(
      data.metrics
    )
      ? data.metrics
      : {};

  const production =
    isPlainObject(
      data.production_features
    )
      ? data.production_features
      : {};

  const detectedFeatures =
    countLeaves(metrics);

  const featureCount =
    countLeaves(production);

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
  if (!isPlainObject(object)) {
    return 0;
  }

  let count = 0;

  for (const value of Object.values(object)) {
    if (isPlainObject(value)) {
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

    binary +=
      String.fromCharCode(
        ...chunk
      );
  }

  return btoa(binary);
}


// ======================================================
// CORS
// ======================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept",

    "Cache-Control":
      "no-store"
  };
}


// ======================================================
// JSON RESPONSE
// ======================================================

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
