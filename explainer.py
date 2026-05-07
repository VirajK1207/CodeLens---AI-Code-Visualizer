# explainer.py - Code Explanation Logic
# Uses Gemini AI to explain code in multiple ways

from google import genai
from dotenv import load_dotenv
import os
import json
import time

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

def explain_code(code, language="python", level="beginner"):

    level_instructions = {
        "beginner": (
            "Explain in very simple plain English. "
            "Avoid technical jargon. "
            "Use analogies and simple examples. "
            "Imagine explaining to someone who just "
            "started learning to code."
        ),
        "intermediate": (
            "Use technical terms but explain them briefly. "
            "Focus on logic flow and patterns. "
            "Mention best practices where relevant."
        ),
        "expert": (
            "Use advanced technical terminology. "
            "Focus on performance, design patterns, "
            "edge cases and optimizations. "
            "Be concise and precise."
        )
    }

    instruction = level_instructions.get(
        level, level_instructions["beginner"]
    )

    prompt = (
        "You are an expert code teacher and analyzer.\n"
        "Analyze the following " + language + " code and respond "
        "with a JSON object only. No markdown, no backticks, "
        "just pure JSON.\n\n"
        "Code to analyze:\n"
        "[START CODE]\n"
        + code +
        "\n[END CODE]\n\n"
        "Explanation level: " + level + "\n"
        + instruction + "\n\n"
        "Respond with exactly this JSON structure:\n"
        "{\n"
        '    "summary": "2-3 sentence overview of what this code does",\n'
        '    "detailed": [\n'
        '        {\n'
        '            "line_range": "1-3",\n'
        '            "code_snippet": "the actual code",\n'
        '            "explanation": "what this part does"\n'
        '        }\n'
        '    ],\n'
        '    "issues": [\n'
        '        {\n'
        '            "type": "bug|warning|suggestion|good_practice",\n'
        '            "line": "line number or range",\n'
        '            "message": "description of the issue"\n'
        '        }\n'
        '    ],\n'
        '    "complexity": {\n'
        '        "time": "O(n) or O(n^2) etc",\n'
        '        "space": "O(1) or O(n) etc",\n'
        '        "explanation": "brief explanation of complexity"\n'
        '    },\n'
        '    "language_detected": "' + language + '",\n'
        '    "difficulty": "easy|medium|hard"\n'
        "}\n\n"
        "Rules:\n"
        "- Return ONLY valid JSON\n"
        "- No markdown formatting\n"
        "- No code blocks\n"
        "- detailed array should have 3-6 items max\n"
        "- issues array should have 1-5 items max\n"
        "- Be specific and accurate\n"
    )

    # Retry up to 3 times
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt
            )
            
            text = response.text.strip()

            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            result = json.loads(text)
            result["success"] = True
            return result
        except json.JSONDecodeError:
            if attempt < 2:
                print(f"Attempt {attempt+1} failed: JSON decode error")
                time.sleep(2)
                continue
            return {
                "success": False,
                "error": "Failed to parse AI response",
                "raw": response.text if response else ""
            }
        except Exception as e:
            if attempt < 2:
                print(f"Attempt {attempt+1} failed: {e}")
                time.sleep(2)
                continue
            return {
                "success": False,
                "error": f"AI explanation failed after 3 attempts: {str(e)}"
            }


def detect_language(code):
    code_lower = code.lower()

    if "def " in code and "import " in code:
        return "python"
    elif "def " in code or "print(" in code:
        return "python"
    elif "public class" in code or "System.out" in code:
        return "java"
    elif "console.log" in code or "function " in code:
        return "javascript"
    elif "cout" in code or "#include" in code:
        return "cpp"
    elif "SELECT" in code.upper() or "FROM" in code.upper():
        return "sql"
    elif "<html" in code_lower or "div" in code_lower:
        return "html"
    elif "fn " in code and "let " in code:
        return "rust"
    else:
        return "python"


def get_quick_summary(code, language="python"):
    prompt = (
        "Explain this " + language + " code in exactly 2-3 sentences.\n"
        "Be clear and simple. No markdown formatting.\n\n"
        "Code:\n" + code
    )
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )
        return {
            "success": True,
            "summary": response.text.strip()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }