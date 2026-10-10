import { useEffect } from "react";

// Tells browsers, keyboards and password managers to leave text fields alone:
// no saved-password strip, no autofill, no autocorrect/spellcheck suggestion bar.
const ATTRS: Record<string, string> = {
  autocomplete: "off",
  autocorrect: "off",
  spellcheck: "false",
  "data-lpignore": "true", // LastPass
  "data-1p-ignore": "true", // 1Password
  "data-bwignore": "true", // Bitwarden
  "data-form-type": "other", // Dashlane and others
};

const SKIP_TYPES = new Set(["file", "checkbox", "radio", "range", "hidden", "color"]);

function harden(el: HTMLInputElement) {
  if (SKIP_TYPES.has(el.type)) return;
  for (const [key, value] of Object.entries(ATTRS)) {
    if (el.getAttribute(key) !== value) el.setAttribute(key, value);
  }
  // Autofill guesses a field's purpose from its name, so don't give it one.
  if (el.hasAttribute("name")) el.removeAttribute("name");
}

function hardenWithin(root: ParentNode) {
  root.querySelectorAll("input").forEach(harden);
}

export function useNoAutofill() {
  useEffect(() => {
    hardenWithin(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node instanceof HTMLInputElement) harden(node);
          else hardenWithin(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
}