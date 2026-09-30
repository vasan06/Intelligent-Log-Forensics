    /* =========================================================
       ILF SYNCHRONIZED LOG RAIN

       Same animation system as the sign-in page.
       ========================================================= */

    const LOG_EVENTS = [

      {
        severity: "INFO",
        source: "nginx",
        message: "GET /api/health 200 {{LATENCY}}ms"
      },

      {
        severity: "DEBUG",
        source: "redis",
        message: "PING latency={{LATENCY}}ms"
      },

      {
        severity: "INFO",
        source: "syslog",
        message: "Cron backup completed exit=0"
      },

      {
        severity: "WARN",
        source: "auth",
        message: "Login attempt from {{IP}}"
      },

      {
        severity: "INFO",
        source: "kernel",
        message: "process spawned pid={{PID}}"
      },

      {
        severity: "WARN",
        source: "nginx",
        message: "request latency exceeded {{LATENCY}}ms"
      },

      {
        severity: "ERROR",
        source: "auth",
        message: "authentication failure user=admin from {{IP}}"
      },

      {
        severity: "INFO",
        source: "systemd",
        message: "service worker started"
      },

      {
        severity: "WARN",
        source: "firewall",
        message: "connection from {{IP}} threshold reached"
      },

      {
        severity: "ERROR",
        source: "ssh",
        message: "failed publickey for root from {{IP}}"
      },

      {
        severity: "INFO",
        source: "api",
        message: "POST /events accepted 201"
      },

      {
        severity: "DEBUG",
        source: "parser",
        message: "event schema validated"
      },

      {
        severity: "CRITICAL",
        source: "iptables",
        message: "suspicious SYN rate from {{IP}}"
      },

      {
        severity: "WARN",
        source: "fail2ban",
        message: "repeated authentication failures from {{IP}}"
      },

      {
        severity: "ERROR",
        source: "apache2",
        message: "directory traversal pattern from {{IP}}"
      },

      {
        severity: "INFO",
        source: "collector",
        message: "batch received records={{RECORDS}}"
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
       DOM
       ========================================================= */

    const rain =
      document.getElementById("logRain");

    const logList =
      document.getElementById("logList");

    const conversionZone =
      document.getElementById("conversionZone");


    /* =========================================================
       STATE
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
       SHUFFLE
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
       TIME
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

      const log =
        document.createElement("div");

      log.className =
        "live-log";

      const severityColor =
        SEVERITY_COLOR[event.severity] ||
        "var(--auth-brand)";

      const time =
        document.createElement("span");

      time.className =
        "log-time";

      time.textContent =
        formatTime(event.timestamp);

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

      log.appendChild(time);
      log.appendChild(severity);
      log.appendChild(source);
      log.appendChild(message);

      logList.appendChild(log);

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
       PARTICLE
       ========================================================= */

    function createParticle(event) {

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

      const startY = -20;

      const targetY =
        conversionZone.offsetTop;

      const duration =
        2300 +
        Math.random() * 450;

      const color =
        SEVERITY_COLOR[event.severity] ||
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
       EVENT
       ========================================================= */

    function createEvent() {

      const event =
        getNextEvent();

      createParticle(
        event
      );

    }


    /* =========================================================
       START
       ========================================================= */

    function startRain() {

      shuffleEvents();

      const initialCount = 4;

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


    /* =========================================================
       PASSWORD TOGGLE HELPER
       ========================================================= */

    function setupPasswordToggle(
      input,
      button,
      icon
    ) {

      if (
        !input ||
        !button
      ) {
        return;
      }

      button.addEventListener(
        "click",
        () => {

          const isVisible =
            input.type === "text";

          input.type =
            isVisible
              ? "password"
              : "text";

          button.setAttribute(
            "aria-label",
            isVisible
              ? "Show password"
              : "Hide password"
          );

          if (icon) {

            icon.innerHTML =
              isVisible

                ? `
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                  />
                `

                : `
                  <path d="M3 3l18 18"/>
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
                  <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.1"/>
                  <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4-.8"/>
                `;

          }

        }
      );

    }


    /* =========================================================
       PASSWORD VISIBILITY
       ========================================================= */

    setupPasswordToggle(

      document.getElementById(
        "password"
      ),

      document.getElementById(
        "passwordToggle"
      ),

      document.getElementById(
        "eyeIcon"
      )

    );


    setupPasswordToggle(

      document.getElementById(
        "confirmPassword"
      ),

      document.getElementById(
        "confirmPasswordToggle"
      ),

      document.getElementById(
        "confirmEyeIcon"
      )

    );


    /* =========================================================
       PASSWORD STRENGTH
       ========================================================= */

    const passwordInput =
      document.getElementById(
        "password"
      );

    const strengthBar =
      document.getElementById(
        "strengthBar"
      );

    const strengthLabel =
      document.getElementById(
        "strengthLabel"
      );


    function calculatePasswordStrength(
      value
    ) {

      let score = 0;

      if (value.length >= 8) {
        score++;
      }

      if (value.length >= 12) {
        score++;
      }

      if (/[a-z]/.test(value)) {
        score++;
      }

      if (/[A-Z]/.test(value)) {
        score++;
      }

      if (/[0-9]/.test(value)) {
        score++;
      }

      if (
        /[^A-Za-z0-9]/.test(value)
      ) {
        score++;
      }

      return Math.min(
        score,
        5
      );

    }


    function updatePasswordStrength() {

      if (!passwordInput) {
        return;
      }

      const value =
        passwordInput.value;

      const score =
        calculatePasswordStrength(
          value
        );


      const widths = [
        "0%",
        "20%",
        "40%",
        "60%",
        "80%",
        "100%"
      ];


      const labels = [
        "Password",
        "Very weak",
        "Weak",
        "Fair",
        "Strong",
        "Very strong"
      ];


      strengthBar.style.width =
        widths[score];

      strengthLabel.textContent =
        labels[score];


      if (score <= 1) {

        strengthBar.style.background =
          "#c65454";

      } else if (score <= 3) {

        strengthBar.style.background =
          "#b08420";

      } else {

        strengthBar.style.background =
          "#5b9b79";

      }

    }


    passwordInput.addEventListener(
      "input",
      updatePasswordStrength
    );


    /* =========================================================
       CONFIRM PASSWORD
       ========================================================= */

    const confirmPassword =
      document.getElementById(
        "confirmPassword"
      );

    const matchError =
      document.getElementById(
        "matchError"
      );


    function validatePasswords() {

      if (
        !confirmPassword.value
      ) {

        confirmPassword.classList.remove(
          "valid",
          "invalid"
        );

        matchError.classList.remove(
          "visible"
        );

        return false;

      }


      const matches =
        passwordInput.value ===
        confirmPassword.value;


      confirmPassword.classList.toggle(
        "valid",
        matches
      );

      confirmPassword.classList.toggle(
        "invalid",
        !matches
      );

      matchError.classList.toggle(
        "visible",
        !matches
      );


      return matches;

    }


    confirmPassword.addEventListener(
      "input",
      validatePasswords
    );

    passwordInput.addEventListener(
      "input",
      () => {

        if (
          confirmPassword.value
        ) {
          validatePasswords();
        }

      }
    );


    /* =========================================================
       FORM VALIDATION
       ========================================================= */

    const signupForm =
      document.getElementById(
        "signupForm"
      );

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const passwordsMatch = validatePasswords();

  if (!signupForm.checkValidity() || !passwordsMatch) {
    signupForm.reportValidity();
    return;
  }

  const name =
    document.getElementById("name").value.trim();

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;

  const submitButton =
    signupForm.querySelector('button[type="submit"]');

  try {

    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    const data = await response.json();

    console.log("Signup response:", data);

    if (!response.ok) {
      alert(data.message || "Signup failed");
      return;
    }

    /*
     * Account successfully created.
     * Backend returns JWT token.
     */
    localStorage.setItem("ilf_access_token", data.token);
      if (result.refresh_token) localStorage.setItem("ilf_refresh_token", result.refresh_token);

    /*
     * Store user information if the dashboard needs it.
     */
    localStorage.setItem(
      "ilf_user",
      JSON.stringify(data.user)
    );

    /*
     * Go directly to dashboard.
     */
    window.location.href = "/dashboard.html";

  } catch (error) {

    console.error("Signup error:", error);

    alert("Unable to connect to the server.");

  } finally {

    submitButton.disabled = false;
    submitButton.textContent = "Create account";

  }
});


  const prefillEmail=new URLSearchParams(location.search).get('email');if(prefillEmail)
  {const emailEl=document.querySelector('input[type="email"]');if(emailEl)emailEl.value=prefillEmail;}
 