console.log("continuevideo.js loaded");

// Convert dataURL to Blob
function dataURLtoBlob(dataURL) {
  const byteString = atob(dataURL.split(",")[1]);
  const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
  const arrayBuffer = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    arrayBuffer[i] = byteString.charCodeAt(i);
  }
  return new Blob([arrayBuffer], { type: mimeString });
}

// Find the upload wrapper element with a timeout
async function findUploadWrapper(timeoutMs = 10000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const wrapper = document.querySelector(
        ".relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3"
      );
      if (wrapper) {
        console.log("Upload wrapper found:", wrapper);
        resolve(wrapper);
      } else if (Date.now() - startTime >= timeoutMs) {
        console.error("Upload wrapper not found after", timeoutMs, "ms");
        reject(new Error("Upload wrapper not found within timeout."));
      } else {
        console.log("Upload wrapper not yet found, retrying...");
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// Check if a slot is occupied
function isSlotOccupied(slot) {
  const input = slot.querySelector('input[type="file"]');
  const img = slot.querySelector('img');
  const occupied = (input && input.files && input.files.length > 0) || !!img;
  console.log("Slot occupancy check:", slot, "Occupied:", occupied);
  return occupied;
}

// Get label text for debugging
function getSlotLabel(slot) {
  const labelElement = slot.querySelector(".text-center");
  return labelElement ? labelElement.textContent.trim() : "No label found";
}

// Upload file to a specific slot
async function uploadFileToSlot(slot, file) {
  try {
    const input = slot.querySelector('input[type="file"]');
    if (!input) {
      throw new Error("File input not found in upload slot.");
    }
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("File uploaded successfully to slot:", file.name);
  } catch (error) {
    console.error("Upload error:", error.message);
    throw error;
  }
}

// SVG for the capture frame button
const captureFrameSVG = `
<svg width="1em" height="1em" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor">
  <path d="m16.5 5.5v-3.00587878c0-1.10227102-.8918463-1.99674657-1.9941126-1.99999134l-3.0058874-.00884851m5 11.01471863v3c0 1.1045695-.8954305 2-2 2h-3m-6-16.01471863-3.00588742.00884851c-1.10226624.00324477-1.99411258.89772032-1.99411258 1.99999134v3.00587878m5 11h-3c-1.1045695 0-2-.8954305-2-2v-3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"></path>
</svg>
`;

// Capture video frames and handle continuation
async function handleContinueVideo(videoElement, dialog = null) {
  try {
    if (!videoElement.src || isNaN(videoElement.duration)) {
      throw new Error("Invalid video source or duration not available.");
    }

    const tempVideo = document.createElement("video");
    tempVideo.crossOrigin = "anonymous";
    tempVideo.src = videoElement.src;
    tempVideo.muted = true;
    document.body.appendChild(tempVideo);

    await new Promise((resolve, reject) => {
      tempVideo.onloadedmetadata = () => resolve();
      tempVideo.onerror = () =>
        reject(new Error("Failed to load video metadata"));
      tempVideo.onloadeddata = () => tempVideo.play().catch(() => resolve());
    });

    const canvas = document.createElement("canvas");
    canvas.width = tempVideo.videoWidth || 640;
    canvas.height = tempVideo.videoHeight || 360;
    const ctx = canvas.getContext("2d");

    // Capture last frame
    tempVideo.currentTime = Math.max(tempVideo.duration - 0.1, 0);
    await new Promise((resolve) => (tempVideo.onseeked = resolve));
    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
    const lastFrameBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    const lastFrameDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(lastFrameBlob);
    });

    // Capture first frame
    tempVideo.currentTime = 0;
    await new Promise((resolve) => (tempVideo.onseeked = resolve));
    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
    const firstFrameBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    const firstFrameDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(firstFrameBlob);
    });

    tempVideo.remove();

    if (location.pathname.includes("/create/img2video")) {
      const uploadWrapper = await findUploadWrapper();
      const allSlots = uploadWrapper.querySelectorAll(
        ".flex.flex-col.items-center"
      );
      if (allSlots.length < 2) {
        console.error("Insufficient slots found:", allSlots);
        throw new Error("Failed to identify enough upload slots.");
      }

      allSlots.forEach((slot, index) => {
        const input = slot.querySelector('input[type="file"]');
        const label = getSlotLabel(slot);
        console.log(
          `Slot ${index}: Label="${label}", Input=${!!input}, Occupied=${isSlotOccupied(slot)}`
        );
      });

      const firstSlot = allSlots[0];
      const secondSlot = allSlots[1];

      if (!firstSlot || !secondSlot) {
        console.error("Slots not properly assigned:", { firstSlot, secondSlot });
        throw new Error("Failed to identify upload slots.");
      }

      const firstSlotInitiallyOccupied = isSlotOccupied(firstSlot);
      const secondSlotInitiallyOccupied = isSlotOccupied(secondSlot);

      if (!firstSlotInitiallyOccupied) {
        const lastFrameFile = new File([lastFrameBlob], "last_frame.jpg", {
          type: "image/jpeg",
        });
        await uploadFileToSlot(firstSlot, lastFrameFile);

        if (!secondSlotInitiallyOccupied) {
          const firstFrameFile = new File([firstFrameBlob], "first_frame.jpg", {
            type: "image/jpeg",
          });
          await uploadFileToSlot(secondSlot, firstFrameFile);
        }
      } else if (!secondSlotInitiallyOccupied) {
        const firstFrameFile = new File([firstFrameBlob], "first_frame.jpg", {
          type: "image/jpeg",
        });
        await uploadFileToSlot(secondSlot, firstFrameFile);
      }
    } else {
      localStorage.setItem("continueVideoLastFrame", lastFrameDataUrl);
      localStorage.setItem("continueVideoFirstFrame", firstFrameDataUrl);
      sessionStorage.setItem("continueVideoTriggered", "true");
      window.location.href = "/create/img2video";
    }
  } catch (error) {
    console.error("Error capturing video frame:", error);
  } finally {
    if (dialog) {
      const closeButton = Array.from(dialog.querySelectorAll("button")).find(
        (button) => {
          const span = button.querySelector("span.sr-only");
          return span && span.textContent.trim() === "Close";
        }
      );
      if (closeButton) {
        console.log("Closing dialog");
        closeButton.click();
      } else {
        console.warn("Close button not found in dialog");
      }
    }
  }
}

// Capture current frame and handle upload
async function handleCaptureFrame(videoElement, dialog = null) {
  try {
    if (!videoElement.src || isNaN(videoElement.duration)) {
      throw new Error("Invalid video source or duration not available.");
    }

    const tempVideo = document.createElement("video");
    tempVideo.crossOrigin = "anonymous";
    tempVideo.src = videoElement.src;
    tempVideo.muted = true;
    document.body.appendChild(tempVideo);

    await new Promise((resolve, reject) => {
      tempVideo.onloadedmetadata = () => resolve();
      tempVideo.onerror = () => reject(new Error("Failed to load video metadata"));
      tempVideo.onloadeddata = () => tempVideo.play().catch(() => resolve());
    });

    const canvas = document.createElement("canvas");
    canvas.width = tempVideo.videoWidth || 640;
    canvas.height = tempVideo.videoHeight || 360;
    const ctx = canvas.getContext("2d");

    // Capture current frame
    tempVideo.currentTime = videoElement.currentTime;
    await new Promise((resolve) => (tempVideo.onseeked = resolve));
    ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
    const frameBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    const frameDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(frameBlob);
    });

    tempVideo.remove();

    if (location.pathname.includes("/create/img2video")) {
      const uploadWrapper = await findUploadWrapper();
      const allSlots = uploadWrapper.querySelectorAll(".flex.flex-col.items-center");
      const availableSlots = Array.from(allSlots).filter(slot => !isSlotOccupied(slot));
      if (availableSlots.length > 0) {
        const slot = availableSlots[0];
        const frameFile = new File([frameBlob], "current_frame.jpg", { type: "image/jpeg" });
        await uploadFileToSlot(slot, frameFile);
      } else {
        console.log("No available slots to upload the frame.");
      }
    } else {
      localStorage.setItem("captureFrame", frameDataUrl);
      sessionStorage.setItem("captureFrameTriggered", "true");
      window.location.href = "/create/img2video";
    }
  } catch (error) {
    console.error("Error capturing video frame:", error);
  } finally {
    if (dialog) {
      const closeButton = Array.from(dialog.querySelectorAll("button")).find(
        (button) => {
          const span = button.querySelector("span.sr-only");
          return span && span.textContent.trim() === "Close";
        }
      );
      if (closeButton) {
        console.log("Closing dialog");
        closeButton.click();
      } else {
        console.warn("Close button not found in dialog");
      }
    }
  }
}

/**
 * Add "Continue Video" and "Capture Frame" buttons to video popup dialog.
 */
function addPopupVideoButtons() {
  const dialogs = document.querySelectorAll('div[role="dialog"][data-state="open"]');
  dialogs.forEach((dialog) => {
    const video = dialog.querySelector("video");
    if (!video) return;

    const buttonContainer = dialog.querySelector(
      ".absolute.bottom-0.left-0.w-full.pr-4"
    );
    if (!buttonContainer) return;

    // Check if buttons already exist to avoid duplicates
    if (!buttonContainer.querySelector(".popup-continue-video")) {
      const continueButton = document.createElement("button");
      continueButton.className =
        "popup-continue-video inline-flex items-center justify-center whitespace-nowrap text-sm ring-offset-white transition-colors disabled:cursor-not-allowed bg-ShengshuButton hover:bg-ShengshuButtonHover text-black font-semibold h-9 rounded-8 px-3 w-full mb-2";
      continueButton.textContent = "Continue Video";
      continueButton.addEventListener("click", () => {
        const dialogElement = video.closest('div[role="dialog"]');
        console.log("Dialog found for Continue Video:", dialogElement);
        handleContinueVideo(video, dialogElement);
      });
      buttonContainer.insertBefore(continueButton, buttonContainer.firstChild);
    }

    if (!buttonContainer.querySelector(".popup-capture-frame")) {
      const captureButton = document.createElement("button");
      captureButton.className =
        "popup-capture-frame inline-flex items-center justify-center whitespace-nowrap text-sm ring-offset-white transition-colors disabled:cursor-not-allowed bg-ShengshuButton hover:bg-ShengshuButtonHover text-black font-semibold h-9 rounded-8 px-3 w-full mb-2";
      captureButton.textContent = "Continue Current Frame";
      captureButton.addEventListener("click", () => {
        const dialogElement = video.closest('div[role="dialog"]');
        console.log("Dialog found for Capture Frame:", dialogElement);
        handleCaptureFrame(video, dialogElement);
      });
      buttonContainer.insertBefore(captureButton, buttonContainer.firstChild);
    }
  });
}

/**
 * Add "Continue Video" buttons to video containers.
 */
function addContinueVideoButtons() {
  const containers = document.querySelectorAll("[data-index]");
  containers.forEach((container) => {
    const containerText = container.innerText;
    const isGenerating =
      containerText.includes("Creating") || containerText.includes("In Queue");

    const controlContainer = container.querySelector(
      ".mt-3.flex.items-center.justify-between"
    );
    if (!controlContainer) return;

    let controlButtonContainer = controlContainer.querySelector(
      ".flex.items-center.gap-2"
    );
    if (!controlButtonContainer) {
      controlButtonContainer = document.createElement("div");
      controlButtonContainer.className = "flex items-center gap-2";
      controlContainer.prepend(controlButtonContainer);
    }

    let continueButton = controlButtonContainer.querySelector(
      ".continue-video-custom"
    );
    if (!continueButton) {
      continueButton = document.createElement("button");
      continueButton.className =
        "continue-video-custom inline-flex items-center justify-center whitespace-nowrap text-sm ring-offset-white transition-colors disabled:cursor-not-allowed py-2 rounded-8 h-8 bg-system-bg02 px-3 font-normal enabled:hover:bg-system-hover01 disabled:text-system-white24";
      continueButton.textContent = "Continue video";
      controlButtonContainer.appendChild(continueButton);
    }

    if (isGenerating) {
      continueButton.disabled = true;
    } else {
      const video = container.querySelector("video");
      if (video && (video.src || video.currentSrc)) {
        continueButton.disabled = false;
        if (!continueButton.getAttribute("data-click-attached")) {
          continueButton.addEventListener("click", () =>
            handleContinueVideo(video)
          );
          continueButton.setAttribute("data-click-attached", "true");
        }
      } else {
        continueButton.disabled = true;
      }
    }
  });
}

/**
 * Add "Capture Frame" buttons to video containers.
 */
function addCaptureFrameButtons() {
  const containers = document.querySelectorAll("[data-index]");
  containers.forEach((container) => {
    const controlContainer = container.querySelector(
      ".mt-3.flex.items-center.justify-between"
    );
    if (!controlContainer) return;

    const svgButtonsContainer = controlContainer.querySelector(
      ".rounded-8.bg-system-bg02 > .flex.h-full.items-center"
    );
    if (!svgButtonsContainer) return;

    const targetButton = svgButtonsContainer.querySelector("button:first-child");
    if (!targetButton) return;

    let captureFrameButton = svgButtonsContainer.querySelector(
      ".capture-frame-custom"
    );
    if (!captureFrameButton) {
      captureFrameButton = document.createElement("button");
      captureFrameButton.className =
        "capture-frame-custom inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-white transition-colors disabled:cursor-not-allowed disabled:text-system-white24 rounded-8 p-1.5 text-inherit text-xl hover:bg-system-hover01";
      captureFrameButton.innerHTML = captureFrameSVG;
      targetButton.insertAdjacentElement("afterend", captureFrameButton);
    }

    const video = container.querySelector("video");
    if (video && (video.src || video.currentSrc)) {
      captureFrameButton.disabled = false;
      if (!captureFrameButton.getAttribute("data-click-attached")) {
        captureFrameButton.addEventListener("click", () =>
          handleCaptureFrame(video)
        );
        captureFrameButton.setAttribute("data-click-attached", "true");
      }
    } else {
      captureFrameButton.disabled = true;
    }
  });
}

// Upload stored frames on page load
async function uploadStoredFrames() {
  if (location.pathname.includes("/create/img2video")) {
    const continueTriggered =
      sessionStorage.getItem("continueVideoTriggered") === "true";
    const captureTriggered =
      sessionStorage.getItem("captureFrameTriggered") === "true";
    if (continueTriggered || captureTriggered) {
      try {
        const uploadWrapper = await findUploadWrapper();
        const allSlots = uploadWrapper.querySelectorAll(
          ".flex.flex-col.items-center"
        );

        if (continueTriggered) {
          const lastFrameDataUrl = localStorage.getItem("continueVideoLastFrame");
          const firstFrameDataUrl = localStorage.getItem("continueVideoFirstFrame");
          if (lastFrameDataUrl && allSlots.length > 0 && !isSlotOccupied(allSlots[0])) {
            const blob = dataURLtoBlob(lastFrameDataUrl);
            const file = new File([blob], "last_frame.jpg", { type: "image/jpeg" });
            await uploadFileToSlot(allSlots[0], file);
          }
          if (firstFrameDataUrl && allSlots.length > 1 && !isSlotOccupied(allSlots[1])) {
            const blob = dataURLtoBlob(firstFrameDataUrl);
            const file = new File([blob], "first_frame.jpg", { type: "image/jpeg" });
            await uploadFileToSlot(allSlots[1], file);
          }
          localStorage.removeItem("continueVideoLastFrame");
          localStorage.removeItem("continueVideoFirstFrame");
          sessionStorage.removeItem("continueVideoTriggered");
        }

        if (captureTriggered) {
          const captureFrameDataUrl = localStorage.getItem("captureFrame");
          if (captureFrameDataUrl) {
            const availableSlots = Array.from(allSlots).filter(
              (slot) => !isSlotOccupied(slot)
            );
            if (availableSlots.length > 0) {
              const slot = availableSlots[0];
              const blob = dataURLtoBlob(captureFrameDataUrl);
              const file = new File([blob], "current_frame.jpg", {
                type: "image/jpeg",
              });
              await uploadFileToSlot(slot, file);
            } else {
              console.log("No available slots for captured frame.");
            }
          }
          localStorage.removeItem("captureFrame");
          sessionStorage.removeItem("captureFrameTriggered");
        }
      } catch (error) {
        console.error("Error processing stored frames:", error);
      }
    }
  }
}

// Initialize buttons and observe DOM changes
function init() {
  addContinueVideoButtons();
  addCaptureFrameButtons();
  addPopupVideoButtons();

  const observer = new MutationObserver(() => {
    addContinueVideoButtons();
    addCaptureFrameButtons();
    addPopupVideoButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (location.pathname.includes("/create/img2video")) {
    setTimeout(() => {
      uploadStoredFrames();
    }, 3000);
  }
}

init();