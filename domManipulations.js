// domManipulations.js

// === Element Helpers ===
function findCreateContainer() {
  return document.querySelector("div.absolute.bottom-0.left-0.mt-4.flex.w-full.justify-center.px-10");
}

function findCreateButton() {
  const container = findCreateContainer();
  return container ? container.querySelector("button") : null;
}

// === Auto Checkbox Creation ===
let autoClickInterval = null;
function createAutoCheckbox() {
  waitForElement("div.absolute.bottom-0.left-0.mt-4.flex.w-full.justify-center.px-10", 500, 0)
    .then(container => {
      if (!container.querySelector("#auto-create-checkbox")) {
        const button = container.querySelector("button");
        if (button) {
          const checkbox = document.createElement("div");
          checkbox.id = "auto-create-checkbox";
          checkbox.style.display = "flex";
          checkbox.style.alignItems = "center";
          checkbox.style.marginLeft = "10px";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.style.cursor = "pointer";
          input.addEventListener("change", function() {
            if (input.checked) {
              autoClickInterval = setInterval(() => {
                const btn = findCreateButton();
                if (btn && !btn.disabled) btn.click();
              }, 500);
            } else {
              if (autoClickInterval) clearInterval(autoClickInterval);
            }
          });
          const label = document.createElement("label");
          label.textContent = "Auto";
          label.style.cursor = "pointer";
          label.addEventListener("click", () => {
            input.checked = !input.checked;
            input.dispatchEvent(new Event("change"));
          });
          checkbox.appendChild(input);
          checkbox.appendChild(label);
          button.insertAdjacentElement("afterend", checkbox);
          console.log("Diagnostic: Auto checkbox created.");
        }
      }
    })
    .catch(e => console.warn("Diagnostic: Create container not found:", e.message));
}

// === Observe Create Button Mutations ===
function observeCreateButton() {
  const container = findCreateContainer();
  if (!container) return;

  const observer = new MutationObserver(() => {
    const btn = findCreateButton();
    if (btn) {
      btn.style.width = "auto";
      btn.style.minWidth = "150px";
      container.style.position = "absolute";

      let checkbox = document.getElementById("auto-create-checkbox");
      if (!checkbox) {
        createAutoCheckbox();
      } else if (btn.nextSibling !== checkbox) {
        container.insertBefore(checkbox, btn.nextSibling);
      }

      console.log("Diagnostic: Button styles applied and checkbox positioned.");
    }
  });

  observer.observe(container, { childList: true, subtree: true, attributes: true });
}

// === Recent Prompts Feature ===
let recentPrompts = [];
let updateSuggestions;

function initRecentPrompts() {
  try {
    recentPrompts = JSON.parse(localStorage.getItem("recentPrompts")) || [];
    if (recentPrompts.length > 50) {
      recentPrompts = recentPrompts.slice(0, 50);
      localStorage.setItem("recentPrompts", JSON.stringify(recentPrompts));
    }
    console.log("Diagnostic: Loaded recentPrompts from localStorage:", recentPrompts);
  } catch (e) {
    console.error("Diagnostic: Error parsing recentPrompts from localStorage:", e);
    recentPrompts = [];
  }

  waitForElement("textarea[maxlength='1500']")
    .then(textarea => {
      let suggestionsContainer = document.getElementById("recent-prompts-suggestions");
      if (!suggestionsContainer) {
        suggestionsContainer = document.createElement("div");
        suggestionsContainer.id = "recent-prompts-suggestions";
        suggestionsContainer.style.position = "absolute";
        suggestionsContainer.style.zIndex = "99999";
        suggestionsContainer.style.display = "none";
        document.body.appendChild(suggestionsContainer);
        console.log("Diagnostic: Created suggestions container.");
      }

      updateSuggestions = function() {
        const query = textarea.value.trim().toLowerCase();
        suggestionsContainer.innerHTML = "";
        if (!query || recentPrompts.length === 0) {
          suggestionsContainer.style.display = "none";
          console.log("Diagnostic: Suggestions hidden (empty query or no prompts).");
          return;
        }
        const matches = recentPrompts.filter(prompt => prompt.toLowerCase().includes(query));
        if (matches.length > 0) {
          const rect = textarea.getBoundingClientRect();
          suggestionsContainer.style.top = (rect.bottom + window.scrollY) + "px";
          suggestionsContainer.style.left = (rect.left + window.scrollX) + "px";
          suggestionsContainer.style.width = rect.width + "px";

          matches.forEach(match => {
            const item = document.createElement("div");
            item.textContent = match;
            item.addEventListener("click", function() {
              textarea.value = match;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              suggestionsContainer.style.display = "none";
              textarea.focus();
            });
            suggestionsContainer.appendChild(item);
          });
          suggestionsContainer.style.display = "block";
          console.log("Diagnostic: Suggestions updated with matches:", matches);
        } else {
          suggestionsContainer.style.display = "none";
          console.log("Diagnostic: Suggestions hidden (no matches).");
        }
      };

      textarea.addEventListener("input", updateSuggestions);

      textarea.addEventListener("blur", function() {
        setTimeout(() => { suggestionsContainer.style.display = "none"; }, 200);
      });

      const createContainer = findCreateContainer();
      if (createContainer && !createContainer.dataset.listenerAttached) {
        createContainer.addEventListener("click", function(event) {
          const button = event.target.closest("button");
          if (button) {
            const buttonText = button.textContent.trim().toLowerCase();
            if (buttonText.startsWith("create")) {
              const promptText = textarea.value.trim();
              if (promptText && !recentPrompts.includes(promptText)) {
                recentPrompts.unshift(promptText);
                if (recentPrompts.length > 50) recentPrompts.pop();
                localStorage.setItem("recentPrompts", JSON.stringify(recentPrompts));
                console.log("Diagnostic: Prompt saved:", promptText);
                setTimeout(updateSuggestions, 100);
              }
            }
          }
        }, true);
        createContainer.dataset.listenerAttached = "true";
        console.log("Diagnostic: Attached click listener to create container.");
      }

      console.log("Diagnostic: Recent prompts feature initialized.");
    })
    .catch(e => console.warn("Diagnostic: Textarea for recent prompts not found:", e.message));
}

// === Hide Credit Popup Dialog ===
function hideCreditPopupDialog() {
  const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
  dialogs.forEach(dialog => {
    if (dialog.textContent.includes("Credits Exhausted") || dialog.textContent.includes("Subscription Plans")) {
      dialog.style.display = "none";
      console.log("Diagnostic: Hidden dialog:", dialog.textContent.includes("Credits Exhausted") ? "Credits Exhausted" : "Subscription Plans");
    }
  });
}

// === Handle Out of Credits Button ===
function handleOutOfCreditsButton() {
  const checkButtonState = () => {
    const createButton = findCreateButton();
    if (createButton) {
      const buttonText = createButton.textContent.trim().toLowerCase();
      if (buttonText.includes("out of credits")) {
        createButton.style.background = "linear-gradient(90deg, #A9A9A9, #FFC0CB)"; // Soft pink gradient
        createButton.style.cursor = "not-allowed";
        createButton.disabled = true; // Disable to prevent clicks
        console.log("Diagnostic: Create button styled as out of credits.");
      } else {
        createButton.style.background = ""; // Reset to default
        createButton.style.cursor = "pointer";
        createButton.disabled = false;
      }
    }
  };

  // Initial check
  checkButtonState();

  // Observe button text or attribute changes
  const container = findCreateContainer();
  if (container) {
    const observer = new MutationObserver(checkButtonState);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
  }
}