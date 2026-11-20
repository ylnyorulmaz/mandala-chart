/*
 * Beta feedback and error reporting.
 *
 * - Any element with [data-feedback] opens a pre-filled GitHub issue form
 *   (data-feedback="bug" or "feedback").
 * - Uncaught errors show one small "Report it" notice per page; the report
 *   carries the error message, a few stack lines and the environment.
 *
 * Nothing is sent anywhere automatically, and map contents are never included.
 * Keep APP_VERSION in step with CACHE_NAME in sw.js.
 */
(function (global) {
  "use strict";

  var APP_VERSION = "mandala-v30";
  var REPO = "https://github.com/ylnyorulmaz/mandala-chart";
  var reported = false;

  function supportsWebGL2() {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch (e) {
      return false;
    }
  }

  function environment() {
    return [
      "- Page: " + location.pathname,
      "- Version: " + APP_VERSION,
      "- Browser: " + navigator.userAgent,
      "- Screen: " + screen.width + "×" + screen.height + " @" + (global.devicePixelRatio || 1) + "x, viewport " + global.innerWidth + "×" + global.innerHeight,
      "- WebGL2: " + (supportsWebGL2() ? "yes" : "no")
    ].join("\n");
  }

  /** Issue-form URL; GitHub pre-fills form fields from query parameters named by field id. */
  function issueUrl(kind, error) {
    var params = new URLSearchParams();
    params.set("template", kind === "feedback" ? "feedback.yml" : "bug.yml");
    params.set("environment", environment());
    if (error) {
      params.set("title", "Error: " + String(error.message || error).slice(0, 80));
      var stack = String(error.stack || "").split("\n").slice(0, 6).join("\n");
      params.set("error", (String(error.message || error) + (stack ? "\n\n" + stack : "")).slice(0, 1500));
    }
    return REPO + "/issues/new?" + params.toString();
  }

  function bindLinks() {
    var links = document.querySelectorAll("[data-feedback]");
    Array.prototype.forEach.call(links, function (link) {
      var refresh = function () {
        link.href = issueUrl(link.getAttribute("data-feedback") || "bug");
      };
      refresh();
      link.addEventListener("pointerdown", refresh);
      link.addEventListener("focus", refresh);
    });
  }

  function ignorable(message, source) {
    var text = String(message || "");
    if (!text || text === "Script error." || /ResizeObserver loop/.test(text)) return true;
    return /^(chrome|moz|safari)-extension:/.test(String(source || ""));
  }

  function injectStyles() {
    if (document.getElementById("mandalaReportStyles")) return;
    var style = document.createElement("style");
    style.id = "mandalaReportStyles";
    style.textContent =
      ".mandala-report{position:fixed;left:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:9999;" +
      "display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;" +
      "border-radius:14px;color:#fff;background:rgba(28,22,44,.94);box-shadow:0 12px 30px rgba(0,0,0,.3);" +
      "font:700 13px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif}" +
      ".mandala-report a{color:#ffd166;text-decoration:underline;text-underline-offset:3px}" +
      ".mandala-report button{width:28px;height:28px;border:0;border-radius:50%;color:#fff;" +
      "background:rgba(255,255,255,.12);font-size:16px;line-height:1;cursor:pointer}";
    document.head.appendChild(style);
  }

  function report(error) {
    if (reported || !document.body) return;
    reported = true;
    injectStyles();
    var box = document.createElement("div");
    box.className = "mandala-report";
    box.setAttribute("role", "alert");
    var text = document.createElement("span");
    text.textContent = "Something went wrong.";
    var link = document.createElement("a");
    link.href = issueUrl("bug", error);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Report it";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", function () { box.remove(); });
    box.append(text, link, close);
    document.body.appendChild(box);
  }

  global.addEventListener("error", function (event) {
    if (ignorable(event.message, event.filename)) return;
    report(event.error || new Error(event.message));
  });

  global.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    if (ignorable(reason && reason.message ? reason.message : reason, "")) return;
    report(reason instanceof Error ? reason : new Error(String(reason)));
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindLinks);
  else bindLinks();

  global.MandalaFeedback = { version: APP_VERSION, issueUrl: issueUrl, report: report };
})(window);
