const nutritrackAuthRuntime = {
  runtime: {
    identityMode: "single_user_local",
    developmentSeedEnabled: false,
    usesImplicitLocalUser: true,
    requiresAuthenticatedUser: false,
    summary: "single_user_local",
  },
  session: null,
  uiInitialized: false,
};

const authShell = document.querySelector("[data-auth-shell]");
const appShell = document.querySelector("[data-app-shell]");
const authForm = document.querySelector("[data-auth-form]");
const authFeedback = document.querySelector("[data-auth-feedback]");
const authHint = document.querySelector("[data-auth-hint]");
const authSubmitButton = document.querySelector("[data-auth-submit]");
const authModeSwitch = document.querySelector("[data-auth-mode-switch]");
const authModeButtons = document.querySelectorAll("[data-auth-mode-toggle]");
const authLogoutButton = document.querySelector("[data-auth-logout]");
const sessionUserLabel = document.querySelector("[data-session-user-label]");
const authEmailField = document.querySelector("[data-auth-email-field]");
const authPasswordField = document.querySelector("[data-auth-password-field]");
const authRegisterOnlyFields = document.querySelectorAll("[data-auth-register-only]");
const authResetConfirmOnlyFields = document.querySelectorAll("[data-auth-reset-confirm-only]");
const authForgotPasswordButton = document.querySelector("[data-auth-forgot-password]");
const authBackLoginButton = document.querySelector("[data-auth-back-login]");
const buildAuthApiPath = window.NutriTrackBootstrap.buildNutriTrackApiPath;
const passwordResetToken = new URLSearchParams(window.location.search).get("resetToken") || "";

async function readAuthJsonResponse(response, endpointLabel) {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    const contentPreview = responseText.replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(
      `Risposta non JSON da ${endpointLabel} (${response.status}). ` +
        `Controlla il reverse proxy: ${contentPreview || "corpo vuoto"}.`
    );
  }
}

function setAuthFeedback(message, tone = "error") {
  if (!authFeedback) {
    return;
  }

  authFeedback.textContent = message || "";
  authFeedback.classList.toggle("is-success", tone === "success");
}

function markAuthFormValidationAttempt(form) {
  if (!form) {
    return;
  }

  form.dataset.validationState = "submitted";
  form.querySelectorAll("input").forEach((control) => {
    const field = control.closest(".field");
    const shouldHighlight = !control.checkValidity();

    control.classList.toggle("field-invalid-control", shouldHighlight);

    if (field) {
      field.classList.toggle("field-invalid", shouldHighlight);
    }
  });
}

function bindAuthFormValidationFeedback(form) {
  if (!form) {
    return;
  }

  const refresh = () => {
    const shouldValidate = form.dataset.validationState === "submitted";

    form.querySelectorAll("input").forEach((control) => {
      const field = control.closest(".field");
      const shouldHighlight = shouldValidate && !control.checkValidity();

      control.classList.toggle("field-invalid-control", shouldHighlight);

      if (field) {
        field.classList.toggle("field-invalid", shouldHighlight);
      }
    });
  };

  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
}

function getAuthMode() {
  const mode = authForm?.elements?.mode?.value;
  return ["register", "password-reset-request", "password-reset-confirm"].includes(mode) ? mode : "login";
}

function updateAuthMode(mode) {
  if (!authForm) {
    return;
  }

  const nextMode = ["login", "register", "password-reset-request", "password-reset-confirm"].includes(mode) ? mode : "login";
  authForm.elements.mode.value = nextMode;

  authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authModeToggle === nextMode);
  });

  authRegisterOnlyFields.forEach((field) => {
    field.hidden = nextMode !== "register";
  });

  authResetConfirmOnlyFields.forEach((field) => {
    field.hidden = nextMode !== "password-reset-confirm";
  });

  if (authForm.elements.firstName) {
    authForm.elements.firstName.required = nextMode === "register";
  }

  if (authForm.elements.lastName) {
    authForm.elements.lastName.required = nextMode === "register";
  }

  if (authEmailField) {
    authEmailField.hidden = nextMode === "password-reset-confirm";
  }

  if (authPasswordField) {
    authPasswordField.hidden = nextMode === "password-reset-request";
  }

  if (authForm.elements.email) {
    authForm.elements.email.required = nextMode !== "password-reset-confirm";
  }

  if (authForm.elements.password) {
    authForm.elements.password.required = nextMode !== "password-reset-request";
    authForm.elements.password.autocomplete =
      nextMode === "login" ? "current-password" : "new-password";
    authForm.elements.password.placeholder =
      nextMode === "password-reset-confirm" ? "Nuova password" : "Almeno 8 caratteri";
  }

  if (authForm.elements.passwordConfirmation) {
    authForm.elements.passwordConfirmation.required = nextMode === "password-reset-confirm";
  }

  if (authModeSwitch) {
    authModeSwitch.hidden = nextMode === "password-reset-request" || nextMode === "password-reset-confirm";
  }

  if (authSubmitButton) {
    authSubmitButton.textContent =
      nextMode === "register"
        ? "Crea account"
        : nextMode === "password-reset-request"
        ? "Invia link"
        : nextMode === "password-reset-confirm"
        ? "Aggiorna password"
        : "Accedi";
  }

  if (authForgotPasswordButton) {
    authForgotPasswordButton.hidden = nextMode !== "login";
  }

  if (authBackLoginButton) {
    authBackLoginButton.hidden = nextMode === "login";
  }

  if (authHint) {
    authHint.textContent =
      nextMode === "register"
        ? "Crea un account per collegare i tuoi dati al tuo profilo personale."
        : nextMode === "password-reset-request"
        ? "Inserisci la mail associata al tuo account: riceverai un link valido per 30 minuti."
        : nextMode === "password-reset-confirm"
        ? "Inserisci una nuova password e ripetila per confermare il cambio."
        : "Inserisci le tue credenziali per entrare nell'app.";
  }

  authForm.dataset.validationState = "";
  setAuthFeedback("");
}

function applyAuthenticationUi() {
  const requiresAuthenticatedUser = nutritrackAuthRuntime.runtime.identityMode === "authenticated_user";
  const isAuthenticated = Boolean(nutritrackAuthRuntime.session);

  if (authShell) {
    authShell.hidden = !requiresAuthenticatedUser || isAuthenticated;
  }

  if (appShell) {
    appShell.hidden = requiresAuthenticatedUser && !isAuthenticated;
  }

  if (sessionUserLabel) {
    if (requiresAuthenticatedUser && (nutritrackAuthRuntime.session?.fullName || nutritrackAuthRuntime.session?.email)) {
      sessionUserLabel.textContent = nutritrackAuthRuntime.session.fullName || nutritrackAuthRuntime.session.email;
    } else {
      sessionUserLabel.textContent = "Sviluppo locale";
    }
  }

  if (authLogoutButton) {
    authLogoutButton.hidden = !requiresAuthenticatedUser || !isAuthenticated;
  }
}

async function fetchAuthSessionState() {
  const endpoint = buildAuthApiPath("/api/auth/session");
  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await readAuthJsonResponse(response, endpoint);

  if (!response.ok) {
    throw new Error(payload.error || `Verifica sessione fallita (${response.status}).`);
  }

  return payload;
}

function clearFrontendLocalCache() {
  localStorage.removeItem(window.NutriTrackBootstrap?.NUTRITRACK_LOCAL_STATE_CACHE_KEY || "nutriTrackPrototypeState");
}

async function submitAuthForm() {
  if (!authForm) {
    return;
  }

  markAuthFormValidationAttempt(authForm);

  if (!authForm.checkValidity()) {
    setAuthFeedback(getAuthMode() === "register" ? "Controlla nome, cognome, email e password prima di procedere." : "Controlla email e password prima di procedere.");
    return;
  }

  const mode = getAuthMode();

  if (mode === "password-reset-confirm" && authForm.elements.password.value !== authForm.elements.passwordConfirmation.value) {
    setAuthFeedback("Le password inserite non corrispondono.");
    return;
  }

  const payload = {
    email: authForm.elements.email?.value.trim() || "",
    password: authForm.elements.password?.value || "",
  };

  if (mode === "register") {
    payload.firstName = authForm.elements.firstName.value.trim();
    payload.lastName = authForm.elements.lastName.value.trim();
  }

  if (mode === "password-reset-confirm") {
    payload.token = passwordResetToken;
    payload.passwordConfirmation = authForm.elements.passwordConfirmation.value;
  }

  authSubmitButton.disabled = true;
  setAuthFeedback(
    mode === "register"
      ? "Creazione account in corso..."
      : mode === "password-reset-request"
      ? "Invio link in corso..."
      : mode === "password-reset-confirm"
      ? "Aggiornamento password in corso..."
      : "Accesso in corso...",
    "success"
  );

  try {
    const endpoint = buildAuthApiPath(
      mode === "register"
        ? "/api/auth/register"
        : mode === "password-reset-request"
        ? "/api/auth/password-reset/request"
        : mode === "password-reset-confirm"
        ? "/api/auth/password-reset/confirm"
        : "/api/auth/login"
    );
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await readAuthJsonResponse(response, endpoint);

    if (!response.ok) {
      throw new Error(result.error || `Autenticazione fallita (${response.status}).`);
    }

    if (mode === "password-reset-request") {
      setAuthFeedback(result.message || "Link inviato alla mail.", "success");
      return;
    }

    if (mode === "password-reset-confirm") {
      window.history.replaceState({}, document.title, window.location.pathname);
      authForm.reset();
      updateAuthMode("login");
      setAuthFeedback(result.message || "Password aggiornata. Effettua l'accesso con la nuova password.", "success");
      return;
    }

    clearFrontendLocalCache();
    setAuthFeedback(mode === "register" ? "Account creato. Reindirizzamento..." : "Accesso riuscito. Reindirizzamento...", "success");
    window.location.reload();
  } catch (error) {
    setAuthFeedback(error.message || "Impossibile completare l'autenticazione.");
  } finally {
    authSubmitButton.disabled = false;
  }
}

async function handleLogout() {
  if (authLogoutButton) {
    authLogoutButton.disabled = true;
  }

  try {
    await fetch(buildAuthApiPath("/api/auth/logout"), {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });
  } finally {
    clearFrontendLocalCache();
    window.location.reload();
  }
}

function setupAuthenticationUi() {
  if (nutritrackAuthRuntime.uiInitialized) {
    return;
  }

  nutritrackAuthRuntime.uiInitialized = true;

  authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateAuthMode(button.dataset.authModeToggle);
    });
  });

  if (authForm) {
    bindAuthFormValidationFeedback(authForm);
    authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitAuthForm();
    });
  }

  if (authLogoutButton) {
    authLogoutButton.addEventListener("click", () => {
      handleLogout();
    });
  }

  if (authForgotPasswordButton) {
    authForgotPasswordButton.addEventListener("click", () => {
      updateAuthMode("password-reset-request");
    });
  }

  if (authBackLoginButton) {
    authBackLoginButton.addEventListener("click", () => {
      window.history.replaceState({}, document.title, window.location.pathname);
      authForm.reset();
      updateAuthMode("login");
    });
  }

  updateAuthMode(passwordResetToken ? "password-reset-confirm" : "login");
}

async function bootstrapAuthenticationGate() {
  setupAuthenticationUi();

  try {
    const payload = await fetchAuthSessionState();
    nutritrackAuthRuntime.runtime = payload.runtime || nutritrackAuthRuntime.runtime;
    nutritrackAuthRuntime.session = payload.authenticated ? payload.user : null;
    applyAuthenticationUi();

    if (nutritrackAuthRuntime.runtime.identityMode === "authenticated_user" && !nutritrackAuthRuntime.session) {
      setAuthFeedback("Accedi o registrati per aprire il tuo profilo NutriTrack.");
      return false;
    }

    return true;
  } catch (error) {
    nutritrackAuthRuntime.runtime = {
      identityMode: "authenticated_user",
      developmentSeedEnabled: false,
      usesImplicitLocalUser: false,
      requiresAuthenticatedUser: true,
      summary: "authenticated_user",
    };
    nutritrackAuthRuntime.session = null;
    applyAuthenticationUi();
    setAuthFeedback(error.message || "Impossibile verificare la sessione.");
    return false;
  }
}

function handleNutriTrackUnauthorized() {
  nutritrackAuthRuntime.session = null;
  applyAuthenticationUi();
  setAuthFeedback("La sessione è scaduta. Effettua di nuovo l'accesso.");
}

window.bootstrapAuthenticationGate = bootstrapAuthenticationGate;
window.handleNutriTrackUnauthorized = handleNutriTrackUnauthorized;
