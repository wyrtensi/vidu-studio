// eventHandlers.js

function handleCaptchaPopup() {
  const captchaContainer = document.querySelector("#aws-captcha-container");
  if (captchaContainer && captchaContainer.offsetParent !== null) {
    const autoCheckbox = document.querySelector("#auto-create-checkbox input[type='checkbox']");
    if (autoCheckbox && autoCheckbox.checked) {
      autoCheckbox.checked = false;
      autoCheckbox.dispatchEvent(new Event("change"));
    }
  }
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function observeForDialog() {
  const debouncedDialogObserverCallback = debounce((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          if (el.getAttribute("role") === "dialog") {
            if (el.textContent.includes("Credits Exhausted") || el.textContent.includes("Subscription Plans")) {
              el.style.display = 'none';
              hideUnnecessaryOverlay();
            }
          }
        }
      });
    });
  }, 500);

  const dialogObserver = new MutationObserver(debouncedDialogObserverCallback);
  dialogObserver.observe(document.body, { childList: true, subtree: true });
}

function hideUnnecessaryOverlay() {
  const overlay = document.querySelector('div[data-state="open"].fixed.inset-0');
  if (overlay && overlay.style.display !== 'none') {
    const visibleDialogs = Array.from(document.querySelectorAll('div[role="dialog"]'))
      .filter(dialog => dialog.offsetParent !== null && dialog.style.display !== 'none');
    if (visibleDialogs.length === 0) {
      overlay.style.display = 'none';
    }
  }
}