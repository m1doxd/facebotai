"use strict";

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

    // CORS preflight
    if (request.method === "OPTIONS") {
      return json(null, 204);
    }

    // Health check
    if (url.pathname === "/api/health") {
      return json({
        success: true,
        service: "facebot-gemini",
        status: "ok",
        model: env.GEMINI_MODEL || DEFAULT_MODEL
      });
    }

    // Main analysis endpoint
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
        console.error("WORKER UNCAUGHT ERROR:", error);
        console.error("ERROR STACK:", error?.stack);

        return json(
          {
            success: false,
            detail: error?.message || "Internal server error."
          },
          500
        );
      }
    }

    return new Response(
      "FaceBot Gemini Worker is running.",
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
};


// ============================================================
// ANALYZE
// ============================================================

async function analyze(request, env) {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return json(
      {
        success: false,
        detail: "GEMINI_API_KEY is not configured."
      },
      500
    );
  }

  const contentType =
    request.headers.get("content-type") || "";

  console.log("CONTENT-TYPE:", contentType);

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

  // ----------------------------------------------------------
  // Parse multipart/form-data
  // ----------------------------------------------------------

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error(
      "FORM DATA PARSE ERROR:",
      error
    );

    console.error(
      "FORM DATA ERROR STACK:",
      error?.stack
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

  const mimeType = file.type || "";

  console.log("FILE TYPE:", mimeType);
  console.log("FILE SIZE:", file.size);

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

  // ----------------------------------------------------------
  // Convert image to base64
  // ----------------------------------------------------------

  let base64;

  try {
    const bytes =
      new Uint8Array(
        await file.arrayBuffer()
      );

    base64 = uint8ToBase64(bytes);
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

  // ----------------------------------------------------------
  // Prompt
  // ----------------------------------------------------------

  const prompt = `
You are the facial-analysis engine for FaceBot.

Analyze ONLY visible facial geometry in the supplied photograph.

Rules:

- Analyze only what is visibly present.
- Do not identify the person.
- Do not infer race or ethnicity.
- Do not infer health or medical conditions.
- Do not infer personality, intelligence, sexuality, criminality, or other sensitive traits.
- Do not claim to have run MediaPipe.
- Do not claim to have run ExtraTrees.
- Do not invent exact physical measurements in millimeters.
- Do not invent invisible landmarks.
- If the image is unclear, use lower confidence.
- If no usable face is visible, return face_count = 0 and score = null.
- Return ONLY valid JSON.
- All numeric scores must be between 0 and 10.
- Do not automatically give high scores.

Return exactly this structure:

{
  "face_count": 1,
  "score": 0,
  "metrics": {
    "face_geometry": {
      "face_aspect_ratio": 0,
      "facial_width_height": 0,
      "midface_proportion": 0
    },
    "symmetry": {
      "overall_symmetry": 0,
      "left_right_balance": 0
    },
    "eyes": {
      "eye_spacing": 0,
      "eye_aspect_ratio": 0,
      "eye_alignment": 0
    },
    "eyebrows": {
      "brow_position": 0,
      "brow_shape": 0
    },
    "nose": {
      "nose_width": 0,
      "nose_length": 0,
      "nose_proportion": 0
    },
    "jaw": {
      "jaw_width": 0,
      "jaw_definition": 0,
      "jaw_shape": 0
    },
    "chin": {
      "chin_prominence": 0,
      "chin_proportion": 0
    },
    "cheeks": {
      "cheek_prominence": 0,
      "cheek_definition": 0
    },
    "lips_mouth": {
      "mouth_width": 0,
      "lip_proportion": 0
    },
    "midface": {
      "midface_balance": 0
    }
  },
  "production_features": {
    "overall_harmony": 0,
    "frontal_harmony": 0,
    "facial_definition": 0,
    "angularity": 0,
    "proportions": 0,
    "symmetry": 0,
    "confidence": 0
  }
}

Use approximately 20-35 useful feature values.

For observations that cannot reasonably be represented numerically, use:

"low",
"medium",
"high",
"balanced",
or
"uncertain".

Do not fabricate exact millimeter measurements.
`;

  // ----------------------------------------------------------
  // Gemini endpoint
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Send request to Gemini
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Read Gemini response
  // ----------------------------------------------------------

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

  console.log(
    "GEMINI RESPONSE PREVIEW:",
    rawResponse.slice(0, 2000)
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

  // ----------------------------------------------------------
  // Parse Gemini API JSON
  // ----------------------------------------------------------

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
      "GEMINI RAW RESPONSE:",
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

  // ----------------------------------------------------------
  // Gemini HTTP error
  // ----------------------------------------------------------

  if (!geminiResponse.ok) {
    const message =
      geminiData?.error?.message ||
      `Gemini API error (${geminiResponse.status}).`;

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
        detail: message
      },
      geminiResponse.status
    );
  }

  // ----------------------------------------------------------
  // Extract model text
  // ----------------------------------------------------------

  const text =
    extractGeminiText(
      geminiData
    );

  if (!text) {
    console.error(
      "NO GEMINI TEXT:"
    );

    console.error(
      JSON.stringify(
        geminiData,
        null,
        2
      ).slice(0, 5000)
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
    "GEMINI ANALYSIS TEXT:",
    text.slice(0, 5000)
  );

  // ----------------------------------------------------------
  // Parse analysis JSON
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // Normalize
  // ----------------------------------------------------------

  let normalized;

  try {
    normalized =
      normalizeAnalysis(
        parsed,
        model
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

  return json(normalized);
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

  // Remove markdown code fences
  cleaned = cleaned.replace(
    /^```json\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /^```\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /\s*```$/i,
    ""
  );

  cleaned = cleaned.trim();

  // First attempt
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn(
      "Direct JSON parse failed:",
      error?.message
    );
  }

  // Find first object
  const start =
    cleaned.indexOf("{");

  if (start < 0) {
    throw new Error(
      "Gemini response does not contain a JSON object."
    );
  }

  // Try to find a valid closing brace.
  // This is safer than blindly using lastIndexOf.
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
            "Recovered JSON parse failed:",
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
    faceCount = 0;
  }

  faceCount =
    Math.max(
      0,
      Math.round(
        faceCount
      )
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
    score =
      Number(score);

    if (
      !Number.isFinite(
        score
      )
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

  return {
    success: true,

    score,

    face_count:
      faceCount,

    landmarks_count:
      null,

    detected_features:
      countLeaves(metrics),

    feature_count:
      countLeaves(production),

    model,

    metrics,

    production_features:
      production,

    generated_at:
      new Date().toISOString()
  };
}


// ============================================================
// HELPERS
// ============================================================

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
      count++;
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

    binary +=
      String.fromCharCode(
        ...chunk
      );
  }

  return btoa(binary);
}


// ============================================================
// CORS
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept",

    "Cache-Control":
      "no-store"
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
