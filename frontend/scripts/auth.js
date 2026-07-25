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
const authModeButtons = document.querySelectorAll("[data-auth-mode-toggle]");
const authLogoutButton = document.querySelector("[data-auth-logout]");
const sessionUserLabel = document.querySelector("[data-session-user-label]");
const authRegisterOnlyFields = document.querySelectorAll("[data-auth-register-only]");

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
  return authForm?.elements?.mode?.value === "register" ? "register" : "login";
}

function updateAuthMode(mode) {
  if (!authForm) {
    return;
  }

  authForm.elements.mode.value = mode;

  authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authModeToggle === mode);
  });

  authRegisterOnlyFields.forEach((field) => {
    field.hidden = mode !== "register";
  });

  if (authForm.elements.firstName) {
    authForm.elements.firstName.required = mode === "register";
  }

  if (authForm.elements.lastName) {
    authForm.elements.lastName.required = mode === "register";
  }

  if (authSubmitButton) {
    authSubmitButton.textContent = mode === "register" ? "Crea account" : "Accedi";
  }

  if (authHint) {
    authHint.textContent =
      mode === "register"
        ? "Crea un account per collegare i tuoi dati al tuo profilo personale."
        : "Inserisci le tue credenziali per entrare nell'app.";
  }

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
  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await response.json();

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
  const payload = {
    email: authForm.elements.email.value.trim(),
    password: authForm.elements.password.value,
  };

  if (mode === "register") {
    payload.firstName = authForm.elements.firstName.value.trim();
    payload.lastName = authForm.elements.lastName.value.trim();
  }

  authSubmitButton.disabled = true;
  setAuthFeedback(mode === "register" ? "Creazione account in corso..." : "Accesso in corso...", "success");

  try {
    const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Autenticazione fallita (${response.status}).`);
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
    await fetch("/api/auth/logout", {
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

  updateAuthMode("login");
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
