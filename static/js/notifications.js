/* =========================================================
   NOTIFICATIONS PAGE
   app/static/js/notifications.js
========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initNotifications();
  });

  function initNotifications() {
    animateNotifications();
    setupNotificationHover();
  }

  /* =====================================================
     ENTRY ANIMATION
  ===================================================== */

  function animateNotifications() {
    const items = document.querySelectorAll(".notification-item");

    items.forEach(function (item, index) {
      item.style.opacity = "0";
      item.style.transform = "translateY(8px)";

      setTimeout(function () {
        item.style.transition =
          "opacity 0.25s ease, transform 0.25s ease";

        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
      }, index * 45);
    });
  }

  /* =====================================================
     HOVER EFFECT
  ===================================================== */

  function setupNotificationHover() {
    const items = document.querySelectorAll(".notification-item");

    items.forEach(function (item) {
      item.addEventListener("mouseenter", function () {
        item.classList.add("notification-hover");
      });

      item.addEventListener("mouseleave", function () {
        item.classList.remove("notification-hover");
      });
    });
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.NotificationsPage = {
    refresh: function () {
      animateNotifications();
    }
  };
})();