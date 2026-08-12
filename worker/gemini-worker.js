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

    if (request.method === "OPTIONS") {
      return json(null, 204);
    }

    if (url.pathname === "/api/health") {
      return json({
        success: true,
        service: "facebot-gemini",
        status: "ok",
        model: env.GEMINI_MODEL || DEFAULT_MODEL
      });
    }

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
        console.error("Worker error:", error);

        return json(
          {
            success: false,
            detail: error?.message || "Internal server error."
          },
          500
        );
      }
    }

    return new Response("FaceBot Gemini Worker is running.", {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }
};

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

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json(
      {
        success: false,
        detail: "Expected multipart/form-data."
      },
      400
    );
  }

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("FormData error:", error);

    return json(
      {
        success: false,
        detail: "Could not parse multipart/form-data."
      },
      400
    );
  }

  const file = formData.get("file");

  if (!file || typeof file.arrayBuffer !== "function") {
    return json(
      {
        success: false,
        detail: "No image file was provided. Expected field: file"
      },
      400
    );
  }

  const mimeType = file.type || "";

  if (!ALLOWED_TYPES.has(mimeType)) {
    return json(
      {
        success: false,
        detail: "Only JPG, PNG and WEBP images are supported."
      },
      400
    );
  }

  if (file.size <= 0) {
    return json(
      {
        success: false,
        detail: "The image file is empty."
      },
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return json(
      {
        success: false,
        detail: "Image is too large. Maximum size is 15 MB."
      },
      413
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = uint8ToBase64(bytes);

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

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

Return exactly this general structure:

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
"low", "medium", "high", "balanced", or "uncertain".

Do not fabricate exact millimeter measurements.
`;

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
      response_mime_type: "application/json"
    }
  };

  let geminiResponse;

  try {
    geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    console.error("Gemini network error:", error);

    return json(
      {
        success: false,
        detail:
          "Could not connect to Gemini API: " +
          (error?.message || "network error")
      },
      502
    );
  }

  const rawResponse = await geminiResponse.text();

  console.log(
    "Gemini HTTP status:",
    geminiResponse.status
  );

  console.log(
    "Gemini response length:",
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
    geminiData = JSON.parse(rawResponse);
  } catch (error) {
    console.error(
      "Gemini raw response:",
      rawResponse.slice(0, 3000)
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

  if (!geminiResponse.ok) {
    const message =
      geminiData?.error?.message ||
      `Gemini API error (${geminiResponse.status}).`;

    console.error("Gemini API error:", geminiData);

    return json(
      {
        success: false,
        detail: message
      },
      geminiResponse.status
    );
  }

  const text = extractGeminiText(geminiData);

  if (!text) {
    console.error(
      "No Gemini text:",
      JSON.stringify(geminiData).slice(0, 4000)
    );

    return json(
      {
        success: false,
        detail: "Gemini returned no analysis text."
      },
      502
    );
  }

  let parsed;

  try {
    parsed = parseJsonResponse(text);
  } catch (error) {
    console.error("Analysis JSON error:", error);
    console.error("Analysis text:", text.slice(0, 5000));

    return json(
      {
        success: false,
        detail: "Gemini returned invalid analysis JSON."
      },
      502
    );
  }

  let normalized;

  try {
    normalized = normalizeAnalysis(parsed, model);
  } catch (error) {
    console.error("Normalization error:", error);

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

function extractGeminiText(data) {
  const candidates = data?.candidates;

  if (!Array.isArray(candidates)) {
    return "";
  }

  const parts = candidates[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .filter(
      (part) =>
        typeof part?.text === "string"
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function parseJsonResponse(text) {
  let cleaned = String(text).trim();

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

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Continue with recovery.
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start >= 0 && end > start) {
    const candidate = cleaned.slice(
      start,
      end + 1
    );

    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Continue.
    }
  }

  throw new Error(
    "Gemini returned invalid JSON."
  );
}

function normalizeAnalysis(data, model) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "Invalid analysis payload."
    );
  }

  let faceCount = Number(
    data.face_count
  );

  if (!Number.isFinite(faceCount)) {
    faceCount = 0;
  }

  faceCount = Math.max(
    0,
    Math.round(faceCount)
  );

  let score = data.score;

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
      score = clamp(score, 0, 10);
      score =
        Math.round(score * 100) / 100;
    }
  }

  const metrics =
    isPlainObject(data.metrics)
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

    face_count: faceCount,

    landmarks_count: null,

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
      count += countLeaves(value);
    } else {
      count += 1;
    }
  }

  return count;
}

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function uint8ToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = "";

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk = bytes.subarray(
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

  return btoa(binary);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept",
    "Cache-Control": "no-store"
  };
}

function json(data, status = 200) {
  return new Response(
    data === null
      ? null
      : JSON.stringify(data, null, 2),
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
