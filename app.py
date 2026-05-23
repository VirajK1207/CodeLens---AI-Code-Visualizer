# app.py - FastAPI Backend
# Main server handling all routes and API endpoints

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os

from explainer import explain_code, detect_language
from diagram_generator import generate_diagram

# Initialize FastAPI
app = FastAPI(
    title="CodeLens API",
    description="AI-powered code visualization platform",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)

# Templates
templates = Jinja2Templates(directory="templates")


# Request models
class ExplainRequest(BaseModel):
    code:     str
    language: str = "python"
    level:    str = "beginner"


class DiagramRequest(BaseModel):
    code:         str
    language:     str = "python"
    diagram_type: str = None


class DetectRequest(BaseModel):
    code: str


# ── Route 1: Homepage ─────────────────────────────────────────
@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )

# ── Route 2: Health Check ─────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status":  "healthy",
        "service": "CodeLens",
        "version": "1.0.0",
        "model":   "gemini-2.5-flash"
    }


# ── Route 3: Explain Code ─────────────────────────────────────
@app.post("/explain")
async def explain(request: ExplainRequest):
    """
    Main endpoint for code explanation.
    Receives code and returns full analysis.
    """
    try:
        if not request.code.strip():
            raise HTTPException(
                status_code=400,
                detail="No code provided!"
            )

        if len(request.code) > 10000:
            raise HTTPException(
                status_code=400,
                detail="Code too long! Max 10000 characters."
            )

        # Get explanation from Gemini
        result = explain_code(
            request.code,
            request.language,
            request.level
        )

        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Explanation failed")
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        )


# ── Route 4: Generate Diagram ─────────────────────────────────
@app.post("/diagram")
async def diagram(request: DiagramRequest):
    """
    Generates Mermaid diagram for selected code.
    """
    try:
        if not request.code.strip():
            raise HTTPException(
                status_code=400,
                detail="No code provided!"
            )

        # Generate diagram
        result = generate_diagram(
            request.code,
            request.language,
            request.diagram_type
        )

        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=result.get(
                    "error", "Diagram generation failed"
                )
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        )


# ── Route 5: Detect Language ──────────────────────────────────
@app.post("/detect-language")
async def detect(request: DetectRequest):
    """
    Auto detects programming language from code.
    """
    try:
        language = detect_language(request.code)
        return {"language": language}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ── Route 6: Model Info ───────────────────────────────────────
@app.get("/model-info")
async def model_info():
    return {
        "model":        "gemini-2.5-flash",
        "provider":     "Google Gemini",
        "capabilities": [
            "Code explanation",
            "Diagram generation",
            "Issue detection",
            "Complexity analysis",
            "Language detection"
        ],
        "supported_languages": [
            "Python", "JavaScript", "Java",
            "C++", "SQL", "HTML", "Rust"
        ]
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": str(exc)
        }
    )

# Run app
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )