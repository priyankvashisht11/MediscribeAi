"""
Medical image and document analysis using Google Gemini 1.5 Flash (free tier).
Free tier: 1,500 requests/day, 15 RPM — sufficient for a clinic.

Handles:
  - JPEG/PNG/WEBP/HEIC images (X-rays, MRI, CT scans, photos of reports)
  - PDF documents (lab reports, discharge summaries) via text extraction
"""

import base64
import logging
import re
from io import BytesIO

import httpx

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

IMAGE_PROMPT = (
    "You are a clinical imaging assistant for Chartr, an AI medical scribe used by Indian doctors.\n"
    "A doctor has uploaded this medical image for a patient's record.\n\n"
    "Analyze this image and provide a concise clinical observation (3-5 sentences) covering:\n"
    "1. Image modality and anatomical region (e.g. 'PA chest radiograph', 'Axial T2-weighted brain MRI')\n"
    "2. Key normal findings visible\n"
    "3. Any abnormalities, asymmetries, opacities, lesions, or areas of concern\n"
    "4. Relevant measurements, density, or signal characteristics if visible\n\n"
    "Use precise medical terminology. Do NOT provide a diagnosis — only describe objective observations.\n"
    "If the image is not a medical image (e.g. a photo of a document), extract visible text instead.\n"
    "Keep the response under 150 words."
)

PDF_PROMPT = (
    "Summarize the key clinical findings from this medical document in 3-5 sentences.\n"
    "Include: all abnormal values (mention them explicitly), test names, dates if visible, "
    "and any remarks or conclusions from the report.\n"
    "Use medical terminology. Be concise — under 150 words.\n\n"
    "Document text:\n---\n{text}\n---"
)


async def analyze_medical_file(
    file_data: bytes,
    filename: str,
    content_type: str,
    api_key: str,
) -> str | None:
    """
    Analyze a medical file and return a text description.
    Returns None if the API key is missing or analysis fails.
    """
    if not api_key:
        return None

    try:
        ct = (content_type or "").lower()
        fname = filename.lower()

        if ct == "application/pdf" or fname.endswith(".pdf"):
            return await _analyze_pdf(file_data, api_key)

        if ct.startswith("image/") or any(fname.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")):
            # Normalize HEIC content type — Gemini accepts image/heic
            if ct == "application/octet-stream" and fname.endswith((".heic", ".heif")):
                ct = "image/heic"
            return await _analyze_image(file_data, ct or "image/jpeg", api_key)

        return None

    except Exception as e:
        logger.warning(f"Vision analysis failed for '{filename}': {e}")
        return None


async def _analyze_image(file_data: bytes, content_type: str, api_key: str) -> str | None:
    image_b64 = base64.b64encode(file_data).decode()

    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": content_type, "data": image_b64}},
                {"text": IMAGE_PROMPT},
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 400,
        },
        # Disable safety filters — medical images are flagged as sensitive without this
        "safetySettings": [
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT",         "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH",        "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",  "threshold": "BLOCK_NONE"},
        ],
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={api_key}",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract text from response
    candidates = data.get("candidates", [])
    if not candidates:
        finish = data.get("promptFeedback", {}).get("blockReason", "unknown")
        logger.warning(f"Gemini returned no candidates. Block reason: {finish}")
        return None

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        return None

    return parts[0].get("text", "").strip() or None


async def _analyze_pdf(file_data: bytes, api_key: str) -> str | None:
    # Extract text using pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(file_data))
        pages_text = []
        for page in reader.pages[:8]:  # max 8 pages
            t = page.extract_text()
            if t:
                pages_text.append(t.strip())
        text = "\n\n".join(pages_text).strip()
    except Exception as e:
        logger.warning(f"PDF text extraction failed: {e}")
        text = ""

    if len(text) < 30:
        # Scanned PDF with no extractable text — nothing we can do without OCR
        logger.info("PDF has no extractable text — skipping vision analysis")
        return None

    # Truncate to keep within token limits
    if len(text) > 4000:
        text = text[:4000] + "\n[report truncated]"

    # Clean up common PDF extraction artifacts
    text = re.sub(r"\n{3,}", "\n\n", text)

    payload = {
        "contents": [{
            "parts": [{"text": PDF_PROMPT.format(text=text)}]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 400,
        },
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={api_key}",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    if not parts:
        return None

    return parts[0].get("text", "").strip() or None
