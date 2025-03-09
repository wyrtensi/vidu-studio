// upload.js

// Prevent multiple script injections
if (document.body.getAttribute('data-wyrtensi-vidu-studio-injected') === 'true') {
  console.log("Script already injected, skipping execution.");
} else {
  console.log("Injected wyrtensi vidu studio script running");
  document.body.setAttribute('data-wyrtensi-vidu-studio-injected', 'true');

  // Global variables
  let multiFileInput = null;
  let isSetupDone = false;
  let lastUrl = location.href;
  let isFileInputClicked = false;
  let isProcessingFiles = false; // Flag to prevent concurrent processing
  let processedFileIds = new Set(); // Track processed files to prevent duplicates
  let uploadWrapper = null; // Global reference to the upload wrapper
  let setupPromise = null; // Promise for setup completion
  let currentTargetSlot = null; // Temporary storage for target slot in click-to-upload

  // Debounce utility
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
      console.log('multiFileInput clicked, accept value:', multiFileInput.accept);
      setTimeout(() => { isFileInputClicked = false; }, 500);
    });
  }

  // Utility to wait for an element
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

  // Utility to wait for a condition
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

  // Find the upload wrapper
  async function findUploadWrapper() {
    try {
      const formContainer = await waitForElement('#form-container');
      let uploadContainer = formContainer.querySelector('.relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3');
      
      if (uploadContainer && uploadContainer.querySelectorAll('.group').length >= 2) {
        await waitForCondition(() => uploadContainer.querySelectorAll('.group').length > 0, 1000, 5000);
        return uploadContainer;
      }

      uploadContainer = Array.from(formContainer.querySelectorAll('div')).find(div => div.querySelectorAll('.group').length >= 2);
      if (!uploadContainer) throw new Error("Upload container not found in #form-container");

      await waitForCondition(() => uploadContainer.querySelectorAll('.group').length > 0, 1000, 5000);
      return uploadContainer;
    } catch (error) {
      console.error("Error finding upload wrapper:", error);
      return null;
    }
  }

  // Get current upload slots
  function getCurrentUploadSlots() {
    if (!uploadWrapper) return [];
    return Array.from(uploadWrapper.querySelectorAll('.group'));
  }

  // Enable all slots with consistent visual styles
  function enableAllSlots(uploadSlots) {
    uploadSlots.forEach(slot => {
      const input = slot.querySelector('input[type="file"]');
      if (input) {
        input.removeAttribute('disabled');
        input.style.pointerEvents = 'auto';
      }
      const label = slot.querySelector('label');
      if (label) {
        label.classList.remove('cursor-not-allowed', 'text-system-white24');
        label.classList.add('cursor-pointer', 'text-system-white48');
        label.style.pointerEvents = 'auto';
      }
      const innerDiv = slot.querySelector('.inline-block');
      if (innerDiv) {
        innerDiv.classList.remove('cursor-not-allowed', 'text-system-white24');
        innerDiv.classList.add('cursor-pointer', 'hover:bg-system-hover02');
      }
      slot.classList.add('upload-slot');
      // Remove stop sign SVG elements
      const stopSign = slot.querySelector('svg rect[stroke-dasharray]');
      if (stopSign) stopSign.remove();
      // Remove all disabled indicators
      slot.classList.remove('disabled', 'cursor-not-allowed');
      slot.removeAttribute('disabled');
      slot.style.opacity = '1';
      slot.style.pointerEvents = 'auto';
      updateSlotStyles(slot);
    });
  }

  // Check if a slot is occupied
  function isSlotOccupied(slot) {
    const input = slot.querySelector('input[type="file"]');
    const img = slot.querySelector('img');
    const isUploading = slot.querySelector('.animate-spin') !== null;
    return (input && input.files && input.files.length > 0) || !!img || isUploading;
  }

  // Get available slots in order
  function getAvailableSlots(uploadSlots) {
    return uploadSlots.filter(slot => !isSlotOccupied(slot));
  }

  // Reset a slot
  function resetSlot(slot) {
    const input = slot.querySelector('input[type="file"]');
    if (input) input.value = '';
    const img = slot.querySelector('img');
    if (img) img.remove();
    slot.classList.add('upload-slot');
    updateSlotStyles(slot);
  }

  // Update slot styles
  function updateSlotStyles(slot) {
    if (isSlotOccupied(slot)) {
      slot.classList.add('occupied');
      slot.classList.remove('available');
    } else {
      slot.classList.add('available');
      slot.classList.remove('occupied');
    }
  }

  // Check if slot is for last frame
  function isLastFrameSlot(slot) {
    const labelDiv = slot.querySelector('.text-center');
    return labelDiv && labelDiv.textContent.includes('Upload the last frame image (optional)');
  }

  // Generate a unique ID for a file based on name, size, and content hash
  async function getFileId(file) {
    const text = `${file.name}-${file.size}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // Extract frame from video
  async function extractFrame(videoFile, isFirstFrame = true) {
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
          URL.revokeObjectURL(video.src);
          resolve(blob);
        }, 'image/jpeg');
      };
      video.onerror = (err) => {
        URL.revokeObjectURL(video.src);
        reject(err);
      };
    });
  }

  // Handle file processing with concurrency and duplication prevention
  async function handleFiles(files, targetSlot = null) {
    if (isProcessingFiles) {
      console.log('Processing already in progress, skipping.');
      return;
    }
    isProcessingFiles = true;
    processedFileIds.clear(); // Reset for each upload batch
    console.log(`Processing ${files.length} files`);

    try {
      if (!setupPromise) {
        setupPromise = setupUploadFunctionality();
      }
      await setupPromise;
      const uploadSlots = getCurrentUploadSlots();
      if (targetSlot && !uploadSlots.includes(targetSlot)) {
        targetSlot = null; // Invalidate if not in current slots
      }
      const processedFiles = [];
      const isCharacter2Video = location.pathname.includes('/create/character2video');

      for (const file of files) {
        const fileId = await getFileId(file);
        if (processedFileIds.has(fileId)) {
          console.log(`Duplicate file detected and skipped: ${file.name}`);
          continue;
        }
        processedFileIds.add(fileId);

        if (file.type.startsWith('video/')) {
          try {
            const isFirstFrame = isCharacter2Video || (targetSlot && !isLastFrameSlot(targetSlot));
            const frameBlob = await extractFrame(file, isFirstFrame);
            const frameName = isFirstFrame ? 'first_frame.jpg' : 'last_frame.jpg';
            const frameFile = new File([frameBlob], frameName, { type: 'image/jpeg' });
            const frameId = await getFileId(frameFile);
            if (!processedFileIds.has(frameId)) {
              processedFileIds.add(frameId);
              processedFiles.push(frameFile);
            } else {
              console.log(`Duplicate frame skipped: ${frameName}`);
            }
          } catch (err) {
            console.error('Error extracting frame from video:', err);
          }
        } else {
          processedFiles.push(file);
        }
      }
      distributeFilesToSlots(processedFiles, uploadSlots, targetSlot);
    } finally {
      isProcessingFiles = false;
    }
  }

  // Distribute files to slots with enhanced anti-duplication
  function distributeFilesToSlots(files, uploadSlots, targetSlot = null) {
    const availableSlots = getAvailableSlots(uploadSlots);
    console.log(`Distributing ${files.length} files to slots: ${availableSlots.map(slot => slot.id || slot.className).join(', ')}`);

    if (files.length === 0) return;

    if (targetSlot && availableSlots.includes(targetSlot) && files.length === 1) {
      // Specific slot targeting (e.g., click-to-upload)
      resetSlot(targetSlot);
      const input = targetSlot.querySelector('input[type="file"]');
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        updateSlotStyles(targetSlot);
      }
    } else {
      // General distribution to available slots
      for (const file of files) {
        if (availableSlots.length > 0) {
          const slot = availableSlots.shift(); // Take the first available slot
          resetSlot(slot);
          const input = slot.querySelector('input[type="file"]');
          if (input) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            updateSlotStyles(slot);
          }
        } else {
          console.log('No more available slots for additional files.');
          break;
        }
      }
    }
  }

  // Setup drag and drop
  function setupDragAndDrop(uploadWrapper) {
    uploadWrapper.addEventListener('dragover', (event) => event.preventDefault());
    uploadWrapper.addEventListener('drop', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      await handleFiles(files);
    });

    const uploadSlots = getCurrentUploadSlots();
    uploadSlots.forEach(slot => {
      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
        slot.classList.add('dragover');
      });
      slot.addEventListener('dragleave', (event) => slot.classList.remove('dragover'));
      slot.addEventListener('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        slot.classList.remove('dragover');
        const files = event.dataTransfer.files;
        await handleFiles(files, slot);
      });
    });

    document.addEventListener('dragend', () => {
      document.querySelectorAll('.dragover').forEach(el => el.classList.remove('dragover'));
    });
  }

  // Setup click to upload
  function setupClickToUpload(uploadWrapper) {
    uploadWrapper.addEventListener('click', (event) => {
      const slot = event.target.closest('.group');
      if (slot && !event.target.closest('.flex.cursor-pointer')) {
        event.preventDefault();
        event.stopPropagation();
        if (!isFileInputClicked) {
          currentTargetSlot = slot;
          multiFileInput.click();
        }
      }
    });

    multiFileInput.addEventListener('change', async () => {
      console.log('Files selected via click:', multiFileInput.files);
      const files = multiFileInput.files;
      await handleFiles(files, currentTargetSlot);
      currentTargetSlot = null;
      setTimeout(() => {
        multiFileInput.value = '';
      }, 100);
    });
  }

  // Setup paste functionality on the entire page
  function setupPasteFunctionality() {
    document.body.addEventListener('paste', async (event) => {
      event.preventDefault();
      const items = event.clipboardData.items;
      const files = [];
      
      for (const item of items) {
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob && (blob.type.startsWith('image/') || blob.type === 'video/mp4')) {
            files.push(blob);
          }
        } else if (item.type.startsWith('image/')) {
          const blob = await new Promise(resolve => {
            item.getAsString(str => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(resolve, 'image/png');
              };
              img.src = str;
            });
          });
          if (blob) {
            files.push(new File([blob], 'pasted-image.png', { type: 'image/png' }));
          }
        }
      }

      if (files.length > 0) {
        await handleFiles(files);
      }
    });
  }

  // Observe slot changes
  function observeSlotChanges(uploadSlots) {
    uploadSlots.forEach(slot => {
      const debouncedUpdate = debounce(() => {
        requestAnimationFrame(() => {
          if (!slot.classList.contains('upload-slot')) slot.classList.add('upload-slot');
          updateSlotStyles(slot);
          if (!isSlotOccupied(slot)) resetSlot(slot);
        });
      }, 500);

      const observer = new MutationObserver(debouncedUpdate);
      observer.observe(slot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  }

  // Setup button functionality (ensuring no button container is created)
  function setupButtonFunctionality(uploadSlots) {
    // Since we're not creating or managing any button containers,
    // this function can remain empty or handle slot-specific logic if needed.
    // For now, it’s a no-op to avoid any accidental button container creation.
    console.log('No button container setup performed as per request');
  }

  // Inject upload styles with enhanced specificity
  function injectUploadStyles() {
    if (!document.getElementById('upload-enhancement-styles')) {
      const style = document.createElement('style');
      style.id = 'upload-enhancement-styles';
      style.textContent = `
        /* Target parent class with higher specificity */
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot { 
          opacity: 1 !important; 
          transition: background 0.3s ease, outline 0.3s ease, box-shadow 0.3s ease; 
          position: relative; 
          border-radius: 8px; 
          pointer-events: auto !important; 
          cursor: pointer !important;
        }
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot label { 
          cursor: pointer !important; 
          color: #E0E0E0 !important; 
          pointer-events: auto !important; 
        }
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot:hover { 
          background: rgba(74,144,226,0.15); 
        }
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot.dragover { 
          outline: 2px solid #4A90E2; 
          background: rgba(74,144,226,0.1); 
          box-shadow: 0 4px 12px rgba(74,144,226,0.3); 
        }
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot.occupied { 
          outline: 1px solid #4A90E2; 
          background: linear-gradient(135deg, rgba(74,144,226,0.05), rgba(74,144,226,0.02)); 
        }
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot.available { 
          outline: 1px solid #666666; 
          background: transparent; 
        }
        /* Hide stop sign */
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot svg rect[stroke-dasharray] { 
          display: none !important; 
        }
        /* Override disabled styles */
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot, 
        .relative.flex.w-full.flex-1.flex-col.rounded-12.bg-system-bg04.p-4.text-sm.lg\\:p-3 .upload-slot * {
          cursor: pointer !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Check if on Reference to Video tab
  function isOnReferenceToVideoTab() {
    return location.pathname.includes('/create/character2video');
  }

  // Setup mode observer
  function setupModeObserver(uploadWrapper) {
    const modeContainer = document.querySelector('.mx-auto.rounded-12.bg-system-bg04.p-1');
    if (modeContainer) {
      const modeObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
            const targetButton = mutation.target;
            if (targetButton.getAttribute('aria-selected') === 'true') {
              isSetupDone = false;
              debounceSetup();
            }
          }
        });
      });
      modeObserver.observe(modeContainer, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
    }
  }

  // Main setup function with dynamic accept update
  async function setupUploadFunctionality() {
    try {
      if (!isOnReferenceToVideoTab() && !location.pathname.includes('/create/img2video')) return;

      // Dynamically update accept attribute
      const acceptTypes = (isOnReferenceToVideoTab() || location.pathname.includes('/create/img2video'))
        ? 'image/jpeg,image/png,image/webp,video/mp4'
        : 'image/jpeg,image/png,image/webp';
      multiFileInput.accept = acceptTypes;
      console.log('Updated multiFileInput.accept to:', multiFileInput.accept);

      uploadWrapper = await findUploadWrapper();
      if (!uploadWrapper) return;

      const uploadSlots = getCurrentUploadSlots();
      if (uploadSlots.length < 2) return;

      enableAllSlots(uploadSlots);
      setupDragAndDrop(uploadWrapper);
      setupClickToUpload(uploadWrapper);
      setupPasteFunctionality();
      setupButtonFunctionality(uploadSlots); // No button container creation here
      observeSlotChanges(uploadSlots);
      injectUploadStyles();

      uploadSlots.forEach(slot => updateSlotStyles(slot));
      isSetupDone = true;

      setupModeObserver(uploadWrapper);
    } catch (error) {
      console.error("Error in setupUploadFunctionality:", error);
    }
  }

  const debounceSetup = debounce(() => {
    setupPromise = setupUploadFunctionality();
  }, 500);

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

  waitForElement('#form-container').then(container => {
    formContainerObserver.observe(container, { childList: true, subtree: true });
  }).catch(err => console.error(err));
}