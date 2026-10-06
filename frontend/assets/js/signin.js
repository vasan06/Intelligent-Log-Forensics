/* =========================================================
       ILF SIGN-IN SCRIPT
       ========================================================= */

    "use strict";


    /* =========================================================
       DOM REFERENCES
       ========================================================= */

    const signinForm =
      document.getElementById("signinForm");

    const emailInput =
      document.getElementById("email");

    const passwordInput =
      document.getElementById("password");

    const signinButton =
      signinForm?.querySelector(
        'button[type="submit"]'
      );

    const passwordToggle =
      document.getElementById("passwordToggle");

    const eyeIcon =
      document.getElementById("eyeIcon");

    const signinError =
      document.getElementById("signinError");

    const signinErrorText =
      document.getElementById("signinErrorText");

    const rain =
      document.getElementById("logRain");

    const logList =
      document.getElementById("logList");

    const conversionZone =
      document.getElementById("conversionZone");


    /* =========================================================
       SIGN-IN ERROR
       ========================================================= */

    function clearSigninError() {

      if (signinError) {
        signinError.hidden = true;
      }

      if (signinErrorText) {
        signinErrorText.textContent = "";
      }

      if (emailInput) {
        emailInput.classList.remove("field-error");
        emailInput.removeAttribute("aria-invalid");
      }

      if (passwordInput) {
        passwordInput.classList.remove("field-error");
        passwordInput.removeAttribute("aria-invalid");
      }
    }


    function showSigninError(
      message,
      input = null
    ) {

      if (signinErrorText) {
        signinErrorText.textContent =
          String(message || "Sign-in failed.");
      }

      if (signinError) {
        signinError.hidden = false;
      }

      if (input) {
        input.classList.add("field-error");
        input.setAttribute(
          "aria-invalid",
          "true"
        );
      }
    }


    /* =========================================================
       EMAIL VALIDATION
       ========================================================= */

    function isValidEmail(email) {

      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
    }


    /* =========================================================
       EXTRACT AUTH TOKEN
       
       Supports:
       
       {
         access_token: "..."
       }

       {
         token: "..."
       }

       {
         accessToken: "..."
       }

       {
         data: {
           access_token: "..."
         }
       }

       {
         data: {
           token: "..."
         }
       }
       ========================================================= */

    function extractAccessToken(result) {

      if (!result || typeof result !== "object") {
        return null;
      }

      const candidates = [

        result.access_token,

        result.token,

        result.accessToken,

        result?.data?.access_token,

        result?.data?.token,

        result?.data?.accessToken,

        result?.auth?.access_token,

        result?.auth?.token

      ];

      for (const token of candidates) {

        if (
          typeof token === "string" &&
          token.trim().length > 0
        ) {

          return token.trim();

        }

      }

      return null;
    }


    /* =========================================================
       EXTRACT USER
       ========================================================= */

    function extractUser(result) {

      if (!result || typeof result !== "object") {
        return null;
      }

      return (
        result.user ||
        result.data?.user ||
        result.account ||
        null
      );
    }


    /* =========================================================
       EXTRACT ERROR MESSAGE
       ========================================================= */

    function extractErrorMessage(
      result,
      response
    ) {

      if (result && typeof result === "object") {

        if (
          typeof result.message === "string" &&
          result.message.trim()
        ) {

          return result.message.trim();

        }

        if (
          typeof result.detail === "string" &&
          result.detail.trim()
        ) {

          return result.detail.trim();

        }

        if (
          typeof result.error === "string" &&
          result.error.trim()
        ) {

          return result.error.trim();

        }

        if (
          typeof result?.data?.message === "string" &&
          result.data.message.trim()
        ) {

          return result.data.message.trim();

        }

      }

      if (response?.status === 401) {
        return "Invalid email or password.";
      }

      if (response?.status === 403) {
        return "Account is inactive. Please contact an administrator.";
      }

      if (response?.status === 404) {
        return "No account found. Redirecting to account creation…";
      }

      if (
        response?.status >= 500
      ) {

        return "The authentication server encountered an error.";
      }

      return "Sign-in failed. Please check your credentials and try again.";
    }


    /* =========================================================
       AUTHENTICATION
       ========================================================= */

    let signinInProgress = false;


    if (signinForm) {

      signinForm.addEventListener(
        "submit",
        async (event) => {

          event.preventDefault();

          if (signinInProgress) {
            return;
          }

          clearSigninError();


          /* ---------------------------------------------------
             READ INPUT
             --------------------------------------------------- */

          const email =
            (emailInput?.value || "")
              .trim()
              .toLowerCase();

          const password =
            passwordInput?.value || "";


          /* ---------------------------------------------------
             VALIDATE EMAIL
             --------------------------------------------------- */

          if (!email) {

            showSigninError(
              "Please enter your email address.",
              emailInput
            );

            emailInput?.focus();

            return;
          }


          if (!isValidEmail(email)) {

            showSigninError(
              "Please enter a valid email address.",
              emailInput
            );

            emailInput?.focus();

            return;
          }


          /* ---------------------------------------------------
             VALIDATE PASSWORD
             --------------------------------------------------- */

          if (!password) {

            showSigninError(
              "Please enter your password.",
              passwordInput
            );

            passwordInput?.focus();

            return;
          }


          /* ---------------------------------------------------
             LOADING
             --------------------------------------------------- */

          signinInProgress = true;

          const originalButtonText =
            signinButton?.textContent ||
            "Sign in";


          if (signinButton) {

            signinButton.disabled = true;

            signinButton.textContent =
              "Signing in…";
          }


          /* ---------------------------------------------------
             API LOGIN
             --------------------------------------------------- */

          try {

            const response =
              await fetch(
                "/api/auth/login",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    "Accept":
                      "application/json"
                  },

                  body:
                    JSON.stringify({
                      email,
                      password
                    })
                }
              );


            /* -------------------------------------------------
               READ RESPONSE BODY SAFELY
               ------------------------------------------------- */

            const contentType =
              response.headers.get(
                "content-type"
              ) || "";


            let result = {};


            if (
              contentType
                .toLowerCase()
                .includes("application/json")
            ) {

              try {

                result =
                  await response.json();

              } catch (jsonError) {

                console.error(
                  "ILF login JSON parse error:",
                  jsonError
                );

                result = {};

              }

            } else {

              const rawText =
                await response.text();

              if (rawText.trim()) {

                try {

                  result =
                    JSON.parse(rawText);

                } catch {

                  result = {
                    raw: rawText
                  };

                }

              }

            }


            /* -------------------------------------------------
               DEBUG INFORMATION
               
               This is intentionally useful while fixing
               authentication. It can be removed later.
               ------------------------------------------------- */

            console.log(
              "ILF login response:",
              {
                status: response.status,
                ok: response.ok,
                body: result
              }
            );


            /* -------------------------------------------------
               EXPLICIT BACKEND FAILURE
               
               If backend says:
               
               success: false
               
               then it is a real failure even if HTTP is 200.
               ------------------------------------------------- */

            if (
              result &&
              result.success === false
            ) {

              showSigninError(
                extractErrorMessage(
                  result,
                  response
                )
              );

              if (passwordInput) {

                passwordInput.value = "";

                passwordInput.focus();

              }

              return;
            }


            /* -------------------------------------------------
               HTTP FAILURE
               ------------------------------------------------- */

            if (response.status === 404 && result?.redirect) {
              const signupUrl = new URL(result.redirect, window.location.origin);
              signupUrl.searchParams.set("email", email);
              window.location.href = signupUrl.pathname + signupUrl.search;
              return;
            }

            if (!response.ok) {

              showSigninError(
                extractErrorMessage(
                  result,
                  response
                )
              );

              if (passwordInput) {

                passwordInput.value = "";

                passwordInput.focus();

              }

              return;
            }


            /* -------------------------------------------------
               HTTP 200 / SUCCESS
               
               IMPORTANT:
               
               We DO NOT require:
               
                 result.success === true
               
               because a valid backend may simply return:
               
                 {
                   "access_token": "...",
                   "user": {...}
                 }
               
               HTTP 200 + token is sufficient.
               ------------------------------------------------- */

            const accessToken =
              extractAccessToken(
                result
              );


            /* -------------------------------------------------
               TOKEN REQUIRED FOR ILF DASHBOARD
               ------------------------------------------------- */

            if (!accessToken) {

              console.error(
                "ILF login returned HTTP",
                response.status,
                "but no authentication token was found.",
                result
              );

              showSigninError(
                "Sign-in succeeded, but the server did not return an authentication token."
              );

              return;
            }


            /* -------------------------------------------------
               SAVE TOKEN
               ------------------------------------------------- */

            localStorage.setItem("ilf_access_token", accessToken);
            localStorage.removeItem("ilf_token");
            if (result.refresh_token) localStorage.setItem("ilf_refresh_token", result.refresh_token);


            /* -------------------------------------------------
               SAVE USER
               ------------------------------------------------- */

            const user =
              extractUser(result);


            if (user) {

              localStorage.setItem(
                "ilf_user",
                JSON.stringify(user)
              );

            }


            /* -------------------------------------------------
               REMEMBER ME
               ------------------------------------------------- */

            const rememberCheckbox =
              signinForm.querySelector(
                'input[name="remember"]'
              );


            if (
              rememberCheckbox &&
              rememberCheckbox.checked
            ) {

              localStorage.setItem(
                "ilf_remember",
                "true"
              );

            } else {

              localStorage.removeItem(
                "ilf_remember"
              );

            }


            /* -------------------------------------------------
               SUCCESS
               ------------------------------------------------- */

            console.log(
              "ILF sign-in successful."
            );


            const requestedNext = new URLSearchParams(window.location.search).get("next");
            let destination = "/dashboard";
            if (requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
              const safeDestination = new URL(requestedNext, window.location.origin);
              if (safeDestination.origin === window.location.origin) {
                destination = safeDestination.pathname + safeDestination.search + safeDestination.hash;
              }
            }
            window.location.href = destination;


          } catch (error) {

            console.error(
              "ILF sign-in network error:",
              error
            );


            showSigninError(
              "Unable to connect to the server. Please try again."
            );


          } finally {

            signinInProgress = false;


            if (signinButton) {

              signinButton.disabled =
                false;

              signinButton.textContent =
                originalButtonText;

            }

          }

        }
      );

    }


    /* =========================================================
       CLEAR ERRORS WHEN USER EDITS INPUT
       ========================================================= */

    if (emailInput) {

      emailInput.addEventListener(
        "input",
        () => {

          if (
            emailInput.classList.contains(
              "field-error"
            )
          ) {

            clearSigninError();

          }

        }
      );

    }


    if (passwordInput) {

      passwordInput.addEventListener(
        "input",
        () => {

          if (
            passwordInput.classList.contains(
              "field-error"
            )
          ) {

            clearSigninError();

          }

        }
      );

    }


    /* =========================================================
       PASSWORD VISIBILITY
       ========================================================= */

    if (
      passwordInput &&
      passwordToggle
    ) {

      passwordToggle.addEventListener(
        "click",
        () => {

          const isVisible =
            passwordInput.type === "text";


          passwordInput.type =
            isVisible
              ? "password"
              : "text";


          passwordToggle.setAttribute(
            "aria-label",
            isVisible
              ? "Show password"
              : "Hide password"
          );


          if (eyeIcon) {

            eyeIcon.innerHTML =
              isVisible

                ? `
                  <path
                    d="M2 12s3.5-7 10-7
                       10 7 10 7
                       -3.5 7-10 7
                       S2 12 2 12z"
                  />

                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                  />
                `

                : `
                  <path d="M3 3l18 18"/>

                  <path
                    d="M10.6 10.6
                       a2 2 0 0 0
                       2.8 2.8"
                  />

                  <path
                    d="M9.9 5.2
                       A10.7 10.7 0 0 1 12 5
                       c6.5 0 10 7 10 7
                       a17.4 17.4 0 0 1-3.2 4.1"
                  />

                  <path
                    d="M6.6 6.6
                       C3.7 8.5 2 12 2 12
                       s3.5 7 10 7
                       a10.8 10.8 0 0 0 4-.8"
                  />
                `;

          }

        }
      );

    }


    /* =========================================================
       ILF SYNCHRONIZED LOG RAIN
       =========================================================

       ONE UNIQUE EVENT
            ↓
       ONE PARTICLE
            ↓
       PARTICLE FALLS
            ↓
       PARTICLE HITS CONVERSION ZONE
            ↓
       SAME EVENT BECOMES LOG

       ========================================================= */


    /* =========================================================
       EVENT DATA
       ========================================================= */

    const LOG_EVENTS = [

      {
        severity: "INFO",
        source: "nginx",
        message:
          "GET /api/health 200 {{LATENCY}}ms"
      },

      {
        severity: "DEBUG",
        source: "redis",
        message:
          "PING latency={{LATENCY}}ms"
      },

      {
        severity: "INFO",
        source: "syslog",
        message:
          "Cron backup completed exit=0"
      },

      {
        severity: "WARN",
        source: "auth",
        message:
          "Login attempt from {{IP}}"
      },

      {
        severity: "INFO",
        source: "kernel",
        message:
          "process spawned pid={{PID}}"
      },

      {
        severity: "WARN",
        source: "nginx",
        message:
          "request latency exceeded {{LATENCY}}ms"
      },

      {
        severity: "ERROR",
        source: "auth",
        message:
          "authentication failure user=admin from {{IP}}"
      },

      {
        severity: "INFO",
        source: "systemd",
        message:
          "service worker started"
      },

      {
        severity: "WARN",
        source: "firewall",
        message:
          "connection from {{IP}} threshold reached"
      },

      {
        severity: "ERROR",
        source: "ssh",
        message:
          "failed publickey for root from {{IP}}"
      },

      {
        severity: "INFO",
        source: "api",
        message:
          "POST /events accepted 201"
      },

      {
        severity: "DEBUG",
        source: "parser",
        message:
          "event schema validated"
      },

      {
        severity: "CRITICAL",
        source: "iptables",
        message:
          "suspicious SYN rate from {{IP}}"
      },

      {
        severity: "WARN",
        source: "fail2ban",
        message:
          "repeated authentication failures from {{IP}}"
      },

      {
        severity: "ERROR",
        source: "apache2",
        message:
          "directory traversal pattern from {{IP}}"
      },

      {
        severity: "INFO",
        source: "collector",
        message:
          "batch received records={{RECORDS}}"
      }

    ];


    /* =========================================================
       SEVERITY COLORS
       ========================================================= */

    const SEVERITY_COLOR = {

      INFO:
        "var(--log-info)",

      DEBUG:
        "var(--log-debug)",

      WARN:
        "var(--log-warn)",

      ERROR:
        "var(--log-error)",

      CRITICAL:
        "var(--log-critical)"

    };


    /* =========================================================
       LOG RAIN STATE
       ========================================================= */

    let eventId = 0;

    const MAX_LOGS = 15;

    let eventPool = [];


    /* =========================================================
       RANDOM IP
       ========================================================= */

    function generateRandomIP() {

      let first;

      do {

        first =
          Math.floor(
            Math.random() * 223
          ) + 1;

      } while (
        first === 127
      );


      const second =
        Math.floor(
          Math.random() * 256
        );


      const third =
        Math.floor(
          Math.random() * 256
        );


      const fourth =
        Math.floor(
          Math.random() * 254
        ) + 1;


      return [
        first,
        second,
        third,
        fourth
      ].join(".");

    }


    /* =========================================================
       SHUFFLE EVENT POOL
       ========================================================= */

    function shuffleEvents() {

      eventPool = [
        ...LOG_EVENTS
      ];


      for (
        let i = eventPool.length - 1;
        i > 0;
        i--
      ) {

        const j =
          Math.floor(
            Math.random() * (i + 1)
          );


        [
          eventPool[i],
          eventPool[j]
        ] = [
          eventPool[j],
          eventPool[i]
        ];

      }

    }


    /* =========================================================
       NEXT EVENT
       ========================================================= */

    function getNextEvent() {

      if (
        eventPool.length === 0
      ) {

        shuffleEvents();

      }


      const baseEvent =
        eventPool.pop();


      const randomIP =
        generateRandomIP();


      const randomPID =
        Math.floor(
          Math.random() * 9000
        ) + 1000;


      const randomLatency =
        Math.floor(
          Math.random() * 500
        ) + 100;


      const randomRecords =
        Math.floor(
          Math.random() * 900
        ) + 100;


      const message =
        baseEvent.message

          .replaceAll(
            "{{IP}}",
            randomIP
          )

          .replaceAll(
            "{{PID}}",
            randomPID
          )

          .replaceAll(
            "{{LATENCY}}",
            randomLatency
          )

          .replaceAll(
            "{{RECORDS}}",
            randomRecords
          );


      return {

        ...baseEvent,

        message,

        id:
          ++eventId,

        timestamp:
          new Date()

      };

    }


    /* =========================================================
       FORMAT TIME
       ========================================================= */

    function formatTime(date) {

      return date.toLocaleTimeString(
        "en-IN",
        {
          hour12: false
        }
      );

    }


    /* =========================================================
       MATERIALIZE LOG
       ========================================================= */

    function materializeLog(event) {

      if (!logList) {
        return;
      }


      const log =
        document.createElement("div");


      log.className =
        "live-log";


      const severityColor =
        SEVERITY_COLOR[
          event.severity
        ] ||
        "var(--auth-brand)";


      const time =
        document.createElement("span");


      time.className =
        "log-time";


      time.textContent =
        formatTime(
          event.timestamp
        );


      const severity =
        document.createElement("span");


      severity.className =
        "log-severity";


      severity.style.color =
        severityColor;


      severity.textContent =
        event.severity;


      const source =
        document.createElement("span");


      source.className =
        "log-source";


      source.textContent =
        event.source;


      const message =
        document.createElement("span");


      message.className =
        "log-message";


      message.textContent =
        event.message;


      log.appendChild(
        time
      );

      log.appendChild(
        severity
      );

      log.appendChild(
        source
      );

      log.appendChild(
        message
      );


      logList.appendChild(
        log
      );


      while (
        logList.children.length >
        MAX_LOGS
      ) {

        logList.firstElementChild.remove();

      }

    }


    /* =========================================================
       CONVERSION FLASH
       ========================================================= */

    function createConversionFlash(
      x,
      color
    ) {

      if (
        !rain ||
        !conversionZone
      ) {

        return;
      }


      const flash =
        document.createElement("div");


      flash.className =
        "conversion-flash";


      flash.style.left =
        `${x}px`;


      flash.style.top =
        `${conversionZone.offsetTop}px`;


      flash.style.setProperty(
        "--flash-color",
        color
      );


      rain.appendChild(
        flash
      );


      flash.addEventListener(
        "animationend",
        () => {

          flash.remove();

        },
        {
          once: true
        }
      );

    }


    /* =========================================================
       CREATE PARTICLE
       ========================================================= */

    function createParticle(event) {

      if (
        !rain ||
        !conversionZone
      ) {

        return;
      }


      const particle =
        document.createElement("div");


      particle.className =
        "rain-particle";


      const minX = 90;


      const maxX =
        Math.max(
          minX + 1,
          rain.clientWidth - 90
        );


      const x =
        minX +
        Math.random() *
        (maxX - minX);


      const startY =
        -20;


      const targetY =
        conversionZone.offsetTop;


      const duration =
        2300 +
        Math.random() * 450;


      const color =
        SEVERITY_COLOR[
          event.severity
        ] ||
        "var(--auth-brand)";


      particle.style.left =
        `${x}px`;


      particle.style.top =
        `${startY}px`;


      particle.style.setProperty(
        "--particle-color",
        color
      );


      rain.appendChild(
        particle
      );


      const animation =
        particle.animate(

          [

            {
              transform:
                "translate3d(-50%, 0, 0)",

              opacity: 0
            },

            {
              transform:
                "translate3d(-50%, 0, 0)",

              opacity: 1,

              offset: 0.05
            },

            {
              transform:
                `translate3d(
                  -50%,
                  ${targetY - startY - 8}px,
                  0
                )`,

              opacity: 1,

              offset: 0.90
            },

            {
              transform:
                `translate3d(
                  -50%,
                  ${targetY - startY}px,
                  0
                ) scale(0.25)`,

              opacity: 0
            }

          ],

          {

            duration,

            easing:
              "cubic-bezier(0.35, 0, 0.65, 1)",

            fill:
              "forwards"

          }

        );


      animation.finished

        .then(() => {

          createConversionFlash(
            x,
            color
          );


          materializeLog(
            event
          );


          particle.remove();

        })

        .catch(() => {

          particle.remove();

        });

    }


    /* =========================================================
       CREATE EVENT
       ========================================================= */

    function createEvent() {

      const event =
        getNextEvent();


      createParticle(
        event
      );

    }


    /* =========================================================
       START RAIN
       ========================================================= */

    function startRain() {

      if (
        !rain ||
        !logList ||
        !conversionZone
      ) {

        return;
      }


      shuffleEvents();


      const initialCount =
        4;


      for (
        let i = 0;
        i < initialCount;
        i++
      ) {

        setTimeout(
          () => {

            createEvent();

          },
          i * 650
        );

      }


      setInterval(
        createEvent,
        1100
      );

    }


    /* =========================================================
       START AFTER PAGE LOAD
       ========================================================= */

    window.addEventListener(
      "load",
      () => {

        requestAnimationFrame(
          () => {

            startRain();

          }
        );

      }
    );
