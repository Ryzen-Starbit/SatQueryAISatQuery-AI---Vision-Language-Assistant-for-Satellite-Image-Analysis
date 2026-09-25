import "./firebase.js";

/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Login page behaviour. Uses Firebase Authentication for real sign-in and
 * retains the demo shortcut for local demonstrations.
 * ---------------------------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, skip straight to the dashboard.
  if (SatQuerySession.get()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const formError = document.getElementById("form-error");
  const loginBtn = document.getElementById("login-btn");
  const loginBtnText = document.getElementById("login-btn-text");
  const demoBtn = document.getElementById("demo-login-btn");
  const googleBtn = document.getElementById("google-login-btn");

  function showFirebaseUnavailable() {
    formError.textContent =
      window.location.protocol === "file:"
        ? "Firebase requires an HTTP server. Run `npm run dev` in the project folder, then open the URL shown by Vite."
        : "Firebase could not load. Check the browser console and refresh the page.";
    formError.classList.add("show");
  }

  function clearErrors() {
    [emailError, passwordError, formError].forEach((el) => el.classList.remove("show"));
    [emailInput, passwordInput].forEach((el) => el.classList.remove("is-invalid"));
  }

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    demoBtn.disabled = isLoading;
    googleBtn.disabled = isLoading;
    loginBtnText.textContent = isLoading ? "Signing in…" : "Sign in";
  }

  async function completeLogin(promise) {
    setLoading(true);
    try {
      const { user, token } = await promise;
      SatQuerySession.set({ user, token, loginAt: Date.now() });
      window.location.href = "dashboard.html";
    } catch (err) {
      formError.textContent = err.message || "Sign in failed. Please try again.";
      formError.classList.add("show");
      setLoading(false);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors();

    let valid = true;
    if (!emailInput.value.trim()) {
      emailError.classList.add("show");
      emailInput.classList.add("is-invalid");
      valid = false;
    }
    if (!passwordInput.value.trim()) {
      passwordError.classList.add("show");
      passwordInput.classList.add("is-invalid");
      valid = false;
    }
    if (!valid) return;

    if (!window.SatQueryFirebase) {
      showFirebaseUnavailable();
      return;
    }

    completeLogin(
      window.SatQueryFirebase.signIn(emailInput.value.trim(), passwordInput.value)
    );
  });

  demoBtn.addEventListener("click", () => {
    clearErrors();
    completeLogin(SatQueryAPI.loginDemoUser());
  });

  googleBtn.addEventListener("click", () => {
    clearErrors();
    if (!window.SatQueryFirebase) {
      showFirebaseUnavailable();
      return;
    }
    completeLogin(window.SatQueryFirebase.signInWithGoogle());
  });
});
