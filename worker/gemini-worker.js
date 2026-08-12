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

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
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

    // Analyze
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


// ======================================================
// ANALYZE
// ======================================================

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

  // --------------------------------------------------
  // CHECK CONTENT TYPE
  // --------------------------------------------------

  const contentType =
    request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json(
      {
        success: false,
        detail: "Expected multipart/form-data."
      },
      400
    );
  }

  // --------------------------------------------------
  // READ FORM DATA
  // --------------------------------------------------

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("FormData error:", error);

    return json(
      {
        success: false,
        detail: "Could not read multipart/form-data."
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
        detail: "No image file was provided. Expected field: file"
      },
      400
    );
  }

  // --------------------------------------------------
  // VALIDATE FILE
  // --------------------------------------------------

  const mimeType =
    file.type || "application/octet-stream";

  if (!ALLOWED_TYPES.has(mimeType)) {
    return json(
      {
        success: false,
        detail: "Only JPG, PNG and WEBP images are supported."
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

  if (file.size <= 0) {
    return json(
      {
        success: false,
        detail: "The image file is empty."
      },
      400
    );
  }

  // --------------------------------------------------
  // CONVERT IMAGE TO BASE64
  // --------------------------------------------------

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64Image = uint8ToBase64(bytes);

  // --------------------------------------------------
  // MODEL
  // --------------------------------------------------

  const model =
    env.GEMINI_MODEL || DEFAULT_MODEL;

  // --------------------------------------------------
  // PROMPT
  // --------------------------------------------------

  const prompt = `
You are the facial-analysis engine for FaceBot.

Analyze ONLY visible facial geometry in the supplied photograph.

Rules:

- Analyze only visible facial structure.
- Do not identify the person.
- Do not infer race or ethnicity.
- Do not infer health or medical conditions.
- Do not infer personality, intelligence, sexuality, criminality, or other sensitive traits.
- Do not claim to have used MediaPipe.
- Do not claim to have used ExtraTrees.
- Do not invent exact measurements in millimeters.
- Do not invent invisible landmarks.
- If the image is unclear, use lower confidence.
- If there is no usable face, face_count must be 0 and score must be null.
- Return ONLY valid JSON.
- All numeric scores must be between 0 and 10.
- Do not automatically give high scores.

Return exactly this JSON structure:

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

For observations that cannot reasonably be expressed as a number, you may use:
"low", "medium", "high", "balanced", or "uncertain".

Do not fabricate exact physical measurements.
`;

  // --------------------------------------------------
  // GEMINI ENDPOINT
  // --------------------------------------------------

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
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

  // --------------------------------------------------
  // CALL GEMINI
  // --------------------------------------------------

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
        body: JSON.stringify(requestBody)
      }
    );
  } catch (error) {
    console.error("Gemini fetch error:", error);

    return json(
      {
        success: false,
        detail: "Could not connect to Gemini API.",
        error: error?.message || "Network error"
      },
      502
    );
  }

  // --------------------------------------------------
  // READ GEMINI RESPONSE SAFELY
  // --------------------------------------------------

  const rawGeminiResponse =
    await geminiResponse.text();

  console.log(
    "Gemini status:",
    geminiResponse.status
  );

  console.log(
    "Gemini response:",
    rawGeminiResponse.slice(0, 5000)
  );

  let geminiData = null;

  if (rawGeminiResponse.trim()) {
    try {
      geminiData =
        JSON.parse(rawGeminiResponse);
    } catch (error) {
      console.error(
        "Gemini response JSON parse error:",
        error
      );

      return json(
        {
          success: false,
          detail: "Gemini returned invalid API JSON.",
          gemini_status: geminiResponse.status,
          raw: rawGeminiResponse.slice(0, 2000)
        },
        502
      );
    }
  }

  // --------------------------------------------------
  // GEMINI HTTP ERROR
  // --------------------------------------------------

  if (!geminiResponse.ok) {
    const message =
      geminiData?.error?.message ||
      `Gemini API error (${geminiResponse.status}).`;

    return json(
      {
        success: false,
        detail: message,
        gemini_status: geminiResponse.status
      },
      geminiResponse.status
    );
  }

  if (!geminiData) {
    return json(
      {
        success: false,
        detail: "Gemini returned an empty response.",
        gemini_status: geminiResponse.status
      },
      502
    );
  }

  // --------------------------------------------------
  // EXTRACT MODEL TEXT
  // --------------------------------------------------

  const text =
    extractGeminiText(geminiData);

  if (!text) {
    console.error(
      "Gemini response had no text:",
      JSON.stringify(geminiData)
    );

    return json(
      {
        success: false,
        detail: "Gemini returned no analysis text.",
        gemini_status: geminiResponse.status
      },
      502
    );
  }

  // --------------------------------------------------
  // PARSE MODEL JSON
  // --------------------------------------------------

  let analysis;

  try {
    analysis =
      parseJsonResponse(text);
  } catch (error) {
    console.error(
      "Gemini analysis JSON error:",
      error
    );

    console.error(
      "Gemini text:",
      text
    );

    return json(
      {
        success: false,
        detail: "Gemini returned invalid analysis JSON.",
        raw: text.slice(0, 5000)
      },
      502
    );
  }

  // --------------------------------------------------
  // NORMALIZE
  // --------------------------------------------------

  return json(
    normalizeAnalysis(
      analysis,
      model
    ),
    200
  );
}


// ======================================================
// EXTRACT GEMINI TEXT
// ======================================================

function extractGeminiText(data) {
  const candidates =
    data?.candidates;

  if (!Array.isArray(candidates)) {
    return "";
  }

  let output = "";

  for (const candidate of candidates) {
    const parts =
      candidate?.content?.parts;

    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (
        typeof part?.text === "string"
      ) {
        output += part.text;
      }
    }
  }

  return output.trim();
}


// ======================================================
// PARSE JSON
// ======================================================

function parseJsonResponse(text) {
  let cleaned =
    String(text || "").trim();

  if (!cleaned) {
    throw new Error(
      "Empty Gemini response."
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

  // Direct JSON
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Continue to recovery
  }

  // Find first JSON object
  const start =
    cleaned.indexOf("{");

  const end =
    cleaned.lastIndexOf("}");

  if (
    start !== -1 &&
    end !== -1 &&
    end > start
  ) {
    const candidate =
      cleaned.slice(
        start,
        end + 1
      );

    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Continue
    }
  }

  throw new Error(
    "Could not parse Gemini JSON."
  );
}


// ======================================================
// NORMALIZE ANALYSIS
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
    Number(data.face_count);

  if (!Number.isFinite(faceCount)) {
    faceCount = 1;
  }

  faceCount =
    Math.max(
      0,
      Math.round(faceCount)
    );

  let score = null;

  if (
    data.score !== null &&
    data.score !== undefined &&
    data.score !== ""
  ) {
    const numericScore =
      Number(data.score);

    if (Number.isFinite(numericScore)) {
      score =
        Math.round(
          clamp(
            numericScore,
            0,
            10
          ) * 100
        ) / 100;
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

  const detectedFeatures =
    countLeaves(metrics);

  const featureCount =
    countLeaves(production);

  return {
    success: true,
    score,
    face_count: faceCount,
    landmarks_count: null,
    detected_features: detectedFeatures,
    feature_count: featureCount,
    model,
    metrics,
    production_features: production,
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
      count += countLeaves(value);
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
  const chunkSize = 0x8000;

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
