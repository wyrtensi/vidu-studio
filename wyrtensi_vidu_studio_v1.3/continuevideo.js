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

// Capture video frames and handle continuation
async function handleContinueVideo(videoElement) {
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

        if (!isSlotOccupied(secondSlot)) {
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
  }
}

/**
 * Update the placement of the "Continue video" button.
 * 
 * For each container ([data-index]):
 * - We check whether the container is in a "generating" state by looking for
 *   keywords like "Creating" or "In Queue" in its text.
 * - The button is always placed in the control area—specifically, inside the
 *   ".mt-3.flex.items-center.justify-between" container’s inner div (".flex.items-center.gap-2"),
 *   which is typically next to the "Recreate" button.
 * - If the container is generating, the button is disabled.
 * - Otherwise, if a video element with a valid source exists, the button is enabled
 *   and wired to trigger handleContinueVideo.
 */
function addContinueVideoButtons() {
  const containers = document.querySelectorAll("[data-index]");
  containers.forEach((container) => {
    // Determine if the container shows that the video is generating/in queue.
    const containerText = container.innerText;
    const isGenerating =
      containerText.includes("Creating") || containerText.includes("In Queue");

    // Find the control container where the "Recreate" button is placed.
    const controlContainer = container.querySelector(".mt-3.flex.items-center.justify-between");
    if (!controlContainer) return;

    // The target area is the inner div that holds buttons (typically with gap-2).
    let controlButtonContainer = controlContainer.querySelector(".flex.items-center.gap-2");
    if (!controlButtonContainer) {
      // If not found, create one.
      controlButtonContainer = document.createElement("div");
      controlButtonContainer.className = "flex items-center gap-2";
      controlContainer.prepend(controlButtonContainer);
    }

    // Check if a "Continue video" button already exists in this control area.
    let continueButton = controlButtonContainer.querySelector(".continue-video-custom");
    if (!continueButton) {
      continueButton = document.createElement("button");
      continueButton.className =
        "continue-video-custom inline-flex items-center justify-center whitespace-nowrap text-sm ring-offset-white transition-colors disabled:cursor-not-allowed py-2 rounded-8 h-8 bg-system-bg02 px-3 font-normal enabled:hover:bg-system-hover01 disabled:text-system-white24";
      continueButton.textContent = "Continue video";
      controlButtonContainer.appendChild(continueButton);
    }

    if (isGenerating) {
      // For generating/in‑queue state, disable the button.
      continueButton.disabled = true;
      // (Optionally, you may remove any click listeners if needed.)
    } else {
      // Not generating: check for a valid video element in the container.
      const video = container.querySelector("video");
      if (video && (video.src || video.currentSrc)) {
        continueButton.disabled = false;
        if (!continueButton.getAttribute("data-click-attached")) {
          continueButton.addEventListener("click", () => handleContinueVideo(video));
          continueButton.setAttribute("data-click-attached", "true");
        }
      } else {
        // No valid video found—disable the button.
        continueButton.disabled = true;
      }
    }
  });
}

// Upload stored frames on page load (only on /create/img2video)
async function uploadStoredFrames() {
  if (location.pathname.includes("/create/img2video")) {
    const lastFrameDataUrl = localStorage.getItem("continueVideoLastFrame");
    const firstFrameDataUrl = localStorage.getItem("continueVideoFirstFrame");
    if (lastFrameDataUrl || firstFrameDataUrl) {
      try {
        const uploadWrapper = await findUploadWrapper();
        const allSlots = uploadWrapper.querySelectorAll(".flex.flex-col.items-center");
        if (allSlots.length < 2) {
          console.error("Insufficient slots found for stored frames:", allSlots);
          return;
        }
        const firstSlot = allSlots[0];
        const secondSlot = allSlots[1];
        const firstSlotInitiallyOccupied = isSlotOccupied(firstSlot);
        const secondSlotInitiallyOccupied = isSlotOccupied(secondSlot);
        if (lastFrameDataUrl && !firstSlotInitiallyOccupied) {
          const lastFrameBlob = dataURLtoBlob(lastFrameDataUrl);
          const lastFrameFile = new File([lastFrameBlob], "last_frame.jpg", {
            type: "image/jpeg",
          });
          await uploadFileToSlot(firstSlot, lastFrameFile);
        }
        if (firstFrameDataUrl && !secondSlotInitiallyOccupied) {
          const firstFrameBlob = dataURLtoBlob(firstFrameDataUrl);
          const firstFrameFile = new File([firstFrameBlob], "first_frame.jpg", {
            type: "image/jpeg",
          });
          await uploadFileToSlot(secondSlot, firstFrameFile);
        }
        localStorage.removeItem("continueVideoLastFrame");
        localStorage.removeItem("continueVideoFirstFrame");
      } catch (error) {
        console.error("Error processing stored frames:", error);
      }
    }
  }
}

// Initialize buttons and observe DOM changes
addContinueVideoButtons();
const observer = new MutationObserver(addContinueVideoButtons);
observer.observe(document.body, { childList: true, subtree: true });

// On the /create/img2video page, wait 3 seconds before starting the upload if coming from "Continue video"
if (
  location.pathname.includes("/create/img2video") &&
  sessionStorage.getItem("continueVideoTriggered") === "true"
) {
  setTimeout(() => {
    uploadStoredFrames();
    sessionStorage.removeItem("continueVideoTriggered");
  }, 3000);
}
