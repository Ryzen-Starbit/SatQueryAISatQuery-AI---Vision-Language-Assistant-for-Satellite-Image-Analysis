/**
 * app.js
 * ---------------------------------------------------------------------------
 * Shared behaviour used on every page inside the app shell (dashboard,
 * analysis, results): session/auth guard, sidebar user info, logout,
 * active-nav highlighting, and a small toast helper for error states.
 * ---------------------------------------------------------------------------
 */

const SatQuerySession = (function () {
  "use strict";

  const KEY = "sq_session";

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function set(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  /** Redirects to login if no session exists. Call at the top of every
   * protected page. Returns the session object if present. */
  function requireAuth() {
    const session = get();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
    return session;
  }

  return { get, set, clear, requireAuth };
})();

/** Small toast helper for non-blocking error / success messages. */
const SatQueryToast = (function () {
  "use strict";

  function region() {
    let el = document.querySelector(".toast-region");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast-region";
      document.body.appendChild(el);
    }
    return el;
  }

  function show(message, type = "error", timeout = 5000) {
    const el = document.createElement("div");
    el.className = `sq-toast ${type}`;
    el.setAttribute("role", "status");
    el.textContent = message;
    region().appendChild(el);
    setTimeout(() => el.remove(), timeout);
  }

  return { show };
})();

document.addEventListener("DOMContentLoaded", () => {
  // Populate sidebar user info + logout, on any page that has a sidebar.
  const session = SatQuerySession.get();
  const nameEl = document.querySelector("[data-user-name]");
  const avatarEl = document.querySelector("[data-user-avatar]");
  if (session && nameEl) {
    nameEl.textContent = session.user.name;
    if (avatarEl) {
      avatarEl.textContent = session.user.name.slice(0, 2).toUpperCase();
    }
  }

  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const logout = window.SatQueryFirebase?.signOut?.() || Promise.resolve();
      logout
        .catch(() => {
          SatQueryToast.show("Sign out failed. Please try again.", "error");
        })
        .finally(() => {
          SatQuerySession.clear();
          window.location.href = "login.html";
        });
    });
  }

  // Highlight the active sidebar nav link based on current filename.
  const current = window.location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll(".side-nav a[href]").forEach((link) => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
});
