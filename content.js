console.log("Vidu AI Customizer content.js started.");
chrome.runtime.sendMessage({ action: "injectScript" }, (response) => {
  if (response && response.success) {
    console.log("Injected script via background successfully.");
  } else {
    console.error("Injection failed: ", response ? response.error : "unknown error");
  }
});