import { createDecartClient, models } from '@decartai/sdk';

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const imageUpload = document.getElementById('image-upload');
  const uploadBtn = document.getElementById('upload-btn');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const imagePreview = document.getElementById('image-preview');
  
  const apiTokenInput = document.getElementById('api-token');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const statusIndicator = document.getElementById('status-indicator');
  const cameraSelect = document.getElementById('camera-select');
  
  const localVideo = document.getElementById('local-video');
  const outputPlaceholder = document.getElementById('output-placeholder');
  const spinner = document.getElementById('spinner');
  const placeholderText = document.getElementById('placeholder-text');
  const remoteVideo = document.getElementById('remote-video');
  
  // Billing UI
  const creditInfo = document.getElementById('credit-info');
  const creditBalanceDisplay = document.getElementById('credit-balance');
  const timeLeftDisplay = document.getElementById('time-left');
  const buyCreditPanel = document.getElementById('buy-credit-panel');
  const creditModal = document.getElementById('credit-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const deviceIdDisplay = document.getElementById('device-id');
  const buyLinkDynamic = document.getElementById('buy-link-dynamic');

  // State
  let selectedFile = null;
  let localStream = null;
  let decartClient = null;
  let realtimeClient = null;
  let outputWindow = null;
  let isStreaming = false;

  // Billing State
  let userCredits = 0;
  let serverDecartToken = null;
  let billingInterval = null;
  let currentBillingRate = 3; // Default credits per second
  const API_BASE_URL = 'http://82.223.222.181:3001/api';
  
  // --- Instance / Device ID Logic ---
  function generateDeviceId(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  let deviceId = localStorage.getItem('lucy_device_id');
  if (!deviceId) {
    deviceId = generateDeviceId(8);
    localStorage.setItem('lucy_device_id', deviceId);
    console.log('Generated new Device ID:', deviceId);
    
    // Initialize the device with the server
    fetch(`${API_BASE_URL}/user/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.tokenkey) {
        localStorage.setItem('lucy_last_token', data.tokenkey);
        if (apiTokenInput) apiTokenInput.value = data.tokenkey;
        fetchUserCredits(data.tokenkey);
      }
    })
    .catch(err => console.error('Failed to init device:', err));
  } else {
    console.log('Loaded existing Device ID:', deviceId);
  }
  
  const displayDeviceId = document.getElementById('display-instance-id');
  if (displayDeviceId) {
    displayDeviceId.textContent = deviceId;
  }
  
  // Update all WhatsApp links with Device ID
  const allBuyLinks = document.querySelectorAll('a[href*="whatsapp.com"]');
  const fullMsg = encodeURIComponent(`Hi! I'd like to purchase credits on Middlefinger FaceSwap stream. my deviceId is ${deviceId}`);
  allBuyLinks.forEach(link => {
    link.href = `https://api.whatsapp.com/send/?phone=%2B13314812451&text=${fullMsg}&type=phone_number&app_absent=0`;
  });
  // -----------------------------------

  // Initialize Camera Feed (Local)
  async function initLocalCamera(preferredDeviceId = null) {
    // Stop previous stream if switching
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    const videoConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 16/9 }
    };

    if (preferredDeviceId) {
      videoConstraints.deviceId = { exact: preferredDeviceId };
    }

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      });
    } catch (err) {
      console.error('Failed to access camera:', err);
      statusIndicator.textContent = 'Error: Could not access camera.';
      statusIndicator.className = 'status error';
      return;
    }
    
    if (localStream) {
      localVideo.srcObject = localStream;
      statusIndicator.textContent = 'Camera ready.';
      checkReadyState();
      
      // Update list after permission granted
      await getCameras();
    }
  }

  // Enumerate cameras
  async function getCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      cameraSelect.innerHTML = '';
      videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${cameraSelect.length + 1}`;
        if (localStream && localStream.getVideoTracks()[0].getSettings().deviceId === device.deviceId) {
          option.selected = true;
        }
        cameraSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error enumerating cameras:', err);
    }
  }

  // Handle camera change
  cameraSelect.addEventListener('change', async () => {
    const deviceId = cameraSelect.value;
    if (deviceId) {
      await initLocalCamera(deviceId);
    }
  });

  // Handle Image Upload UI
  uploadBtn.addEventListener('click', () => {
    imageUpload.click();
  });

  imageUpload.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedFile = e.target.files[0];
      
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreviewContainer.classList.remove('hidden');
        uploadBtn.textContent = 'Change Image';
      };
      reader.readAsDataURL(selectedFile);
      
      checkReadyState();
    }
  });

  apiTokenInput.addEventListener('change', async () => {
    const token = apiTokenInput.value.trim();
    if (token.length > 5) {
      await fetchUserCredits(token);
    }
  });

  apiTokenInput.addEventListener('input', () => {
    const token = apiTokenInput.value.trim();
    if (token.length <= 5) {
      creditInfo.classList.add('hidden');
      buyCreditPanel.classList.add('hidden');
      serverDecartToken = null;
      checkReadyState();
    }
  });

  async function fetchUserCredits(token) {
    try {
      const response = await fetch(`${API_BASE_URL}/user/${token}?deviceId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        userCredits = data.credits;
        serverDecartToken = data.decartToken;
        currentBillingRate = data.billingRate || 3;
        
        // Save valid token locally
        localStorage.setItem('lucy_last_token', token);
        
        if (deviceIdDisplay) {
          deviceIdDisplay.textContent = data.deviceId || 'Not Assigned';
        }
        
        statusIndicator.textContent = 'Token Validated!';
        statusIndicator.className = 'status connected';
        alert('Success: Middlefinger API Token is valid!');
        
        updateCreditDisplay();
        creditInfo.classList.remove('hidden');
        buyCreditPanel.classList.add('hidden');
        
        // If not being "used" (assigned), we might want to inform or auto-assign
        // But the prompt says "if yes then get credit balance", which we just did.
        
        checkReadyState();
      } else if (response.status === 404) {
        const errorData = await response.json();
        statusIndicator.textContent = errorData.error || 'Invalid token key.';
        statusIndicator.className = 'status error';
        alert('Error: ' + (errorData.error || 'Invalid token key.'));
        creditInfo.classList.add('hidden');
        connectBtn.disabled = true;
      } else {
        creditInfo.classList.add('hidden');
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    }
  }

  function updateCreditDisplay() {
    const floorCredits = Math.floor(userCredits);
    const minCreditsRequired = currentBillingRate * 10;
    
    if (userCredits < minCreditsRequired) {
      creditBalanceDisplay.textContent = `${floorCredits} (Low)`;
      creditBalanceDisplay.classList.add('low-credit');
      if (buyLinkDynamic) buyLinkDynamic.textContent = 'Buy Credit';
    } else {
      creditBalanceDisplay.textContent = floorCredits;
      creditBalanceDisplay.classList.remove('low-credit');
      if (buyLinkDynamic) buyLinkDynamic.textContent = 'Buy More Credit';
    }
    
    timeLeftDisplay.textContent = formatTime(userCredits);
  }

  function formatTime(credits) {
    const totalSeconds = Math.floor(credits / currentBillingRate);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  // Check if all prerequisites are met to enable Connect
  function checkReadyState() {
    const minCreditsRequired = currentBillingRate * 10; // 10 seconds worth
    
    if (selectedFile && localStream && serverDecartToken && userCredits >= minCreditsRequired) {
      connectBtn.disabled = false;
      statusIndicator.textContent = 'Ready to connect.';
      statusIndicator.className = 'status connected';
    } else {
      connectBtn.disabled = true;
      statusIndicator.className = 'status';
      
      if (!localStream) {
        statusIndicator.textContent = 'Waiting for camera access...';
      } else if (!selectedFile) {
        const tokenMsg = serverDecartToken ? 'Token Validated! ' : '';
        statusIndicator.textContent = tokenMsg + 'Please select a reference image.';
      } else if (!serverDecartToken) {
        statusIndicator.textContent = 'Please enter a valid token key.';
      } else if (userCredits < minCreditsRequired) {
        const tokenMsg = serverDecartToken ? 'Token Validated! ' : '';
        statusIndicator.textContent = tokenMsg + 'Low credit unit.';
        statusIndicator.className = 'status error';
      }
    }
  }

  // Handle Connect
  connectBtn.addEventListener('click', async () => {
    try {
      // Synchronously open a new window to bypass browser popup blockers
      if (!outputWindow || outputWindow.closed) {
        // Calculate 1/4 of the screen size
        const popWidth = Math.floor(window.screen.availWidth / 2);
        const popHeight = Math.floor(window.screen.availHeight / 2);
        
        // Open a completely fresh popup every time to avoid cross-session context issues
        outputWindow = window.open('about:blank', '_blank', `width=${popWidth},height=${popHeight},resizable=no,scrollbars=no`);
        if (outputWindow) {
          outputWindow.document.open();
          outputWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <title>MiddleFinger Face Swap Live Output</title>
                <style>
                    body { margin: 0; background: #000; height: 100vh; overflow: hidden; font-family: sans-serif; color: white;}
                    video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }
                    .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5rem; text-align: center; }
                    .infinity { font-size: 6rem; font-weight: bold; color: #8b5cf6; margin-bottom: 16px; line-height: 1; animation: pulse 2s ease-in-out infinite; }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                    #ready-btn {
                        margin-top: 28px;
                        padding: 16px 48px;
                        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                        color: white;
                        border: none;
                        border-radius: 50px;
                        font-size: 1.1rem;
                        font-weight: 700;
                        letter-spacing: 0.05em;
                        cursor: pointer;
                        box-shadow: 0 0 30px rgba(139, 92, 246, 0.5);
                        transition: transform 0.15s ease, box-shadow 0.15s ease;
                    }
                    #ready-btn:hover { transform: scale(1.06); box-shadow: 0 0 50px rgba(139, 92, 246, 0.8); }
                    #ready-btn:active { transform: scale(0.97); }
                </style>
            </head>
            <body>
                <div id="loading" class="loading">
                    <div class="infinity">&#8734;</div>
                    <div>Waiting for OBS Setup...</div>
                    <div style="font-size: 0.95rem; color: #aaa; margin-top: 8px;">Set up your scene, then click the button below</div>
                    <button id="ready-btn">&#9654; I'm Ready — Start Stream</button>
                </div>
            </body>
            </html>
          `);
          outputWindow.document.close();
        } else {
          console.warn('Popup blocked! Please allow popups for this site.');
        }
      }

      updateUIState('connecting');

      const token = apiTokenInput.value.trim();
      
      // 1. Initialize Decart Client (Using token from server)
      decartClient = createDecartClient({ apiKey: serverDecartToken });

      // 1.5 Crop stream to exact 1280x720 16:9 mode
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      
      isStreaming = true;
      const drawFrame = () => {
        if (!isStreaming) return; // Stop drawing when disconnected
        if (localVideo.videoWidth > 0 && localVideo.videoHeight > 0) {
          const videoRatio = localVideo.videoWidth / localVideo.videoHeight;
          const targetRatio = 1280 / 720;
          let sx, sy, sWidth, sHeight;
          
          if (videoRatio > targetRatio) {
            // Video is wider, crop sides
            sHeight = localVideo.videoHeight;
            sWidth = sHeight * targetRatio;
            sx = (localVideo.videoWidth - sWidth) / 2;
            sy = 0;
          } else {
            // Video is taller, crop top/bottom
            sWidth = localVideo.videoWidth;
            sHeight = sWidth / targetRatio;
            sx = 0;
            sy = (localVideo.videoHeight - sHeight) / 2;
          }
          ctx.drawImage(localVideo, sx, sy, sWidth, sHeight, 0, 0, 1280, 720);
        }
        requestAnimationFrame(drawFrame);
      };
      
      // Start loop immediately so stream isn't empty
      requestAnimationFrame(drawFrame);

      const canvasStream = canvas.captureStream(30);
      const processedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...localStream.getAudioTracks()
      ]);

      // 1.8 Wait for user to click "I'm Ready" in the popup
      await new Promise((resolve) => {
        const checkReady = setInterval(() => {
          if (!isStreaming) { clearInterval(checkReady); resolve(); return; }
          if (!outputWindow || outputWindow.closed) { clearInterval(checkReady); resolve(); return; }
          const btn = outputWindow.document.getElementById('ready-btn');
          if (btn && !btn._listenerAttached) {
            btn._listenerAttached = true;
            btn.addEventListener('click', () => {
              btn.textContent = 'Connecting...';
              btn.disabled = true;
              btn.style.opacity = '0.6';
              clearInterval(checkReady);
              resolve();
            });
          }
        }, 200);
      });

      if (!isStreaming) return; // Abort if user clicked disconnect
      if (outputWindow && !outputWindow.closed) {
        const loadingEl = outputWindow.document.getElementById('loading');
        if (loadingEl) loadingEl.innerHTML = '<div style="font-size:1.4rem;color:#8b5cf6;">Connecting to MiddleFinger...</div>';
      }

      // 2. Connect to Realtime API
      realtimeClient = await decartClient.realtime.connect(processedStream, {
        model: models.realtime('lucy-2'),
        onRemoteStream: (stream) => {
          // Display in main page as well
          if (remoteVideo) {
            remoteVideo.srcObject = stream;
            remoteVideo.muted = true; // Mute audio on main page
            remoteVideo.classList.remove('hidden');
            remoteVideo.style.objectFit = 'contain';
          }
          
          if (outputWindow && !outputWindow.closed) {
            const loading = outputWindow.document.getElementById('loading');
            if (loading) loading.style.display = 'none';
            
            // Create the video element in the MAIN window context to prevent cross-window MediaStream black screen bugs
            const popupVideo = document.createElement('video');
            popupVideo.autoplay = true;
            popupVideo.playsInline = true;
            popupVideo.muted = true; // Hard muted in popup
            popupVideo.srcObject = stream;
            
            popupVideo.onloadedmetadata = () => {
              popupVideo.play().catch(err => console.error('Play failed:', err));
            };
            
            outputWindow.document.body.appendChild(popupVideo);
          }
          
          startBilling();
          updateUIState('connected');
        }
      });

      // 4. Set Reference Image
      await realtimeClient.setImage(selectedFile);

      // The user requested NO Style Prompt, just realism.
      // We will just skip setting any prompt.

      realtimeClient.on('disconnected', () => {
        updateUIState('disconnected');
      });

      realtimeClient.on('error', (err) => {
        console.error('Realtime error:', err);
        if (err.message && err.message.includes('Insufficient credits')) {
          alert('Insufficient credits. Stream ending.');
          stopStreaming();
        }
      });

      } catch (err) {
        console.error('Connection failed:', err);
        updateUIState('error', err.message);
      }
    });

  function startBilling() {
    if (billingInterval) clearInterval(billingInterval);
    
    let secondsSinceLastSync = 0;
    billingInterval = setInterval(async () => {
      if (!isStreaming) return;
      
      userCredits -= currentBillingRate;
      secondsSinceLastSync++;
      
      if (userCredits <= 0) {
        userCredits = 0;
        updateCreditDisplay();
        stopStreaming();
        buyCreditPanel.classList.remove('hidden');
        creditModal.classList.remove('hidden');
        return;
      }
      
      updateCreditDisplay();
      
      // Sync to DB every 5 seconds
      if (secondsSinceLastSync >= 5) {
        syncCreditsToDB(5 * currentBillingRate);
        secondsSinceLastSync = 0;
      }
    }, 1000);
  }

  async function syncCreditsToDB(unitsUsed) {
    const token = apiTokenInput.value.trim();
    try {
      await fetch(`${API_BASE_URL}/user/${token}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitsUsed })
      });
    } catch (err) {
      console.error('Failed to sync credits:', err);
    }
  }

  function stopBilling() {
    if (billingInterval) {
      clearInterval(billingInterval);
      billingInterval = null;
    }
  }

  // Global Stop function
  function stopStreaming() {
    isStreaming = false;
    stopBilling();
    if (realtimeClient) {
      try { realtimeClient.disconnect(); } catch(e) {}
      realtimeClient = null;
    }
    if (outputWindow && !outputWindow.closed) {
      outputWindow.close();
    }
    updateUIState('disconnected');
  }

  // Handle Disconnect (Stop Live)
  disconnectBtn.addEventListener('click', stopStreaming);

  function updateUIState(state, errorMsg = '') {
    switch (state) {
      case 'connecting':
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        statusIndicator.textContent = 'Connecting to MiddleFinger...';
        statusIndicator.className = 'status';
        outputPlaceholder.classList.remove('hidden');
        if (remoteVideo) remoteVideo.classList.add('hidden');
        spinner.classList.remove('hidden');
        placeholderText.textContent = outputWindow ? 'Playing in new tab...' : 'Popup blocked! Allow popups to see output.';
        break;
      case 'connected':
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        statusIndicator.textContent = 'Connected! Realtime swap active in popup.';
        statusIndicator.className = 'status connected';
        spinner.classList.add('hidden');
        outputPlaceholder.classList.add('hidden');
        if (remoteVideo) remoteVideo.classList.remove('hidden');
        placeholderText.textContent = outputWindow && !outputWindow.closed ? 'Live stream running in popup tab' : 'Popup was closed or blocked';
        break;
      case 'disconnected':
        connectBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
        connectBtn.disabled = false;
        statusIndicator.textContent = 'Disconnected. Ready to connect.';
        statusIndicator.className = 'status';
        outputPlaceholder.classList.remove('hidden');
        if (remoteVideo) remoteVideo.classList.add('hidden');
        spinner.classList.add('hidden');
        placeholderText.textContent = 'Output will open in a new tab.';
        realtimeClient = null;
        decartClient = null;
        break;
      case 'error':
        connectBtn.disabled = false;
        connectBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
        statusIndicator.textContent = `Error: ${errorMsg}`;
        statusIndicator.className = 'status error';
        spinner.classList.add('hidden');
        placeholderText.textContent = 'Connection failed.';
        if (outputWindow && !outputWindow.closed) {
          outputWindow.close();
        }
        break;
    }
  }

  closeModalBtn.addEventListener('click', () => {
    creditModal.classList.add('hidden');
  });

  // Start initialization
  initLocalCamera();

  // Load last used token
  const lastToken = localStorage.getItem('lucy_last_token');
  if (lastToken) {
    apiTokenInput.value = lastToken;
    fetchUserCredits(lastToken);
  }
});
