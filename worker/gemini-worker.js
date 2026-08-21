"use strict";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const DEFAULT_MODEL = "gemini-3.6-flash";

// Deployment marker: 2026-08-16-merged-landmark-metric-motion-v1
// This intentionally changes the Worker source so Git/Cloudflare
// detects a new deployment.
const WORKER_BUILD = "2026-08-16-merged-landmark-metric-motion-v1";

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
    // VALIDATE GEMINI KEY
    // ========================================================

    if (url.pathname === "/api/validate-key") {
      if (request.method !== "POST") {
        return json({ success: false, detail: "Method not allowed." }, 405);
      }

      try {
        return await validateGeminiKey(request, env);
      } catch (error) {
        console.error("VALIDATE KEY ERROR:", error);
        return json({
          success: false,
          code: "GEMINI_VALIDATE_ERROR",
          detail: error?.message || "Could not validate Gemini API key."
        }, 500);
      }
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
// GEMINI KEY VALIDATION
// ============================================================

async function validateGeminiKey(request, env) {
  const apiKey = request.headers.get("X-Gemini-Key")?.trim() || "";
  if (!apiKey) {
    return json({
      success: false,
      code: "GEMINI_KEY_REQUIRED",
      detail: "Gemini API key is required."
    }, 400);
  }

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with exactly: OK" }] }],
        generationConfig: { maxOutputTokens: 4, temperature: 0 }
      })
    });
  } catch (error) {
    return json({
      success: false,
      code: "GEMINI_NETWORK_ERROR",
      detail: "Could not reach Gemini."
    }, 502);
  }

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!response.ok) {
    const code = response.status === 429
      ? "GEMINI_QUOTA_EXCEEDED"
      : (response.status === 400 || response.status === 401 || response.status === 403)
        ? "GEMINI_INVALID_KEY"
        : "GEMINI_API_ERROR";
    return json({
      success: false,
      code,
      detail: data?.error?.message || `Gemini returned HTTP ${response.status}.`,
      gemini_status: response.status
    }, response.status === 429 ? 429 : 400);
  }

  return json({
    success: true,
    model,
    validated: true
  });
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
  const analysisGender = formData.get("gender") === "female" ? "female" : "male";

  let clientProfileLandmarks = {};
  let profileProvided = Boolean(profileFile && typeof profileFile.arrayBuffer === "function");

  try {
    const rawClientProfileLandmarks = formData.get("client_profile_landmarks");
    if (typeof rawClientProfileLandmarks === "string" && rawClientProfileLandmarks.trim()) {
      const parsedClientProfileLandmarks = JSON.parse(rawClientProfileLandmarks);
      if (parsedClientProfileLandmarks && typeof parsedClientProfileLandmarks === "object" && !Array.isArray(parsedClientProfileLandmarks)) {
        clientProfileLandmarks = parsedClientProfileLandmarks;
      }
    }
  } catch (error) {
    console.warn("CLIENT PROFILE LANDMARK PARSE ERROR:", error);
  }

  let clientLandmarks = {};
  try {
    const rawClientLandmarks = formData.get("client_landmarks");
    if (typeof rawClientLandmarks === "string" && rawClientLandmarks.trim()) {
      const parsedClientLandmarks = JSON.parse(rawClientLandmarks);
      if (parsedClientLandmarks && typeof parsedClientLandmarks === "object" && !Array.isArray(parsedClientLandmarks)) {
        clientLandmarks = parsedClientLandmarks;
      }
    }
  } catch (error) {
    console.warn("CLIENT LANDMARK PARSE ERROR:", error);
  }

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

  // ========================================================
  // IMAGE -> BASE64
  // ========================================================

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

  // Optional profile image -> BASE64.
  let profileBase64 = null;
  let profileMimeType = null;
  if (profileProvided) {
    profileMimeType = profileFile.type || "image/jpeg";
    if (ALLOWED_TYPES.has(profileMimeType) && profileFile.size > 0) {
      try {
        profileBase64 = uint8ToBase64(new Uint8Array(await profileFile.arrayBuffer()));
      } catch (error) {
        console.warn("PROFILE IMAGE READ ERROR:", error);
        profileProvided = false;
      }
    } else {
      profileProvided = false;
    }
  }

  // ========================================================
  // GEMINI PROMPT
  // ========================================================

  const prompt = `
You are the visual facial-analysis engine for FaceBot.

Your job is to analyze the visible facial geometry in the supplied
photograph and return structured JSON.

INPUT VIEWS:
- FIRST image: frontal view.
- ${profileProvided && profileBase64 ? "SECOND image: real profile view of the same person. It MUST be used for profile analysis." : "No usable profile image was supplied."}

CONFIRMED PROFILE LANDMARKS:
${profileProvided && Object.keys(clientProfileLandmarks).length ? JSON.stringify(clientProfileLandmarks) : "None"}

If a usable second profile image is present, profile.available MUST be true.
Do not infer profile availability from the frontal image.
Use supplied profile landmarks as confirmed geometric anchors.

IMPORTANT:

This is a visual geometry analysis system.

Do NOT identify the person.

Do NOT infer:
- race,
- ethnicity,
- health,
- medical conditions,
- personality,
- intelligence,
- sexuality,
- criminality,
- political affiliation,
- religion,
- or other sensitive personal attributes.

You may evaluate visible facial appearance and geometry.

Do not claim to have used MediaPipe, OpenCV, ExtraTrees,
or another tool unless it was actually provided to you.

Do not invent exact millimeter measurements.

Do not invent landmarks that cannot reasonably be located.

If the image quality is poor, use lower confidence.

If the face is not usable, return:
face_count = 0
score = null

============================================================
VIEW / POSE ANALYSIS
============================================================

First determine what kind of image this is.

Possible view values:

- "frontal"
- "near_frontal"
- "profile"
- "near_profile"
- "three_quarter"
- "unknown"

A frontal image is the preferred primary analysis view.

A profile image is optional.

A three-quarter image must NOT be treated as a perfect frontal
or perfect profile image.

Estimate visible head roll.

The roll angle means the clockwise/counter-clockwise rotation
of the face in the image.

Use:

positive roll = face tilted clockwise
negative roll = face tilted counter-clockwise

The frontend will later use this value to rotate the image
and create an aligned analysis view.

DO NOT generate or modify the image yourself.

Return only the estimated correction angle.

============================================================
FACE USABILITY
============================================================

Estimate:

- face detection confidence
- frontal suitability
- profile suitability
- image quality
- pose confidence

Use values between 0 and 1.

A face can be detected but still be unsuitable for accurate
measurement.

For example:

face_count = 1
face_quality = 0.91
frontal_suitability = 0.95

is good.

============================================================
LANDMARK REPRESENTATION
============================================================

When possible, return approximate normalized landmark positions.

Coordinates must use:

x = 0.0 to 1.0
y = 0.0 to 1.0

Origin:

top-left = (0,0)

bottom-right = (1,1)

Only return landmarks that are visibly identifiable.

The purpose of these landmarks is future frontend visualization.

Do not pretend these coordinates are medical-grade measurements.

Useful landmark names may include:

- left_eye_inner
- left_eye_outer
- right_eye_inner
- right_eye_outer
- left_brow_inner
- left_brow_outer
- right_brow_inner
- right_brow_outer
- nose_bridge
- nose_tip
- nose_left
- nose_right
- mouth_left
- mouth_right
- upper_lip_center
- lower_lip_center
- chin
- left_jaw
- right_jaw
- left_cheekbone
- right_cheekbone
- forehead_center

LANDMARK ACCURACY RULES:
- Place each point on the actual visible anatomical feature, never on a
  nearby feature or a generic face-box location.
- mouth_left and mouth_right are the two visible mouth corners.
- nose_left and nose_right are the left and right visible edges of the nasal
  alar region, never the philtrum or upper lip.
- upper_lip_center and lower_lip_center are centered on the corresponding
  lip vermilion.
- chin is the lowest visible chin point, not the neck.
- left_jaw and right_jaw are on the mandibular contour, not the cheek or neck.
- left_cheekbone and right_cheekbone are on the lateral cheekbone region.
- forehead_center is on the visible center of the forehead.
- nose_bridge is on the bridge between the eyes; nose_tip is on the actual tip.
- Never substitute one landmark for another because it is visually nearby.
- When a feature is not reliably visible, lower confidence rather than moving
  the point to another anatomical structure.

============================================================
AUTHORITATIVE GEOMETRIC LANDMARKS
============================================================

The browser may provide a client_landmarks object detected by a dedicated
face-landmark model. When present, these coordinates are authoritative for
landmark placement and geometric calculations. Do not move them to another
anatomical feature. You may still use the photograph to assess visibility and
quality.

CLIENT LANDMARKS:

${JSON.stringify(clientLandmarks)}

When client landmarks are present, preserve their coordinates in the returned
landmarks object and base geometry-related metric reasoning on those points.
Do not replace a supplied point with an approximate Gemini estimate.

AUTHORITATIVE PROFILE LANDMARKS
For profile-related metrics, use the manually confirmed profile landmarks below.
They are the canonical anchors for profile visualization and must never be
replaced with frontal points or guessed alternatives.

CLIENT PROFILE LANDMARKS:
${JSON.stringify(clientProfileLandmarks)}

============================================================
METRIC SYSTEM
============================================================

Every numeric metric score must be between 0 and 10.

Do not give every metric a high score.

COMPLETENESS RULE:
For each conceptual group below, evaluate every item that is clearly supported by the supplied image(s) and landmarks. Do not return an empty group merely because a metric is difficult to phrase. If a metric truly cannot be measured from the available view, OMIT that metric rather than inventing a placeholder, "insufficient data" object, or guessed score.
For the front view, prioritize a dense useful set across face geometry, eyes, eyebrows, nose, jaw, chin, cheeks, lips/mouth, midface and symmetry.

Use the following conceptual groups.

------------------------------------------------------------
FACE GEOMETRY
------------------------------------------------------------

- face_aspect_ratio
- facial_width_height_balance
- midface_proportion
- lower_face_proportion
- upper_face_proportion
- facial_thirds_balance

------------------------------------------------------------
SYMMETRY
------------------------------------------------------------

- overall_symmetry
- left_right_balance
- eye_alignment
- brow_symmetry
- mouth_symmetry
- jaw_symmetry

------------------------------------------------------------
EYES
------------------------------------------------------------

- eye_spacing
- eye_aspect_ratio
- eye_alignment
- eye_area_balance
- eye_shape_harmony

------------------------------------------------------------
EYEBROWS
------------------------------------------------------------

- brow_position
- brow_shape
- brow_length
- brow_symmetry
- brow_eye_relationship

------------------------------------------------------------
NOSE
------------------------------------------------------------

- nose_width
- nose_length
- nose_proportion
- nose_face_relationship
- nose_symmetry

------------------------------------------------------------
JAW
------------------------------------------------------------

- jaw_width
- jaw_definition
- jaw_shape
- jaw_symmetry
- lower_face_definition

------------------------------------------------------------
CHIN
------------------------------------------------------------

- chin_prominence
- chin_proportion
- chin_width
- chin_face_relationship

------------------------------------------------------------
CHEEKS / CHEEKBONES
------------------------------------------------------------

- cheek_prominence
- cheek_definition
- cheek_symmetry
- cheek_jaw_relationship

------------------------------------------------------------
LIPS / MOUTH
------------------------------------------------------------

- mouth_width
- lip_proportion
- mouth_symmetry
- lip_shape
- mouth_face_relationship

------------------------------------------------------------
MIDFACE
------------------------------------------------------------

- midface_balance
- midface_length
- midface_eye_relationship
- midface_lower_face_relationship

------------------------------------------------------------
VISIBLE SKIN / HAIR / EYE DETAILS (OPTIONAL)
------------------------------------------------------------

Return these ONLY when the feature is directly visible and sufficiently clear.
These are visual appearance descriptors, NOT medical diagnoses.
Do not infer disease or hidden conditions.

Group skin_hair may include:
- acne
- post_acne
- eczema (only as visible surface irritation/patchiness, otherwise null)
- hair_loss
- hair_dryness
- nasolabial_folds
- forehead_lines
- glabellar_lines
- crow_feet
- under_eye_area
- dark_circles
- eye_bags
- brow_density
- brow_color
- eyelash_visibility

Group visible_features may include:
- eye_protrusion
- eye_redness
- scleral_show
- sclera_redness
- eyelid_ptosis
- upper_eyelid
- bulbous_nose_tip
- nostril_visibility

If visibility is insufficient, OMIT the metric instead of returning a placeholder or guessed value.

============================================================
ANGULARITY
============================================================

Estimate visible structural definition only.

Return:

- angularity
- facial_definition
- jaw_definition
- cheek_definition
- chin_definition

Do not interpret these as biological or medical characteristics.

============================================================
VISUAL DIMORPHISM
============================================================

This is an optional visual-appearance category.

Only evaluate visible facial morphology.

Do NOT infer biological sex with certainty.

Use:

- dimorphism
- jaw_dimorphism
- brow_dimorphism
- cheek_dimorphism
- chin_dimorphism
- facial_width_dimorphism

If the image is insufficient for this category,
return lower confidence or null.

============================================================
HARMONY
============================================================

Return separate scores for:

- overall_harmony
- frontal_harmony
- profile_harmony
- proportions
- symmetry_harmony
- feature_harmony
- facial_definition
- angularity

Profile harmony MUST be null if no useful profile view exists.

============================================================
OVERALL SCORE
============================================================

Return one overall visual harmony score from 0 to 10.

This score should reflect the visible facial geometry
and the quality of the usable image.

Do not make the score artificially high.

STRICT CALIBRATION:
- Most ordinary faces must fall around 4.5-6.5.
- Scores above 7 are uncommon and require clearly above-average visible harmony.
- Scores above 8 are rare.
- Scores 9+ are exceptional and should almost never occur.
- Never increase scores to be polite or avoid criticism.

The score is an appearance-analysis score, not a measure
of human worth.

============================================================
SCORE DISTRIBUTION CALIBRATION

Use realistic population distribution:
0-2.99: very uncommon / severe visible imbalance
3-4.49: below average
4.5-5.99: average range
6-6.99: above average
7-7.99: strong features
8-8.99: rare
9+: exceptional

============================================================
COMMUNITY-STYLE TIER
============================================================

Return a community-style label based on the score.

Use this fixed application mapping:

1.0 - 1.99:
"Sub 3"

2.0 - 3.99:
"Sub 5"

4.0 - 4.99:
"LTN"

5.0 - 5.49:
"MTN"

5.5 - 6.49:
"HTN"

6.5 - 7.49:
"Chadlite"

7.5 - 8.99:
"Chad"

9.0 - 9.49:
"Adamlite"

9.5 - 9.99:
"Near True Adam"

10.0:
"True Adam"

Also return:

- tier
- tier_level

tier_level should be one of:

"low"
"mid"
"high"
"base"

For example:

6.1 -> HTN / mid
6.4 -> HTN / high
7.0 -> Chadlite / mid
8.2 -> Chad / mid

Do NOT use these labels for people outside the score
calculation. They are only the application's display labels.

============================================================
METRIC VISUALIZATION
============================================================

For important metrics, return a visualization object.

Example:

{
  "value": 7.2,
  "score": 8.1,
  "status": "good",
  "ideal_min": 7.0,
  "ideal_max": 9.0,
  "unit": "ratio",
  "landmarks": [
    "left_eye_inner",
    "right_eye_inner"
  ]
}

LANDMARK SELECTION FOR METRIC VISUALIZATION:

For every metric that has a numeric value, return a landmarks array whenever
the required anatomical points are visible in CLIENT LANDMARKS.

Rules:
- Use ONLY landmark names that exist in CLIENT LANDMARKS.
- Do not invent landmark names.
- Select the MINIMUM set of points needed to explain the metric.
- Order the landmarks in the exact geometric order that the frontend should
  connect them.
- For a width/length metric use the two endpoints.
- For an angle use the three points in geometric order A -> vertex -> B.
- For a symmetry metric use the corresponding left/right points and any center
  point required to explain the comparison.
- If the required client landmarks are not visible/reliable, return an empty
  landmarks array and lower the metric confidence/status instead of guessing.
- The frontend will draw the visualization from these exact landmark names.
  Do not return coordinates inside a metric; return landmark names only.

status must be one of:

"good"
"average"
"poor"
"uncertain"

If a reliable ideal range cannot be established from the
visible image, use:

ideal_min = null
ideal_max = null
status = "uncertain"

Do not invent scientific reference ranges.

The frontend will later use these fields to visually explain
which part of the face the metric represents.

============================================================
OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

Return exactly this high-level structure:

{
  "face_count": 1,

  "view": {
    "type": "frontal",
    "confidence": 0.0,
    "frontal_suitability": 0.0,
    "profile_suitability": 0.0,
    "image_quality": 0.0,

    "roll": {
      "angle_degrees": 0.0,
      "correction_degrees": 0.0,
      "confidence": 0.0
    }
  },

  "frontal": {
    "available": true,
    "confidence": 0.0,
    "harmony": 0.0
  },

  "profile": {
    "available": false,
    "confidence": 0.0,
    "harmony": null
  },

  "landmarks": {
    "left_eye_inner": {
      "x": 0.0,
      "y": 0.0,
      "confidence": 0.0
    }
  },

  "score": 0.0,

  "percent": 0,

  "tier": {
    "name": "HTN",
    "level": "mid"
  },

  "sections": {
    "harmony": 0.0,
    "dimorphism": 0.0,
    "features": 0.0,
    "angularity": 0.0,
    "symmetry": 0.0,
    "proportions": 0.0
  },

  "metrics": {
    "face_geometry": {},
    "symmetry": {},
    "eyes": {},
    "eyebrows": {},
    "nose": {},
    "jaw": {},
    "chin": {},
    "cheeks": {},
    "lips_mouth": {},
    "midface": {},
    "angularity": {},
    "dimorphism": {}
  },

  "production_features": {
    "overall_harmony": 0.0,
    "frontal_harmony": 0.0,
    "profile_harmony": null,
    "facial_definition": 0.0,
    "angularity": 0.0,
    "proportions": 0.0,
    "symmetry": 0.0,
    "confidence": 0.0,
    "dimorphism": 0.0
  }
}

IMPORTANT:

If profile is not present:

"profile": {
  "available": false,
  "confidence": 0.0,
  "harmony": null
}

Do NOT create fake profile measurements.

If the face is unusable:

{
  "face_count": 0,
  "score": null
}

with the remaining fields populated as reasonably as possible.

============================================================
`;

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
          { text: "FIRST IMAGE: FRONTAL VIEW" },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          },
          ...(profileProvided && profileBase64 ? [
            { text: "SECOND IMAGE: PROFILE VIEW OF THE SAME PERSON. USE THIS FOR PROFILE ANALYSIS." },
            {
              inline_data: {
                mime_type: profileMimeType,
                data: profileBase64
              }
            }
          ] : []),
          { text: prompt }
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

  // Browser detector coordinates are the canonical geometry source. Merge
  // them into the model payload before normalization so frontend overlays and
  // server-side metric inputs cannot drift apart.
  if (Object.keys(clientLandmarks).length) {
    geminiData.landmarks = { ...(geminiData.landmarks || {}), ...clientLandmarks };
    if (geminiData.frontal && typeof geminiData.frontal === "object") {
      geminiData.frontal.landmarks = { ...(geminiData.frontal.landmarks || {}), ...clientLandmarks };
    }
  }
  if (profileProvided && Object.keys(clientProfileLandmarks).length) {
    geminiData.profile = {
      ...(geminiData.profile && typeof geminiData.profile === "object" ? geminiData.profile : {}),
      available: true,
      landmarks: { ...((geminiData.profile && geminiData.profile.landmarks) || {}), ...clientProfileLandmarks },
      confirmed_landmarks: clientProfileLandmarks
    };
  }

  // ========================================================
  // GEMINI HTTP ERROR
  // ========================================================

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

  const faceCount =
    normalizeInteger(
      data.face_count,
      0,
      20
    );

  const score =
    normalizeNullableScore(
      data.score
    );

  const view =
    normalizeView(
      data.view
    );

  const frontal =
    normalizeViewResult(
      data.frontal,
      false
    );

  const profile =
    normalizeViewResult(
      data.profile,
      true
    );

  
    if (profileProvided && profileBase64) {
      profile.available = true;
      profile.landmarks = {
        ...(profile.landmarks || {}),
        ...clientProfileLandmarks
      };
      profile.confirmed_landmarks = clientProfileLandmarks;
    }
const landmarks =
    normalizeLandmarks(
      data.landmarks
    );

  const sections =
    normalizeSections(
      data.sections
    );

  const metrics =
    normalizeMetrics(
      data.metrics
    );

  const production =
    normalizeProductionFeatures(
      data.production_features,
      sections
    );

  const normalizedScore =
    score !== null
      ? score
      : faceCount > 0
        ? calculateFallbackOverallScore(
            sections,
            production
          )
        : null;

  const percent =
    normalizedScore === null
      ? null
      : Math.round(
          normalizedScore * 10
        );

  const tier =
    getTier(
      normalizedScore,
      analysisGender
    );

  return {
    success: true,

    gender: analysisGender,

    score:
      normalizedScore,

    percent,

    face_count:
      faceCount,

    landmarks_count:
      Object.keys(
        landmarks
      ).length || null,

    detected_features:
      countLeaves(metrics),

    feature_count:
      countLeaves(production),

    model,

    view,

    frontal,

    profile,

    landmarks,

    tier,

    sections,

    metrics,

    production_features:
      production,

    generated_at:
      new Date().toISOString()
  };
}


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
  if (score === null || !Number.isFinite(Number(score))) return { name: null, level: null };
  const value = Math.round(Number(score) * 10) / 10;
  const female = gender === "female";
  const labels = female ? ["LTB","MTB","HTB","Stacy Lite","Stacy"] : ["LTN","MTN","HTN","Chad Lite","Chad"];
  if (value <= 2) return { name: "Sub 3", level: "base" };
  if (value <= 3) return { name: "Sub 5", level: "base" };
  const bands = [[4,4.4,`Low ${labels[0]}`],[4.5,4.7,labels[0]],[4.8,4.9,`High ${labels[0]}`],[5,5.4,`Low ${labels[1]}`],[5.5,5.7,labels[1]],[5.8,5.9,`High ${labels[1]}`],[6,6.4,`Low ${labels[2]}`],[6.5,6.7,labels[2]],[6.8,6.9,`High ${labels[2]}`],[7,7.4,`Low ${labels[3]}`],[7.5,7.7,labels[3]],[7.8,7.9,`High ${labels[3]}`],[8,8.4,`Low ${labels[4]}`],[8.5,8.7,labels[4]],[8.8,8.9,`High ${labels[4]}`]];
  for (const [min,max,name] of bands) if (value >= min && value <= max) return { name, level: name.startsWith("Low") ? "low" : name.startsWith("High") ? "high" : "base" };
  if (value === 9) return { name: female ? "Eve Lite" : "Adam Lite", level: "base" };
  if (value === 10) return { name: female ? "True Eve" : "True Adam", level: "base" };
  return { name: null, level: null };
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
