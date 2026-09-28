/* =========================================================
   PROFILE PAGE
   app/static/js/profile.js
========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initializeProfile();
  });

  function initializeProfile() {
    initializeNameValidation();
    initializeProfileForm();
    initializeActivityList();
  }

  /* =====================================================
     NAME VALIDATION
  ===================================================== */

  function initializeNameValidation() {
    const nameInput = document.querySelector(
      'input[name="name"]'
    );

    if (!nameInput) {
      return;
    }

    nameInput.addEventListener("input", function () {
      nameInput.value = nameInput.value.replace(/\s{2,}/g, " ");

      if (nameInput.value.trim().length > 0) {
        nameInput.classList.remove("input-error");
      }
    });
  }

  /* =====================================================
     PROFILE FORM
  ===================================================== */

  function initializeProfileForm() {
    const form = document.querySelector(
      'form[action*="update_profile"]'
    );

    if (!form) {
      return;
    }

    form.addEventListener("submit", function (event) {
      const nameInput = form.querySelector(
        'input[name="name"]'
      );

      if (!nameInput) {
        return;
      }

      const name = nameInput.value.trim();

      if (!name) {
        event.preventDefault();

        nameInput.classList.add("input-error");
        nameInput.focus();

        return;
      }

      nameInput.value = name;

      const submitButton = form.querySelector(
        'button[type="submit"]'
      );

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText =
          submitButton.textContent.trim();

        submitButton.textContent = "Saving...";
      }
    });
  }

  /* =====================================================
     ACTIVITY LIST
  ===================================================== */

  function initializeActivityList() {
    const items = document.querySelectorAll(
      ".profile-activity-item"
    );

    items.forEach(function (item, index) {
      item.style.opacity = "0";
      item.style.transform = "translateY(5px)";

      setTimeout(function () {
        item.style.transition =
          "opacity 0.25s ease, transform 0.25s ease";

        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
      }, index * 35);
    });
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.ProfilePage = {
    refresh: function () {
      initializeActivityList();
    }
  };
})();