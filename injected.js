// injected.js

(function() {
  console.log("Injected wyrtensi vidu studio script running.");

  // Wait for injectStyleOverrides to be defined
  function waitForDependencies(callback) {
    if (typeof injectStyleOverrides === 'function') {
      callback();
    } else {
      setTimeout(() => waitForDependencies(callback), 100);
    }
  }

  waitForDependencies(() => {
    injectStyleOverrides();
    observeForDialog();

    setInterval(() => {
      handleCaptchaPopup();
      hideUnnecessaryOverlay();
      handleOutOfCreditsButton();
    }, 1000);

    runCustomizations();

    window.addEventListener("popstate", () => {
      runCustomizations();
    });
  });

  function runCustomizations() {
    Promise.all([
      waitForElement("textarea[maxlength='1500']", 1000, 15000),
      waitForElement("div.absolute.bottom-0.left-0.mt-4.flex.w-full.justify-center.px-10", 1000, 15000),
      waitForElement('div[role="radiogroup"] button[role="radio"]', 1000, 15000)
    ])
      .then(([textarea, createContainer, aspectRatioButton]) => {
        initRecentPrompts();
        createAutoCheckbox();
        observeCreateButton();
        handleOutOfCreditsButton();

        const aspectRatioButtons = document.querySelectorAll('div[role="radiogroup"] button[role="radio"]');
        const savedAspectRatio = localStorage.getItem("aspectRatio") || "9:16";

        const selectAspectRatio = (value) => {
          const button = Array.from(aspectRatioButtons).find(btn => btn.value === value);
          if (button) button.click();
        };

        selectAspectRatio(savedAspectRatio);

        aspectRatioButtons.forEach(button => {
          button.addEventListener("click", function() {
            localStorage.setItem("aspectRatio", this.value);
          });
        });

        const viduButton = Array.from(document.querySelectorAll("button")).find(b =>
          b.textContent.trim().includes("Vidu 2.0")
        );
        if (viduButton) {
          let customDiv = document.getElementById("custom-wyrtensi");
          if (!customDiv) {
            customDiv = document.createElement("div");
            customDiv.id = "custom-wyrtensi";
            customDiv.textContent = "wyrtensi vidu studio";
            customDiv.className = "relative h-auto cursor-pointer bg-clip-text font-medium text-sm text-[#1AC3FF]";
            customDiv.setAttribute("data-status", "highlight");
            customDiv.style.marginLeft = "12px";
            viduButton.insertAdjacentElement("afterend", customDiv);
          }

          waitForCreditModule(1000, 30000)
            .then(creditModule => {
              setTimeout(() => {
                const parent = creditModule.parentElement;
                if (parent && parent.contains(creditModule)) {
                  parent.removeChild(creditModule);
                }
                creditModule.style.marginLeft = "8px";
                customDiv.insertAdjacentElement("afterend", creditModule);
              }, 1500);
            })
            .catch(e => console.warn("Diagnostic: Credit module not found within timeout:", e.message));
        }

        hideCreditPopupDialog();

        if (window.location.pathname.includes("/create/character2video")) {
          const buttonsContainer = document.querySelector(".flex.items-center.gap-3");
          if (buttonsContainer && !document.getElementById("clean-history-button")) {
            const separator = document.createElement("div");
            separator.className = "h-2.5 w-[1px] bg-[#D9D9D9] opacity-20";
            const cleanHistoryButton = document.createElement("button");
            cleanHistoryButton.id = "clean-history-button";
            cleanHistoryButton.className = "inline-flex items-center justify-center whitespace-nowrap ring-offset-white transition-colors disabled:cursor-not-allowed text-system-white disabled:text-system-white24 rounded-8 font-normal text-xs";
            cleanHistoryButton.textContent = "Clean History";
            cleanHistoryButton.addEventListener("click", function() {
              recentPrompts = [];
              localStorage.setItem("recentPrompts", JSON.stringify(recentPrompts));
              const suggestionsContainer = document.getElementById("recent-prompts-suggestions");
              if (suggestionsContainer) {
                suggestionsContainer.innerHTML = "";
                suggestionsContainer.style.display = "none";
              }
              if (typeof updateSuggestions === "function") {
                setTimeout(updateSuggestions, 100);
              }
            });
            buttonsContainer.appendChild(separator);
            buttonsContainer.appendChild(cleanHistoryButton);
          }
        }
      })
      .catch(e => console.error("Diagnostic: runCustomizations error:", e.message));
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
})();