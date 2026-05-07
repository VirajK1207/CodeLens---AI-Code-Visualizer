# diagram_generator.py - Diagram Generation Logic
# Detects code type and generates Mermaid diagrams

from google import genai
from dotenv import load_dotenv
import os
import re
import time

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash-lite"


def detect_diagram_type(code):
    if "class " in code:
        return "classDiagram"
    if "fetch" in code.lower() or "request" in code.lower():
        return "sequenceDiagram"
    return "flowchart"


def clean_mermaid(text):
    text = text.strip()
    text = text.replace("```mermaid", "")
    text = text.replace("```", "")
    text = text.strip()

    lines = text.split("\n")
    valid_starts = [
        "flowchart", "classDiagram",
        "sequenceDiagram", "graph"
    ]
    start_idx = 0
    for i, line in enumerate(lines):
        if any(line.strip().startswith(s) for s in valid_starts):
            start_idx = i
            break

    text = "\n".join(lines[start_idx:]).strip()

    def clean_label(match):
        content = match.group(1)
        content = re.sub(r'[(){}|<>]', '', content)
        content = content.strip()
        return '[' + content + ']'

    text = re.sub(r'\[([^\]]+)\]', clean_label, text)
    return text


def generate_simple_flowchart(code):
    lines = [l.strip() for l in code.split("\n") if l.strip()]
    diagram = "flowchart TD\n    A[Start]\n"
    prev = "A"
    for i, line in enumerate(lines[:5]):
        node_id = chr(66 + i)
        label = line[:25].replace('"', "'")
        label = re.sub(r'[(){}|<>]', '', label).strip()
        if "if " in line or "while " in line:
            diagram += f"    {prev} --> {node_id}{{{label}}}\n"
        else:
            diagram += f"    {prev} --> {node_id}[{label}]\n"
        prev = node_id
    diagram += f"    {prev} --> END[End]\n"
    return diagram


def generate_diagram(code, language="python", diagram_type=None):
    if not diagram_type:
        diagram_type = detect_diagram_type(code)

    diagram_instructions = {
        "flowchart": (
            "Generate a Mermaid FLOWCHART using flowchart TD syntax. "
            "Show execution flow with loops and conditions."
        ),
        "classDiagram": (
            "Generate a Mermaid CLASS DIAGRAM showing "
            "class structure, attributes and methods."
        ),
        "sequenceDiagram": (
            "Generate a Mermaid SEQUENCE DIAGRAM "
            "showing component interactions."
        )
    }

    instruction = diagram_instructions.get(
        diagram_type,
        diagram_instructions["flowchart"]
    )

    prompt = (
        "Generate a Mermaid diagram for this "
        + language + " code.\n\n"
        "Code:\n[START CODE]\n"
        + code +
        "\n[END CODE]\n\n"
        + instruction + "\n\n"
        "STRICT RULES:\n"
        "1. Output ONLY the Mermaid syntax\n"
        "2. Start with EXACTLY flowchart TD\n"
        "3. NO backticks\n"
        "4. NO markdown\n"
        "5. NO explanations\n"
        "6. NO extra text\n"
        "7. Max 12 nodes\n"
        "8. ASCII characters only in labels\n"
        "9. No special chars in labels\n"
        "10. Max 3 words per label\n\n"
        "EXAMPLE:\n"
        "flowchart TD\n"
        "    A[Start] --> B{Check condition}\n"
        "    B -->|Yes| C[Do action]\n"
        "    B -->|No| D[End]\n"
        "    C --> D\n"
    )

    response = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt
            )
            break
        except Exception as e:
            if attempt < 2:
                print(f"Diagram attempt {attempt+1} failed: {e}")
                time.sleep(2)
            else:
                return {
                    "success": False,
                    "error": f"Diagram generation failed: {str(e)}"
                }

    try:
        mermaid_text = clean_mermaid(response.text)

        valid_starts = [
            "flowchart", "classDiagram",
            "sequenceDiagram", "graph"
        ]
        is_valid = any(
            mermaid_text.startswith(s)
            for s in valid_starts
        )

        if not is_valid or len(mermaid_text) < 20:
            mermaid_text = generate_simple_flowchart(code)

        return {
            "success":      True,
            "mermaid":      mermaid_text,
            "diagram_type": diagram_type
        }

    except Exception as e:
        return {
            "success": False,
            "error":   f"Processing failed: {str(e)}"
        }


def get_complexity_diagram(time_complexity, space_complexity):
    mermaid = (
        "flowchart LR\n"
        "    A[Your Code]\n"
        "    A --> B[Time: " + time_complexity + "]\n"
        "    A --> C[Space: " + space_complexity + "]\n"
    )
    return mermaid