(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initializeAnalyzePage();
    });

    function initializeAnalyzePage() {
        initializeFileInput();
        initializeDropZone();
        initializeAnalyzeForm();
        initializeProgress();
    }


    /* =====================================================
       FILE INPUT
    ===================================================== */

    function initializeFileInput() {
        const input = document.getElementById("log-file");
        const fileName = document.getElementById("selected-file-name");

        if (!input) {
            return;
        }

        input.addEventListener("change", function () {
            if (!input.files || !input.files.length) {
                if (fileName) {
                    fileName.textContent = "No file selected";
                }
                return;
            }

            const file = input.files[0];

            if (fileName) {
                fileName.textContent =
                    `${file.name} (${formatFileSize(file.size)})`;
            }

            updateFileState(true);
        });
    }


    /* =====================================================
       DRAG & DROP
    ===================================================== */

    function initializeDropZone() {
        const dropZone =
            document.querySelector(
                "[data-drop-zone], .upload-dropzone, .drop-zone"
            );

        const input =
            document.getElementById("log-file");

        if (!dropZone || !input) {
            return;
        }

        ["dragenter", "dragover"].forEach(function (eventName) {
            dropZone.addEventListener(eventName, function (event) {
                event.preventDefault();
                event.stopPropagation();

                dropZone.classList.add("is-dragging");
            });
        });

        ["dragleave", "drop"].forEach(function (eventName) {
            dropZone.addEventListener(eventName, function (event) {
                event.preventDefault();
                event.stopPropagation();

                dropZone.classList.remove("is-dragging");
            });
        });

        dropZone.addEventListener("drop", function (event) {
            const files = event.dataTransfer.files;

            if (!files || !files.length) {
                return;
            }

            try {
                input.files = files;
            } catch (error) {
                console.warn(
                    "Unable to assign dropped files:",
                    error
                );
            }

            const file = files[0];

            const fileName =
                document.getElementById(
                    "selected-file-name"
                );

            if (fileName) {
                fileName.textContent =
                    `${file.name} (${formatFileSize(file.size)})`;
            }

            updateFileState(true);
        });

        dropZone.addEventListener("click", function (event) {
            if (
                event.target.closest("button") ||
                event.target.closest("input")
            ) {
                return;
            }

            input.click();
        });
    }


    /* =====================================================
       ANALYZE FORM
    ===================================================== */

    function initializeAnalyzeForm() {
        const form =
            document.querySelector(
                "#analyze-form, form[data-analyze-form]"
            );

        if (!form) {
            return;
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const input =
                document.getElementById("log-file");

            if (!input || !input.files.length) {
                showAnalyzeMessage(
                    "Select a log file before starting analysis.",
                    "error"
                );

                return;
            }

            await submitAnalysis(
                form,
                input.files[0]
            );
        });
    }


    async function submitAnalysis(form, file) {
        const submitButton =
            form.querySelector(
                'button[type="submit"], [data-analyze-submit]'
            );

        setLoadingState(
            submitButton,
            true
        );

        showProgress(true);

        updateProgress(
            10,
            "Preparing evidence..."
        );

        try {
            const formData =
                new FormData(form);

            /*
             * If the form does not already contain
             * the selected file, add it explicitly.
             */
            const fileInput =
                document.getElementById("log-file");

            if (
                fileInput &&
                fileInput.files.length &&
                !formData.get(fileInput.name)
            ) {
                formData.append(
                    fileInput.name || "file",
                    file
                );
            }

            updateProgress(
                30,
                "Uploading telemetry..."
            );

            const response =
                await fetch(
                    form.action || window.location.pathname,
                    {
                        method: "POST",
                        body: formData,
                        credentials: "include"
                    }
                );

            updateProgress(
                65,
                "Processing forensic evidence..."
            );

            if (!response.ok) {
                throw new Error(
                    `Analysis request failed with status ${response.status}`
                );
            }

            updateProgress(
                90,
                "Finalizing analysis..."
            );

            /*
             * Most Flask analysis routes respond with a
             * redirect or rendered HTML. Let the browser
             * follow the returned page when possible.
             */
            const contentType =
                response.headers.get("content-type") || "";

            if (
                contentType.includes("text/html")
            ) {
                const html =
                    await response.text();

                document.open();
                document.write(html);
                document.close();

                return;
            }

            let result = null;

            if (
                contentType.includes(
                    "application/json"
                )
            ) {
                result =
                    await response.json();
            }

            updateProgress(
                100,
                "Analysis completed."
            );

            showAnalyzeMessage(
                result?.message ||
                "Forensic analysis completed successfully.",
                "success"
            );

            handleAnalysisResult(result);

        } catch (error) {
            console.error(
                "Forensic analysis failed:",
                error
            );

            updateProgress(
                0,
                "Analysis failed."
            );

            showAnalyzeMessage(
                "Unable to process the selected evidence.",
                "error"
            );

        } finally {
            setLoadingState(
                submitButton,
                false
            );
        }
    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function initializeProgress() {
        const progress =
            document.querySelector(
                "[data-analysis-progress]"
            );

        if (!progress) {
            return;
        }

        progress.style.width =
            progress.dataset.initialProgress ||
            "0%";
    }


    function showProgress(show) {
        const container =
            document.querySelector(
                "[data-analysis-progress-container]"
            );

        if (!container) {
            return;
        }

        container.hidden = !show;
        container.classList.toggle(
            "is-visible",
            show
        );
    }


    function updateProgress(percent, message) {
        const bar =
            document.querySelector(
                "[data-analysis-progress]"
            );

        const label =
            document.querySelector(
                "[data-analysis-progress-label]"
            );

        if (bar) {
            const safePercent =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(percent) || 0
                    )
                );

            bar.style.width =
                `${safePercent}%`;

            bar.setAttribute(
                "aria-valuenow",
                String(safePercent)
            );
        }

        if (label && message) {
            label.textContent =
                message;
        }
    }


    /* =====================================================
       FILE STATE
    ===================================================== */

    function updateFileState(selected) {
        document
            .querySelectorAll(
                "[data-file-state], .upload-dropzone"
            )
            .forEach(function (element) {
                element.classList.toggle(
                    "has-file",
                    Boolean(selected)
                );
            });
    }


    /* =====================================================
       RESULT HANDLING
    ===================================================== */

    function handleAnalysisResult(result) {
        if (!result || typeof result !== "object") {
            return;
        }

        const redirectUrl =
            result.redirect_url ||
            result.redirect ||
            result.next_url;

        if (redirectUrl) {
            window.location.href =
                redirectUrl;
        }
    }


    /* =====================================================
       LOADING STATE
    ===================================================== */

    function setLoadingState(button, loading) {
        if (!button) {
            return;
        }

        if (loading) {
            button.dataset.originalText =
                button.textContent.trim();

            button.disabled = true;
            button.classList.add(
                "is-loading"
            );

            button.textContent =
                "Analyzing...";
        } else {
            button.disabled = false;
            button.classList.remove(
                "is-loading"
            );

            if (button.dataset.originalText) {
                button.textContent =
                    button.dataset.originalText;
            }
        }
    }


    /* =====================================================
       MESSAGE
    ===================================================== */

    function showAnalyzeMessage(message, type) {
        let element =
            document.getElementById(
                "analyze-message"
            );

        if (!element) {
            element =
                document.createElement("div");

            element.id =
                "analyze-message";

            element.className =
                "analyze-message";

            document.body.appendChild(
                element
            );
        }

        element.textContent =
            message;

        element.dataset.type =
            type || "info";

        element.classList.add(
            "is-visible"
        );

        window.clearTimeout(
            element._timer
        );

        element._timer =
            window.setTimeout(
                function () {
                    element.classList.remove(
                        "is-visible"
                    );
                },
                4000
            );
    }


    /* =====================================================
       FILE SIZE
    ===================================================== */

    function formatFileSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        const index =
            Math.min(
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                ),
                units.length - 1
            );

        const size =
            bytes /
            Math.pow(1024, index);

        return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
    }

})();