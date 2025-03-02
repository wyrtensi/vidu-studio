// upload.js

// Prevent multiple script injections using a unique attribute
if (document.body.getAttribute('data-wyrtensi-vidu-studio-injected') === 'true') {
  // console.log("Script already injected, skipping execution."); // Removed for production
} else {
  console.log("Injected wyrtensi vidu studio script running");
  document.body.setAttribute('data-wyrtensi-vidu-studio-injected', 'true');

  // Global variables for single instance management
  let multiFileInput = null;
  let isSetupDone = false;
  let lastUrl = location.href;
  let isFileInputClicked = false;
  let setupTimeout = null;

  // Debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Create hidden file input
  if (!multiFileInput) {
    multiFileInput = document.createElement('input');
    multiFileInput.type = 'file';
    // Conditionally set accept attribute based on page
    if (location.pathname.includes('/create/img2video')) {
      multiFileInput.accept = 'image/jpeg,image/png,image/webp,video/mp4';
    } else {
      multiFileInput.accept = 'image/jpeg,image/png,image/webp';
    }
    multiFileInput.multiple = true;
    multiFileInput.style.display = 'none';
    multiFileInput.id = 'multi-file-upload';
    document.body.appendChild(multiFileInput);

    multiFileInput.addEventListener('click', (event) => {
      if (isFileInputClicked) {
        event.preventDefault();
        return;
      }
      isFileInputClicked = true;
      setTimeout(() => { isFileInputClicked = false; }, 500);
    });
  }

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const interval = 1000;
      const startTime = Date.now();
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for element: ${selector}`));
        } else {
          setTimeout(checkElement, interval);
        }
      };
      checkElement();
    });
  }

  async function waitForCondition(conditionFn, interval = 1000, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timer = setInterval(() => {
        if (conditionFn()) {
          clearInterval(timer);
          resolve();
        } else if (timeout > 0 && Date.now() - startTime > timeout) {
          clearInterval(timer);
          reject(new Error("Timeout waiting for condition"));
        }
      }, interval);
    });
  }

  async function findUploadWrapper() {
    try {
      const formContainer = await waitForElement('#form-container');
      let uploadContainer = Array.from(formContainer.querySelectorAll('div')).find(div => {
        const groups = div.querySelectorAll('.group');
        return groups.length === 2 || groups.length === 3; // Adjust for img2video (2 slots) or character2video (3 slots)
      });

      if (!uploadContainer) {
        uploadContainer = formContainer.querySelector('.relative.flex');
      }

      if (!uploadContainer) {
        throw new Error("Upload container not found in #form-container");
      }

      await waitForCondition(() => uploadContainer.querySelectorAll('.group').length > 0, 1000, 5000);
      const slots = uploadContainer.querySelectorAll('.group');
      if (slots.length < 2) {
        console.warn(`Expected at least 2 slots, found ${slots.length}.`);
        return null;
      }

      return uploadContainer;
    } catch (error) {
      console.error("Error finding upload wrapper:", error);
      return null;
    }
  }

  function enableAllSlots(uploadSlots) {
    uploadSlots.forEach(slot => {
      const input = slot.querySelector('input[type="file"]');
      if (input) input.removeAttribute('disabled');
      const label = slot.querySelector('label');
      if (label) {
        label.classList.remove('cursor-not-allowed', 'text-system-white24');
        label.classList.add('cursor-pointer', 'hover:bg-system-hover02', 'text-system-white48');
      }
      slot.classList.add('upload-slot');
    });
  }

  function isSlotOccupied(slot) {
    const input = slot.querySelector('input[type="file"]');
    const img = slot.querySelector('img');
    return (input && input.files && input.files.length > 0) || img;
  }

  function getAvailableSlots(uploadSlots) {
    return Array.from(uploadSlots).filter(slot => !isSlotOccupied(slot));
  }

  function resetSlot(slot) {
    const input = slot.querySelector('input[type="file"]');
    if (input) input.value = '';
    const img = slot.querySelector('img');
    if (img) img.remove();
    slot.classList.add('upload-slot');
    updateSlotStyles(slot);
  }

  function updateSlotStyles(slot) {
    if (isSlotOccupied(slot)) {
      slot.classList.add('occupied');
      slot.classList.remove('available');
    } else {
      slot.classList.add('available');
      slot.classList.remove('occupied');
    }
  }

  // Function to check if the slot is the specific "Upload the last frame image (optional)" slot
  function isLastFrameSlot(slot) {
    const labelDiv = slot.querySelector('.text-center');
    return labelDiv && labelDiv.textContent.includes('Upload the last frame image (optional)');
  }

  // Function to extract frame from video (first or last based on parameter)
  async function extractFrame(videoFile, isFirstFrame = false) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.onloadedmetadata = () => {
        video.currentTime = isFirstFrame ? 0 : Math.max(video.duration - 0.1, 0);
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(video.src); // Clean up
          resolve(blob);
        }, 'image/jpeg');
      };
      video.onerror = (err) => {
        URL.revokeObjectURL(video.src);
        reject(err);
      };
    });
  }

  async function handleFiles(files, uploadSlots, targetSlot = null) {
    const processedFiles = [];
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        try {
          const isFirstFrame = targetSlot && isLastFrameSlot(targetSlot);
          const frameBlob = await extractFrame(file, isFirstFrame);
          const frameName = isFirstFrame ? 'first_frame.jpg' : 'last_frame.jpg';
          const frameFile = new File([frameBlob], frameName, { type: 'image/jpeg' });
          processedFiles.push(frameFile);
        } catch (err) {
          console.error('Error extracting frame from video:', err);
        }
      } else {
        processedFiles.push(file);
      }
    }
    distributeFilesToSlots(processedFiles, uploadSlots, targetSlot);
  }

  function distributeFilesToSlots(files, uploadSlots, targetSlot = null) {
    const uniqueFiles = Array.from(files).filter((file, index, self) =>
      index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );

    if (uniqueFiles.length === 0) return;

    if (targetSlot) {
      resetSlot(targetSlot);
      const input = targetSlot.querySelector('input[type="file"]');
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(uniqueFiles[0]);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        updateSlotStyles(targetSlot);
      }
      const remainingFiles = uniqueFiles.slice(1);
      assignFilesToAvailableSlots(remainingFiles, uploadSlots);
    } else {
      assignFilesToAvailableSlots(uniqueFiles, uploadSlots);
    }
  }

  function assignFilesToAvailableSlots(files, uploadSlots) {
    const availableSlots = getAvailableSlots(uploadSlots);
    files.slice(0, availableSlots.length).forEach((file, index) => {
      const slot = availableSlots[index];
      if (slot) {
        const input = slot.querySelector('input[type="file"]');
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          updateSlotStyles(slot);
        }
      }
    });
  }

  function setupDragAndDrop(uploadWrapper, uploadSlots) {
    uploadWrapper.addEventListener('dragover', (event) => {
      event.preventDefault();
    });
    uploadWrapper.addEventListener('dragleave', () => {});
    uploadWrapper.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      handleFiles(files, uploadSlots);
    });

    uploadSlots.forEach(slot => {
      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
        slot.classList.add('dragover');
      });
      slot.addEventListener('dragleave', (event) => {
        slot.classList.remove('dragover');
      });
      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        slot.classList.remove('dragover');
        const files = event.dataTransfer.files;
        handleFiles(files, uploadSlots, slot);
      });
    });

    document.addEventListener('dragend', () => {
      document.querySelectorAll('.dragover').forEach(el => el.classList.remove('dragover'));
    });
  }

  function setupClickToUpload(uploadWrapper, uploadSlots) {
    uploadSlots.forEach((slot, index) => {
      if (!slot.dataset.listenerAttached) {
        slot.addEventListener('click', (event) => {
          if (!event.target.closest('.flex.cursor-pointer')) {
            event.preventDefault();
            event.stopPropagation();
            if (!isFileInputClicked) {
              multiFileInput.dataset.targetSlot = index;
              multiFileInput.click();
            }
          }
        });
        slot.dataset.listenerAttached = 'true';
      }
    });

    multiFileInput.addEventListener('change', () => {
      const files = multiFileInput.files;
      const targetSlotIndex = parseInt(multiFileInput.dataset.targetSlot, 10);
      const targetSlot = uploadSlots[targetSlotIndex];
      handleFiles(files, uploadSlots, targetSlot);
      setTimeout(() => {
        multiFileInput.value = '';
        delete multiFileInput.dataset.targetSlot;
      }, 100);
    });
  }

  function observeSlotChanges(uploadSlots) {
    uploadSlots.forEach(slot => {
      const debouncedUpdate = debounce(() => {
        if (!slot.classList.contains('upload-slot')) {
          slot.classList.add('upload-slot');
        }
        updateSlotStyles(slot);
        if (!isSlotOccupied(slot)) {
          resetSlot(slot);
        }
      }, 500);

      const observer = new MutationObserver(debouncedUpdate);
      observer.observe(slot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  }

  function repositionAndStyleButtons(uploadWrapper, uploadSlots) {
    if (uploadWrapper.querySelector('.upload-button-container')) return;
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'upload-button-container';
    uploadWrapper.insertBefore(buttonContainer, uploadWrapper.firstChild);

    uploadSlots.forEach((slot, index) => {
      const buttons = slot.querySelector('.absolute.top-1.right-1.flex.items-center.gap-1.sm\\:hidden');
      if (buttons && !buttons.classList.contains('repositioned')) {
        buttons.remove();
        const slotButtonWrapper = document.createElement('div');
        slotButtonWrapper.className = 'upload-slot-buttons';
        slotButtonWrapper.dataset.slotIndex = index;
        slotButtonWrapper.appendChild(buttons);
        buttonContainer.appendChild(slotButtonWrapper);
        buttons.classList.add('repositioned');
      }
    });
  }

  function setupButtonFunctionality(uploadSlots) {
    const buttons = document.querySelectorAll('.upload-button-container .flex.cursor-pointer');
    buttons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const slotIndex = parseInt(button.closest('.upload-slot-buttons').dataset.slotIndex, 10);
        const slot = uploadSlots[slotIndex];

        const svgPath = button.querySelector('svg path');
        if (svgPath) {
          const pathD = svgPath.getAttribute('d');
          if (pathD.includes('M4.5 5.5')) {
            resetSlot(slot);
            updateSlotStyles(slot);
          } else if (pathD.includes('M18.6057 23.4729')) {
            // Add cropping functionality here if needed
          }
        }
      });
    });
  }

  function injectUploadStyles() {
    if (!document.getElementById('upload-enhancement-styles')) {
      const style = document.createElement('style');
      style.id = 'upload-enhancement-styles';
      style.textContent = `
        .relative.flex.dragover { outline: none; background: none; }
        .upload-slot { opacity: 1 !important; transition: background 0.3s ease, outline 0.3s ease, box-shadow 0.3s ease; position: relative; border-radius: 8px; }
        .upload-slot label { cursor: pointer !important; color: #E0E0E0 !important; }
        .upload-slot:hover { background: rgba(74,144,226,0.15); }
        .upload-slot.dragover { outline: 2px solid #4A90E2; background: rgba(74,144,226,0.1); box-shadow: 0 4px 12px rgba(74,144,226,0.3); }
        .upload-slot.occupied { outline: 1px solid #4A90E2; background: linear-gradient(135deg, rgba(74,144,226,0.05), rgba(74,144,226,0.02)); }
        .upload-slot.available { outline: 1px solid #666666; background: transparent; }
        .upload-button-container { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; max-width: 100%; }
        .upload-slot-buttons { display: flex; gap: 5px; flex: 1; justify-content: center; }
        .upload-button-container .flex.cursor-pointer { padding: 5px; background-color: transparent; border-radius: 50%; z-index: 20; transition: background 0.2s ease, transform 0.2s ease; }
        .upload-button-container .flex.cursor-pointer:hover { background-color: rgba(255, 255, 255, 0.1); transform: scale(1.1); }
        .upload-slot svg rect[stroke-dasharray] { display: none; }
      `;
      document.head.appendChild(style);
    }
  }

  function isOnReferenceToVideoTab() {
    return location.pathname.includes('/create/character2video');
  }

  async function setupUploadFunctionality() {
    try {
      if (!isOnReferenceToVideoTab() && !location.pathname.includes('/create/img2video')) return;

      const uploadWrapper = await findUploadWrapper();
      if (!uploadWrapper) return;

      const uploadSlots = Array.from(uploadWrapper.querySelectorAll('.group'));
      if (uploadSlots.length < 2) return;

      enableAllSlots(uploadSlots);
      setupDragAndDrop(uploadWrapper, uploadSlots);
      setupClickToUpload(uploadWrapper, uploadSlots);
      repositionAndStyleButtons(uploadWrapper, uploadSlots);
      setupButtonFunctionality(uploadSlots);
      observeSlotChanges(uploadSlots);
      injectUploadStyles();

      uploadSlots.forEach(slot => updateSlotStyles(slot));
      isSetupDone = true;
    } catch (error) {
      console.error("Error in setupUploadFunctionality:", error);
    }
  }

  const debounceSetup = debounce(setupUploadFunctionality, 500);

  document.addEventListener('DOMContentLoaded', () => {
    if (isOnReferenceToVideoTab() || location.pathname.includes('/create/img2video')) debounceSetup();
  });

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      isSetupDone = false;
      if (isOnReferenceToVideoTab() || location.pathname.includes('/create/img2video')) debounceSetup();
    }
  }, 1000);

  const debouncedObserverCallback = debounce(() => {
    if ((isOnReferenceToVideoTab() || location.pathname.includes('/create/img2video')) && !isSetupDone) debounceSetup();
  }, 500);

  const formContainerObserver = new MutationObserver(debouncedObserverCallback);
  const formContainer = document.querySelector('#form-container');
  if (formContainer) {
    formContainerObserver.observe(formContainer, { childList: true, subtree: true });
  } else {
    waitForElement('#form-container').then(container => {
      formContainerObserver.observe(container, { childList: true, subtree: true });
    }).catch(err => console.error(err));
  }
}