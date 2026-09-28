/* =========================================================
   UPLOAD PAGE
   Intelligent Log Forensics
========================================================= */

(function () {
    "use strict";

    const MAX_FILE_SIZE = 100 * 1024 * 1024;

    const ALLOWED_EXTENSIONS = [
        ".csv",
        ".json",
        ".jsonl",
        ".txt",
        ".log"
    ];

    document.addEventListener("DOMContentLoaded", function () {
        initializeUploadPage();
    });

    /* =====================================================
       INITIALIZATION
    ===================================================== */

    function initializeUploadPage() {
        const zone = document.getElementById("upload-zone");
        const input = document.getElementById("file-input");
        const form = document.getElementById("upload-form");

        if (!zone || !input || !form) {
            return;
        }

        initializeUploadZone(zone, input);
        initializeForm(form, input);
        initializeKeyboardAccess(zone, input);
    }

    /* =====================================================
       UPLOAD ZONE
    ===================================================== */

    function initializeUploadZone(zone, input) {
        zone.addEventListener("dragover", function (event) {
            event.preventDefault();
            event.stopPropagation();

            zone.classList.add("drag-over");
        });

        zone.addEventListener("dragenter", function (event) {
            event.preventDefault();
            zone.classList.add("drag-over");
        });

        zone.addEventListener("dragleave", function (event) {
            event.preventDefault();

            if (!zone.contains(event.relatedTarget)) {
                zone.classList.remove("drag-over");
            }
        });

        zone.addEventListener("drop", function (event) {
            event.preventDefault();
            event.stopPropagation();

            zone.classList.remove("drag-over");

            const files = event.dataTransfer
                ? event.dataTransfer.files
                : null;

            if (!files || files.length === 0) {
                return;
            }

            const file = files[0];

            if (!validateFile(file)) {
                return;
            }

            try {
                const dataTransfer = new DataTransfer();

                dataTransfer.items.add(file);
                input.files = dataTransfer.files;

                handleFileSelect(input);
            } catch (error) {
                console.error(
                    "Unable to assign dropped file:",
                    error
                );

                showError(
                    "Unable to process the dropped file."
                );
            }
        });
    }

    /* =====================================================
       KEYBOARD ACCESSIBILITY
    ===================================================== */

    function initializeKeyboardAccess(zone, input) {
        zone.addEventListener("keydown", function (event) {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();
                input.click();
            }
        });
    }

    /* =====================================================
       FILE SELECTION
    ===================================================== */

    window.handleFileSelect = function (input) {
        if (
            !input ||
            !input.files ||
            input.files.length === 0
        ) {
            return;
        }

        const file = input.files[0];

        if (!validateFile(file)) {
            clearFile();
            return;
        }

        updateFilePreview(file);

        clearError();
    };

    /* =====================================================
       FILE VALIDATION
    ===================================================== */

    function validateFile(file) {
        if (!file) {
            showError("Please select a file.");
            return false;
        }

        if (!hasAllowedExtension(file.name)) {
            showError(
                "Unsupported file type. Please upload CSV, JSON, JSONL, TXT, or LOG."
            );

            return false;
        }

        if (file.size > MAX_FILE_SIZE) {
            showError(
                "File size cannot exceed 100 MB."
            );

            return false;
        }

        return true;
    }

    function hasAllowedExtension(filename) {
        const lowerName = filename.toLowerCase();

        return ALLOWED_EXTENSIONS.some(function (extension) {
            return lowerName.endsWith(extension);
        });
    }

    /* =====================================================
       FILE PREVIEW
    ===================================================== */

    function updateFilePreview(file) {
        const preview = document.getElementById(
            "file-preview"
        );

        const fileName = document.getElementById(
            "file-name"
        );

        const fileSize = document.getElementById(
            "file-size"
        );

        const submitButton = document.getElementById(
            "submit-btn"
        );

        const zone = document.getElementById(
            "upload-zone"
        );

        if (fileName) {
            fileName.textContent = file.name;
        }

        if (fileSize) {
            fileSize.textContent =
                formatFileSize(file.size);
        }

        if (preview) {
            preview.style.display = "block";
        }

        if (submitButton) {
            submitButton.disabled = false;
        }

        if (zone) {
            zone.style.opacity = "0.6";
        }
    }

    /* =====================================================
       CLEAR FILE
    ===================================================== */

    window.clearFile = function () {
        const input = document.getElementById(
            "file-input"
        );

        const preview = document.getElementById(
            "file-preview"
        );

        const submitButton = document.getElementById(
            "submit-btn"
        );

        const zone = document.getElementById(
            "upload-zone"
        );

        if (input) {
            input.value = "";
        }

        if (preview) {
            preview.style.display = "none";
        }

        if (submitButton) {
            submitButton.disabled = true;

            submitButton.innerHTML = `
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Analyze Log File
            `;
        }

        if (zone) {
            zone.style.opacity = "1";
        }

        resetProgress();
        clearError();
    };

    /* =====================================================
       FORM SUBMISSION
    ===================================================== */

    function initializeForm(form, input) {
        form.addEventListener("submit", function (event) {
            if (
                !input.files ||
                input.files.length === 0
            ) {
                event.preventDefault();

                showError(
                    "Please select a log file first."
                );

                return;
            }

            const file = input.files[0];

            if (!validateFile(file)) {
                event.preventDefault();
                return;
            }

            startProgress();
        });
    }

    /* =====================================================
       UPLOAD PROGRESS
    ===================================================== */

    function startProgress() {
        const progressWrap =
            document.getElementById(
                "progress-wrap"
            );

        const progressFill =
            document.getElementById(
                "progress-fill"
            );

        const progressPercent =
            document.getElementById(
                "progress-pct"
            );

        const submitButton =
            document.getElementById(
                "submit-btn"
            );

        if (!progressWrap) {
            return;
        }

        progressWrap.style.display = "block";

        if (submitButton) {
            submitButton.disabled = true;

            submitButton.innerHTML = `
                <span
                    class="spinner"
                    style="
                        width:16px;
                        height:16px;
                        border-width:2px
                    "
                ></span>
                Analyzing...
            `;
        }

        let progress = 0;

        const timer = setInterval(function () {
            const increment =
                Math.random() * 7 + 2;

            progress = Math.min(
                progress + increment,
                90
            );

            if (progressFill) {
                progressFill.style.width =
                    progress + "%";
            }

            if (progressPercent) {
                progressPercent.textContent =
                    Math.round(progress) + "%";
            }

            if (progress >= 90) {
                clearInterval(timer);
            }
        }, 250);
    }

    /* =====================================================
       RESET PROGRESS
    ===================================================== */

    function resetProgress() {
        const progressWrap =
            document.getElementById(
                "progress-wrap"
            );

        const progressFill =
            document.getElementById(
                "progress-fill"
            );

        const progressPercent =
            document.getElementById(
                "progress-pct"
            );

        if (progressWrap) {
            progressWrap.style.display = "none";
        }

        if (progressFill) {
            progressFill.style.width = "0%";
        }

        if (progressPercent) {
            progressPercent.textContent = "0%";
        }
    }

    /* =====================================================
       FILE SIZE
    ===================================================== */

    function formatFileSize(bytes) {
        if (!bytes || bytes <= 0) {
            return "0 Bytes";
        }

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB"
        ];

        const index = Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );

        const value =
            bytes /
            Math.pow(1024, index);

        if (index === 0) {
            return (
                Math.round(value) +
                " " +
                units[index]
            );
        }

        return (
            value.toFixed(1) +
            " " +
            units[index]
        );
    }

    /* =====================================================
       ERROR HANDLING
    ===================================================== */

    function showError(message) {
        clearError();

        const form =
            document.getElementById(
                "upload-form"
            );

        if (!form) {
            return;
        }

        const alert =
            document.createElement("div");

        alert.id = "upload-client-error";
        alert.className =
            "alert alert-error";

        alert.style.marginBottom =
            "var(--space-4)";

        alert.textContent = message;

        form.parentNode.insertBefore(
            alert,
            form
        );
    }

    function clearError() {
        const error =
            document.getElementById(
                "upload-client-error"
            );

        if (error) {
            error.remove();
        }
    }

})();