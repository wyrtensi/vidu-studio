(function() {
  console.log("Injected Vidu AI Customizer script running (v1.0).");

  // Inject global styles
  injectStyleOverrides();

  // Observe for dialog additions
  observeForDialog();

  // Periodically check for captcha and overlays
  setInterval(() => {
    handleCaptchaPopup();
    hideUnnecessaryOverlay();
    handleOutOfCreditsButton(); // Check button state periodically
  }, 500);

  // Run customizations
  runCustomizations();

  // Reapply customizations on SPA navigation
  window.addEventListener("popstate", () => {
    console.log("Diagnostic: Popstate event detected. Reapplying customizations.");
    runCustomizations();
  });

  console.log("Diagnostic: Injected script via background successfully.");
})();

function runCustomizations() {
  Promise.all([
    waitForElement("textarea[maxlength='1500']", 500, 15000),
    waitForElement("div.absolute.bottom-0.left-0.mt-4.flex.w-full.justify-center.px-10", 500, 15000),
    waitForElement('div[role="radiogroup"] button[role="radio"]', 500, 15000) // Wait for aspect ratio buttons
  ])
    .then(([textarea, createContainer, aspectRatioButton]) => {
      initRecentPrompts();
      createAutoCheckbox();
      observeCreateButton();
      handleOutOfCreditsButton(); // Handle out-of-credits behavior

      // Improved Aspect Ratio Handling
      const aspectRatioButtons = document.querySelectorAll('div[role="radiogroup"] button[role="radio"]');
      const savedAspectRatio = localStorage.getItem("aspectRatio") || "9:16"; // Default to 9:16

      // Function to select aspect ratio
      const selectAspectRatio = (value) => {
        const button = Array.from(aspectRatioButtons).find(btn => btn.value === value);
        if (button) {
          button.click(); // Simulate click to select
          console.log(`Diagnostic: Selected aspect ratio: ${value}`);
        } else {
          console.warn(`Diagnostic: No button found for aspect ratio: ${value}`);
        }
      };

      // Apply saved or default aspect ratio
      selectAspectRatio(savedAspectRatio);

      // Save user selection when changed
      aspectRatioButtons.forEach(button => {
        button.addEventListener("click", function() {
          const selectedValue = this.value;
          localStorage.setItem("aspectRatio", selectedValue);
          console.log("Diagnostic: Aspect ratio saved:", selectedValue);
        });
      });

      // Custom Header and Credits Module
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
          console.log("Diagnostic: Custom header text inserted.");
        }

        // Wait for the credits module and delay moving it
        waitForCreditModule(500, 30000)
          .then(creditModule => {
            setTimeout(() => {
              const parent = creditModule.parentElement;
              if (parent && parent.contains(creditModule)) {
                parent.removeChild(creditModule); // Remove from original location
              }
              creditModule.style.marginLeft = "8px"; // Add spacing
              customDiv.insertAdjacentElement("afterend", creditModule); // Insert next to custom header
              console.log("Diagnostic: Credit module moved next to custom header text after delay.");
            }, 1500); // Delay moving by 1.5 seconds
          })
          .catch(e => console.warn("Diagnostic: Credit module not found within timeout:", e.message));
      }

      hideCreditPopupDialog();

      // Clean History Button for character2video
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
            console.log("Diagnostic: Recent prompts history cleared.");
            const suggestionsContainer = document.getElementById("recent-prompts-suggestions");
            if (suggestionsContainer) {
              suggestionsContainer.innerHTML = "";
              suggestionsContainer.style.display = "none";
              console.log("Diagnostic: Suggestions container cleared and hidden.");
            }
            if (typeof updateSuggestions === "function") {
              setTimeout(updateSuggestions, 100);
              console.log("Diagnostic: Suggestions update scheduled after cleaning history.");
            }
          });
          buttonsContainer.appendChild(separator);
          buttonsContainer.appendChild(cleanHistoryButton);
          console.log("Diagnostic: Clean History button added on character2video tab.");
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
      console.log("Diagnostic: Hidden unnecessary overlay.");
    }
  }
}