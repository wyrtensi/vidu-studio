// eventHandlers.js

// === Captcha Handling ===
function handleCaptchaPopup() {
  const captchaContainer = document.querySelector("#aws-captcha-container");
  if (captchaContainer && captchaContainer.offsetParent !== null) {
    const autoCheckbox = document.querySelector("#auto-create-checkbox input[type='checkbox']");
    if (autoCheckbox && autoCheckbox.checked) {
      autoCheckbox.checked = false;
      autoCheckbox.dispatchEvent(new Event("change"));
      console.log("Diagnostic: Captcha detected. Auto-click disabled.");
    }
  }
}

// === Observe for Dialog Additions ===
function observeForDialog() {
  const dialogObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          if (el.getAttribute("role") === "dialog") {
            if (el.textContent.includes("Credits Exhausted") || el.textContent.includes("Subscription Plans")) {
              el.style.display = 'none';
              console.log("Diagnostic: Hidden dialog:", el.textContent.includes("Credits Exhausted") ? "Credits Exhausted" : "Subscription Plans");
              hideUnnecessaryOverlay();
            }
          }
        }
      });
    });
  });
  dialogObserver.observe(document.body, { childList: true, subtree: true });
}

// === Hide Unnecessary Overlay ===
function hideUnnecessaryOverlay() {
  const overlay = document.querySelector('div[data-state="open"].fixed.inset-0');
  if (overlay && overlay.style.display !== 'none') {
    const visibleDialogs = Array.from(document.querySelectorAll('div[role="dialog"]'))
      .filter(dialog => dialog.offsetParent !== null && dialog.style.display !== 'none');
    if (visibleDialogs.length === 0) {
      overlay.style.display = 'none';
      console.log("Diagnostic: Hidden unnecessary overlay.");
    }
  }
}