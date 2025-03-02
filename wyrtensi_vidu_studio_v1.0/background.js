chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "injectScript") {
    if (sender.tab && sender.tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ["injected.js"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Script injection failed: " + chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("Injected script (injected.js) successfully.");
          sendResponse({ success: true });
        }
      });
      return true; // Indicates asynchronous response.
    } else {
      sendResponse({ success: false, error: "No tab id available." });
    }
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.url.includes("/create/character2video") || details.url.includes("/create/img2video")) {
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["injected.js"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Script injection on history state update failed: " + chrome.runtime.lastError.message);
      } else {
        console.log("Injected script via history state update successfully.");
      }
    });
  }
});