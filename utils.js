// utils.js

function waitForElement(selector, interval = 1000, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (timeout > 0 && Date.now() - startTime > timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }
    }, interval);
  });
}

function waitForButtonWithText(text, interval = 1000, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b =>
        b.textContent.trim().toLowerCase().includes(text.toLowerCase())
      );
      if (btn) {
        clearInterval(timer);
        resolve(btn);
      } else if (timeout > 0 && Date.now() - startTime > timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for button with text: ${text}`));
      }
    }, interval);
  });
}

function waitForCreditModule(interval = 1000, timeout = 0) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const credit = Array.from(document.querySelectorAll("div[class*='border-system-white36']")).find(div =>
        div.querySelector("span.bg-clip-text") || div.innerHTML.includes("Upgrade") || div.innerHTML.includes("Free")
      );
      if (credit) {
        clearInterval(timer);
        resolve(credit);
      } else if (timeout > 0 && Date.now() - startTime > timeout) {
        clearInterval(timer);
        reject(new Error("Timeout waiting for credit module"));
      }
    }, interval);
  });
}

function injectStyleOverrides() {
  if (!document.getElementById("vidu-ai-customizer-style")) {
    const styleTag = document.createElement("style");
    styleTag.id = "vidu-ai-customizer-style";
    styleTag.textContent = `
      div.absolute.bottom-0.left-0.mt-4.flex.w-full.justify-center.px-10 {
          position: absolute !important;
          bottom: 0 !important;
          left: 0 !important;
          width: 100% !important;
          margin-top: 0 !important;
          z-index: 1000 !important;
          background: linear-gradient(180deg, rgba(2,11,19,0) 0%, #020B13 76.04%) !important;
      }
      #auto-create-checkbox input[type="checkbox"] {
          width: 28px;
          height: 28px;
          border: 2px solid #1AC3FF;
          border-radius: 6px;
          appearance: none;
          outline: none;
          margin: 0;
          box-sizing: border-box;
          transition: background 0.3s, transform 0.3s;
          background: transparent;
      }
      #auto-create-checkbox input[type="checkbox"]:checked {
          background: #1AC3FF;
      }
      #auto-create-checkbox label {
          margin-left: 4px;
          cursor: pointer;
          color: #1AC3FF;
          font-medium: bold;
          font-size: 14px;
      }
      #recent-prompts-suggestions {
          background: #151D25;
          border: 1px solid #1AC3FF;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          position: absolute;
          z-index: 99999;
          display: none;
          max-height: 150px;
          overflow-y: auto;
          font-size: 14px;
          color: #FFFFFF;
      }
      #recent-prompts-suggestions div {
          padding: 8px 12px;
          cursor: pointer;
      }
      #recent-prompts-suggestions div:hover {
          background: rgba(26,195,255,0.2);
      }
      .upload-wrapper.dragover {
        border: 2px dashed #1AC3FF;
        background: rgba(26,195,255,0.1);
      }
      .continue-video-btn {
        background: linear-gradient(90deg, #5D99FF 0%, #2A6BCD 100%);
        color: white;
        padding: 5px 10px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        margin-left: 10px;
        font-size: 14px;
        transition: background 0.3s ease;
      }
      .continue-video-btn:hover:not(:disabled) {
        background: linear-gradient(90deg, #6AAFFF 0%, #3A7BDE 100%);
      }
      .continue-video-btn:disabled {
        background: #666666;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(styleTag);
  }
}