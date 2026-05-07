// script.js - CodeLens Frontend Logic
// Monaco Editor + Mermaid + API communication

// ── 1. Load Monaco Editor ─────────────────────────────────────
require.config({
    paths: {
        vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs"
    }
});

require(["vs/editor/editor.main"], function () {

    // Initialize Monaco Editor
    const editor = monaco.editor.create(
        document.getElementById("editor-container"),
        {
            value: [
                "# Paste your code here!",
                "# Select any part to generate a diagram",
                "",
                "def bubble_sort(arr):",
                "    n = len(arr)",
                "    for i in range(n):",
                "        for j in range(0, n-i-1):",
                "            if arr[j] > arr[j+1]:",
                "                arr[j], arr[j+1] = arr[j+1], arr[j]",
                "    return arr",
                "",
                "result = bubble_sort([64, 34, 25, 12, 22, 11, 90])",
                "print(result)"
            ].join("\n"),
            language:        "python",
            theme:           "vs-dark",
            fontSize:        14,
            fontFamily:      "JetBrains Mono, Consolas, monospace",
            minimap:         { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers:     "on",
            renderLineHighlight: "line",
            padding:         { top: 16, bottom: 16 }
        }
    );

    // ── 2. State Variables ────────────────────────────────────
    let currentLanguage = "python";
    let currentLevel    = "beginner";
    let isLoading       = false;
    let mermaidLoaded   = false;


    // ── 3. Initialize Mermaid ─────────────────────────────────
    mermaid.initialize({
    startOnLoad:   false,
    theme:         "dark",
    flowchart:     { curve: "basis" },
    securityLevel: "loose",
    er:            { diagramPadding: 20 },
    sequence:      { diagramMarginX: 50 },
    suppressErrorRendering: true
});
mermaidLoaded = true;

// Suppress Mermaid error popups completely
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
                // Remove mermaid error divs
                if (
                    node.classList &&
                    (node.classList.contains("mermaid") ||
                     node.id && node.id.includes("mermaid"))
                ) {
                    const errorEl = node.querySelector(
                        ".error-icon, .error-text, " +
                        "[class*='error']"
                    );
                    if (errorEl) node.remove();
                }
                // Remove error popups at bottom of page
                if (
                    node.style &&
                    node.style.position === "fixed"
                ) {
                    node.remove();
                }
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree:   true
});

    // ── 4. Language Selector ──────────────────────────────────
    document.getElementById("language-select")
        .addEventListener("change", (e) => {
        currentLanguage = e.target.value;

        // Update Monaco editor language
        monaco.editor.setModelLanguage(
            editor.getModel(),
            currentLanguage === "cpp" ? "cpp" :
            currentLanguage === "sql" ? "sql" :
            currentLanguage
        );

        showToast("Language set to " + e.target.value, "success");
    });


    // ── 5. Level Selector ─────────────────────────────────────
    document.getElementById("level-select")
        .addEventListener("change", (e) => {
        currentLevel = e.target.value;
        showToast("Level set to " + e.target.value, "success");
    });


    // ── 6. Auto Detect Language ───────────────────────────────
    document.getElementById("detect-btn")
        .addEventListener("click", async () => {
        const code = editor.getValue().trim();
        if (!code) {
            showToast("Please paste some code first!", "warning");
            return;
        }

        try {
            const response = await fetch("/detect-language", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ code })
            });
            const data = await response.json();
            currentLanguage = data.language;

            // Update selector
            const sel = document.getElementById("language-select");
            sel.value = currentLanguage;

            // Update Monaco
            monaco.editor.setModelLanguage(
                editor.getModel(), currentLanguage
            );

            showToast(
                "Detected: " + currentLanguage.toUpperCase(),
                "success"
            );
        } catch (e) {
            showToast("Detection failed!", "error");
        }
    });


    // ── 7. Clear Editor ───────────────────────────────────────
    document.getElementById("clear-btn")
        .addEventListener("click", () => {
        editor.setValue("");
        clearResults();
        showToast("Editor cleared!", "success");
    });


    // ── 8. Explain Code Button ────────────────────────────────
    document.getElementById("explain-btn")
        .addEventListener("click", async () => {
        const code = editor.getValue().trim();

        if (!code) {
            showToast("Please paste some code first!", "warning");
            return;
        }

        if (isLoading) return;

        await explainCode(code);
    });


    // ── 9. Main Explain Function ──────────────────────────────
    async function explainCode(code) {
        isLoading = true;
        showLoading();

        // Switch to explanation tab
        switchTab("explanation");

        try {
            const response = await fetch("/explain", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    code:     code,
                    language: currentLanguage,
                    level:    currentLevel
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                displayResults(data);
                showToast("Code explained successfully!", "success");

                // Auto generate diagram
                await generateDiagram(code);
            } else {
                hideLoading();
                showToast(
                    data.detail || "Explanation failed!",
                    "error"
                );
            }

        } catch (error) {
            hideLoading();
            showToast("Could not connect to server!", "error");
        }

        isLoading = false;
    }


    // ── 10. Display Results ───────────────────────────────────
    function displayResults(data) {
        hideLoading();

        // ── Summary ───────────────────────────────────────────
        const summaryEl = document.getElementById("summary-content");
        summaryEl.innerHTML = "";

        // Difficulty badge
        const diff = data.difficulty || "medium";
        const diffBadge = document.createElement("div");
        diffBadge.style.marginBottom = "12px";
        diffBadge.innerHTML =
            '<span class="difficulty-badge difficulty-' + diff + '">' +
            getDiffIcon(diff) + " " + diff.toUpperCase() +
            "</span>";
        summaryEl.appendChild(diffBadge);

        // Summary text
        const summaryCard = document.createElement("div");
        summaryCard.className = "summary-card";
        summaryCard.textContent = data.summary || "No summary available";
        summaryEl.appendChild(summaryCard);

        // Complexity
        if (data.complexity) {
            const compRow = document.createElement("div");
            compRow.className = "complexity-row";
            compRow.innerHTML =
                '<div class="complexity-badge">' +
                '<span class="badge-label">Time</span>' +
                '<span class="badge-value">' +
                (data.complexity.time || "N/A") +
                "</span></div>" +
                '<div class="complexity-badge">' +
                '<span class="badge-label">Space</span>' +
                '<span class="badge-value">' +
                (data.complexity.space || "N/A") +
                "</span></div>";
            summaryEl.appendChild(compRow);

            // Complexity explanation
            if (data.complexity.explanation) {
                const compExp = document.createElement("p");
                compExp.style.cssText =
                    "font-size:13px;color:var(--text-secondary);" +
                    "line-height:1.6;margin-bottom:16px;";
                compExp.textContent = data.complexity.explanation;
                summaryEl.appendChild(compExp);
            }
        }

        // ── Detailed Explanation ──────────────────────────────
        const detailEl = document.getElementById("detail-content");
        detailEl.innerHTML = "";

        if (data.detailed && data.detailed.length > 0) {
            data.detailed.forEach((item, i) => {
                const detailItem = document.createElement("div");
                detailItem.className = "detail-item";
                detailItem.innerHTML =
                    '<div class="detail-line">Lines ' +
                    (item.line_range || i + 1) + "</div>" +
                    '<div class="detail-code">' +
                    escapeHtml(item.code_snippet || "") +
                    "</div>" +
                    '<div class="detail-explanation">' +
                    (item.explanation || "") +
                    "</div>";
                detailEl.appendChild(detailItem);
            });
        } else {
            detailEl.innerHTML =
                '<p style="color:var(--text-muted);font-size:13px;">' +
                "No detailed breakdown available.</p>";
        }

        // ── Issues ────────────────────────────────────────────
        const issuesEl = document.getElementById("issues-content");
        issuesEl.innerHTML = "";

        if (data.issues && data.issues.length > 0) {
            data.issues.forEach(issue => {
                const issueItem = document.createElement("div");
                issueItem.className =
                    "issue-item " + (issue.type || "suggestion");
                issueItem.innerHTML =
                    '<span class="issue-icon">' +
                    getIssueIcon(issue.type) +
                    "</span>" +
                    '<div class="issue-content">' +
                    '<div class="issue-type">' +
                    (issue.type || "info").replace("_", " ") +
                    "</div>" +
                    '<div class="issue-line">Line ' +
                    (issue.line || "N/A") +
                    "</div>" +
                    '<div class="issue-message">' +
                    (issue.message || "") +
                    "</div></div>";
                issuesEl.appendChild(issueItem);
            });

            // Update issues tab count
            document.getElementById("issues-tab").textContent =
                "Issues (" + data.issues.length + ")";
        } else {
            issuesEl.innerHTML =
                '<div class="placeholder">' +
                '<span class="placeholder-icon">✅</span>' +
                "<h3>No Issues Found!</h3>" +
                "<p>Your code looks clean!</p></div>";
            document.getElementById("issues-tab").textContent =
                "Issues (0)";
        }
    }


    // ── 11. Generate Diagram ──────────────────────────────────
    async function generateDiagram(code) {
        const diagramContent =
            document.getElementById("diagram-content");
        diagramContent.innerHTML =
            '<div class="loading-overlay active">' +
            '<div class="spinner"></div>' +
            '<div class="loading-text">Generating diagram...</div>' +
            "</div>";

        try {
            const response = await fetch("/diagram", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    code:     code,
                    language: currentLanguage
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await renderMermaid(data.mermaid, diagramContent);
            } else {
                diagramContent.innerHTML =
                    '<div class="diagram-hint">' +
                    "Could not generate diagram. Try again!</div>";
            }

        } catch (error) {
            diagramContent.innerHTML =
                '<div class="diagram-hint">' +
                "Diagram generation failed!</div>";
        }
    }


    // ── 12. Render Mermaid Diagram ────────────────────────────
   async function renderMermaid(mermaidCode, container) {
    try {
        // Clean the mermaid code before rendering
        let cleanCode = mermaidCode.trim();

        // Remove any backticks
        cleanCode = cleanCode.replace(/```mermaid/g, "");
        cleanCode = cleanCode.replace(/```/g, "");
        cleanCode = cleanCode.trim();

        // Remove any hidden elements from previous renders
        document.querySelectorAll(
            "[id^='mermaid-']"
        ).forEach(el => el.remove());

        // Generate unique ID
        const id = "mermaid-" + Date.now();

        // Render diagram
        const { svg } = await mermaid.render(id, cleanCode);

        // Clear container first
        container.innerHTML = "";

        // Add diagram
        const diagramDiv = document.createElement("div");
        diagramDiv.className = "diagram-container";
        diagramDiv.innerHTML = svg;
        container.appendChild(diagramDiv);

        // Add action buttons
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "diagram-actions";
        actionsDiv.innerHTML =
            '<button class="btn btn-secondary" ' +
            'onclick="downloadDiagram()">' +
            "Download SVG</button>" +
            '<button class="btn btn-secondary" ' +
            'onclick="copyMermaidCode()">' +
            "Copy Mermaid Code</button>";
        container.appendChild(actionsDiv);

        // Store mermaid code for copy
        window.lastMermaidCode = cleanCode;

    } catch (error) {
        console.error("Mermaid error:", error);

        // Generate fallback simple diagram
        const fallback =
            "flowchart TD\n" +
            "    A[Code Input] --> B[Processing]\n" +
            "    B --> C[Output]";

        try {
            const id2 = "mermaid-fallback-" + Date.now();
            document.querySelectorAll(
                "[id^='mermaid-fallback']"
            ).forEach(el => el.remove());

            const { svg } = await mermaid.render(id2, fallback);
            container.innerHTML =
                '<div class="diagram-container">' +
                svg + "</div>" +
                '<p style="color:var(--text-muted);' +
                'font-size:12px;margin-top:8px;text-align:center;">' +
                "Simplified diagram shown. " +
                "Select specific code for better results!</p>";
        } catch (e) {
            container.innerHTML =
                '<div class="diagram-hint">' +
                "Could not render diagram. " +
                "Try selecting a smaller code block!</div>";
        }
    }
}


    // ── 13. Selection → Diagram ───────────────────────────────
    editor.onDidChangeCursorSelection(async (e) => {
        const selection = editor.getSelection();
        if (selection.isEmpty()) return;

        const selectedText = editor.getModel()
            .getValueInRange(selection);

        if (selectedText.trim().length < 10) return;

        // Debounce — wait 1 second after selection
        clearTimeout(window.selectionTimer);
        window.selectionTimer = setTimeout(async () => {
            switchTab("diagram");

            const diagramContent =
                document.getElementById("diagram-content");
            diagramContent.innerHTML =
                '<div class="loading-overlay active">' +
                '<div class="spinner"></div>' +
                '<div class="loading-text">' +
                "Generating diagram for selection...</div>" +
                "</div>";

            try {
                const response = await fetch("/diagram", {
                    method:  "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        code:     selectedText,
                        language: currentLanguage
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    await renderMermaid(
                        data.mermaid,
                        diagramContent
                    );
                    showToast(
                        "Diagram generated for selection!",
                        "success"
                    );
                }
            } catch (error) {
                diagramContent.innerHTML =
                    '<div class="diagram-hint">' +
                    "Could not generate diagram!</div>";
            }
        }, 1000);
    });


    // ── 14. Tab Switching ─────────────────────────────────────
    window.switchTab = function(tabName) {
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.classList.remove("active");
        });
        document.querySelectorAll(".tab-pane").forEach(pane => {
            pane.classList.remove("active");
        });

        const tabBtn = document.querySelector(
            '[data-tab="' + tabName + '"]'
        );
        const tabPane = document.getElementById(
            tabName + "-pane"
        );

        if (tabBtn)  tabBtn.classList.add("active");
        if (tabPane) tabPane.classList.add("active");
    };

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchTab(btn.dataset.tab);
        });
    });


    // ── 15. Loading State ─────────────────────────────────────
    function showLoading() {
    const summaryEl =
        document.getElementById("summary-content");

    // Rotating loading messages
    const messages = [
        "AI is reading your code...",
        "Detecting patterns...",
        "Analyzing complexity...",
        "Finding issues...",
        "Almost done..."
    ];

    let msgIndex = 0;
    summaryEl.innerHTML =
        '<div class="loading-overlay active">' +
        '<div class="spinner"></div>' +
        '<div class="loading-text" id="loading-msg">' +
        messages[0] + "<br/>" +
        "<small>Powered by Gemini 2.5</small>" +
        "</div></div>";

    // Rotate messages every 2 seconds
    window.loadingInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        const msgEl = document.getElementById("loading-msg");
        if (msgEl) {
            msgEl.innerHTML =
                messages[msgIndex] + "<br/>" +
                "<small>Powered by Gemini 2.5</small>";
        }
    }, 2000);

    document.getElementById("explain-btn").disabled = true;
    document.getElementById("explain-btn").textContent =
        "Analyzing...";
}

function hideLoading() {
    // Clear rotating messages
    clearInterval(window.loadingInterval);
    document.getElementById("explain-btn").disabled = false;
    document.getElementById("explain-btn").textContent =
        "Explain Code";
}


    // ── 16. Clear Results ─────────────────────────────────────
    function clearResults() {
        ["summary-content", "detail-content",
         "issues-content", "diagram-content"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });
        document.getElementById("issues-tab").textContent =
            "Issues";
    }


    // ── 17. Download Diagram ──────────────────────────────────
    window.downloadDiagram = function() {
        const svg = document.querySelector(
            ".diagram-container svg"
        );
        if (!svg) {
            showToast("No diagram to download!", "warning");
            return;
        }
        const blob = new Blob(
            [svg.outerHTML],
            { type: "image/svg+xml" }
        );
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "codelens-diagram.svg";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Diagram downloaded!", "success");
    };


    // ── 18. Copy Mermaid Code ─────────────────────────────────
    window.copyMermaidCode = function() {
    const code = window.lastMermaidCode || "";
    if (!code) {
        showToast("No diagram to copy!", "warning");
        return;
    }
    navigator.clipboard.writeText(code).then(() => {
        showToast("Mermaid code copied!", "success");
    });
};

    // ── 19. Theme Toggle ──────────────────────────────────────
    document.getElementById("theme-toggle")
        .addEventListener("click", () => {
        document.body.classList.toggle("light");
        const isLight = document.body.classList.contains("light");

        // Update Monaco theme
        monaco.editor.setTheme(isLight ? "vs" : "vs-dark");

        // Update Mermaid theme
        mermaid.initialize({
            startOnLoad: false,
            theme: isLight ? "default" : "dark"
        });

        document.getElementById("theme-toggle").textContent =
            isLight ? "Dark Mode" : "Light Mode";

        showToast(
            isLight ? "Light mode on!" : "Dark mode on!",
            "success"
        );
    });


    // ── 20. Toast Notifications ───────────────────────────────
    function showToast(message, type = "success") {
        const existing = document.querySelector(".toast");
        if (existing) existing.remove();

        const icons = {
            success: "✅",
            error:   "❌",
            warning: "⚠️"
        };

        const toast = document.createElement("div");
        toast.className = "toast " + type;
        toast.innerHTML =
            "<span>" + icons[type] + "</span> " + message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add("show"), 10);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }


    // ── 21. Helper Functions ──────────────────────────────────
    function getIssueIcon(type) {
        const icons = {
            bug:          "🔴",
            warning:      "⚠️",
            suggestion:   "💡",
            good_practice:"✅"
        };
        return icons[type] || "ℹ️";
    }

    function getDiffIcon(diff) {
        const icons = {
            easy:   "🟢",
            medium: "🟡",
            hard:   "🔴"
        };
        return icons[diff] || "🟡";
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

});