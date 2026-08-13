from pathlib import Path
import sys
import tempfile
import traceback

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


# ============================================================
# PATHS
# ============================================================

# Current file:
# facebot/web/api/server.py
#
# Project:
# facebot/
#
# Frontend:
# facebot/web/
#
# Therefore:
# parents[0] = api/
# parents[1] = web/
# parents[2] = facebot/

PROJECT_DIR = Path(__file__).resolve().parents[2]
WEB_DIR = PROJECT_DIR / "web"

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))


print()
print("=" * 60)
print("FACEBOT PATH CONFIGURATION")
print("=" * 60)
print(f"Project:  {PROJECT_DIR}")
print(f"Web:      {WEB_DIR}")
print(f"Index:    {WEB_DIR / 'index.html'}")
print(f"Exists:   {(WEB_DIR / 'index.html').exists()}")
print("=" * 60)
print()


# ============================================================
# PRODUCTION INFERENCE
# ============================================================

from inference import (
    load_model,
    load_metadata,
    create_analyzer,
    extract_features,
    predict_score,
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="FaceBot API",
    version="1.0.0",
    description="FaceBot PSL AI Analyzer",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# GLOBALS
# ============================================================

model = None
metadata = None
feature_names = None
analyzer = None


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    global model
    global metadata
    global feature_names
    global analyzer

    print()
    print("=" * 60)
    print("FACEBOT API")
    print("LOADING PRODUCTION MODEL")
    print("=" * 60)

    model = load_model()
    print("✓ Production model loaded")

    metadata = load_metadata()
    print("✓ Production metadata loaded")

    feature_names = metadata["feature_names"]

    if len(feature_names) != 44:
        raise RuntimeError(
            f"Production model must use 44 features, "
            f"got {len(feature_names)}"
        )

    analyzer = create_analyzer()
    print("✓ FaceAnalyzer initialized")

    print()
    print("Model: ExtraTrees")
    print(f"Features: {len(feature_names)}")
    print("Calibration: disabled")
    print()
    print("FACEBOT BACKEND READY")
    print("=" * 60)
    print()


# ============================================================
# JSON SAFE
# ============================================================

def make_json_safe(value):

    if value is None:
        return None

    if isinstance(value, dict):
        return {
            str(key): make_json_safe(val)
            for key, val in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            make_json_safe(item)
            for item in value
        ]

    try:
        return value.item()
    except Exception:
        pass

    try:
        return float(value)
    except Exception:
        return str(value)


# ============================================================
# FRONTEND
# ============================================================

@app.get("/")
def frontend():

    index_file = WEB_DIR / "index.html"

    print(f"GET / -> {index_file}")

    if not index_file.exists():
        print("ERROR: index.html was not found")
        print(f"Expected path: {index_file}")
        print(f"Web directory exists: {WEB_DIR.exists()}")

        if WEB_DIR.exists():
            print("Web directory contents:")
            for item in WEB_DIR.iterdir():
                print(f"  - {item.name}")

        raise HTTPException(
            status_code=404,
            detail="index.html was not found",
        )

    return FileResponse(
        index_file,
        media_type="text/html",
    )


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "model_loaded": model is not None,
        "metadata_loaded": metadata is not None,
        "analyzer_loaded": analyzer is not None,
        "model": "ExtraTrees",
        "features": 44,
    }


# ============================================================
# ANALYZE
# ============================================================

@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...)
):

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Production model is not loaded.",
        )

    if metadata is None:
        raise HTTPException(
            status_code=503,
            detail="Production metadata is not loaded.",
        )

    if analyzer is None:
        raise HTTPException(
            status_code=503,
            detail="FaceAnalyzer is not initialized.",
        )

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload JPG, PNG or WEBP.",
        )

    suffix = ".jpg"

    if file.content_type == "image/png":
        suffix = ".png"

    elif file.content_type == "image/webp":
        suffix = ".webp"

    temp_path = None

    try:

        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Empty image.",
            )

        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="Image is too large. Maximum size is 15 MB.",
            )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temp_file:

            temp_file.write(content)

            temp_path = Path(
                temp_file.name
            )

        print()
        print("=" * 60)
        print("FACEBOT MINI APP ANALYSIS")
        print("=" * 60)
        print(f"Image: {temp_path}")

        # ====================================================
        # FACE ANALYSIS
        # ====================================================

        result = analyzer.analyze(
            temp_path
        )

        if result is None:
            raise ValueError(
                "FaceAnalyzer returned None."
            )

        if not isinstance(result, dict):
            raise ValueError(
                "Unexpected FaceAnalyzer result."
            )

        face_count = int(
            result.get(
                "face_count",
                0,
            )
        )

        landmarks_count = int(
            result.get(
                "landmarks_count",
                0,
            )
        )

        print(
            f"Faces detected: {face_count}"
        )

        print(
            f"Landmarks: {landmarks_count}"
        )

        if face_count <= 0:
            raise ValueError(
                "No face detected in the image."
            )

        # ====================================================
        # FEATURES
        # ====================================================

        X, feature_values = extract_features(
            result,
            feature_names,
        )

        feature_count = int(
            X.shape[1]
        )

        print(
            f"Features prepared: {feature_count}"
        )

        if feature_count != 44:
            raise ValueError(
                "Expected 44 production features, "
                f"got {feature_count}."
            )

        # ====================================================
        # MODEL
        # ====================================================

        score = predict_score(
            model,
            X,
        )

        score = float(score)

        print(
            f"PSL SCORE: {score:.2f} / 10"
        )

        # ====================================================
        # METRICS
        # ====================================================

        metrics = make_json_safe(
            result.get(
                "metrics",
                {},
            )
        )

        production_features = make_json_safe(
            feature_values
        )

        # ====================================================
        # RESPONSE
        # ====================================================

        response = {
            "success": True,

            "score": round(
                score,
                2,
            ),

            "face_count": face_count,

            "landmarks_count": landmarks_count,

            "feature_count": feature_count,

            "model": "ExtraTrees",

            "metrics": metrics,

            "production_features":
                production_features,
        }

        print()
        print("=" * 60)
        print("ANALYSIS COMPLETE")
        print("=" * 60)
        print()

        return response

    except HTTPException:
        raise

    except Exception as exc:

        print()
        print("=" * 60)
        print("ANALYSIS ERROR")
        print("=" * 60)

        traceback.print_exc()

        print("=" * 60)

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    finally:

        if temp_path is not None:

            try:
                temp_path.unlink(
                    missing_ok=True
                )
            except Exception:
                pass


# ============================================================
# STATIC FRONTEND
# ============================================================

if WEB_DIR.exists():

    app.mount(
        "/",
        StaticFiles(
            directory=WEB_DIR,
            html=True,
        ),
        name="web",
    )