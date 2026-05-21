// ─── SHARED STATE via localStorage ────────────────────────────────────
function getState() {
  try { return JSON.parse(localStorage.getItem('physicsExplorer') || '{}'); } catch { return {}; }
}
function setState(patch) {
  localStorage.setItem('physicsExplorer', JSON.stringify({ ...getState(), ...patch }));
}
function getSim() { return getState().sim || 'Celestial Bodies'; }

// ─── STATUS FLASH ──────────────────────────────────────────────────────
function flash(msg) {
  const el = document.getElementById('status-flash');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// ─── CAMERA + MEDIAPIPE ────────────────────────────────────────────────
let mpHands = null, mpCamera = null, cameraRunning = false;

function getCameraEls() {
  return {
    handCanvas: document.getElementById('hand-canvas'),
    video: document.getElementById('video-el'),
  };
}

function resizeHandCanvas() {
  const { handCanvas } = getCameraEls();
  if (!handCanvas) return;
  handCanvas.width = window.innerWidth;
  handCanvas.height = window.innerHeight;
}

async function startCamera(onResults) {
  if (cameraRunning) return;
  resizeHandCanvas();
  window.addEventListener('resize', resizeHandCanvas);

  const { video } = getCameraEls();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 1280, height: 720 }
    });
    video.srcObject = stream;
    await video.play();
    document.body.classList.add('camera-active');
    cameraRunning = true;

    mpHands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });
    mpHands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    mpHands.onResults(onResults);

    mpCamera = new Camera(video, {
      onFrame: async () => { await mpHands.send({ image: video }); },
      width: 1280, height: 720,
    });
    mpCamera.start();
  } catch (e) {
    flash('Camera not available — gesture detection disabled');
  }
}

function stopCamera() {
  if (!cameraRunning) return;
  if (mpCamera) mpCamera.stop();
  const { video, handCanvas } = getCameraEls();
  if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  const ctx = handCanvas && handCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  document.body.classList.remove('camera-active');
  cameraRunning = false;
}

// Flip landmark X coordinates so the skeleton matches the mirrored video feed.
// MediaPipe returns x=0 on the user's right side; after we mirror the video we
// need the skeleton to follow, so we invert x in normalised [0,1] space.
function mirrorLandmarks(landmarks) {
  return landmarks.map(pt => ({ ...pt, x: 1 - pt.x }));
}

// Draw mirrored video + correctly-sided hand skeleton
function drawHandResults(results) {
  const { handCanvas } = getCameraEls();
  if (!handCanvas) return;
  const ctx = handCanvas.getContext('2d');
  ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  // Mirror the raw video so it feels like a mirror to the user
  ctx.save();
  ctx.scale(-1, 1);
  // ctx.drawImage(results.image, -handCanvas.width, 0, handCanvas.width, handCanvas.height);
  ctx.restore();

  if (!results.multiHandLandmarks) return;

  results.multiHandLandmarks.forEach(landmarks => {
    const mirrored = mirrorLandmarks(landmarks);
    drawConnectors(ctx, mirrored, HAND_CONNECTIONS, {
      color: 'rgba(232,25,125,0.6)', lineWidth: 2
    });
    drawLandmarks(ctx, mirrored, {
      color: 'rgba(232,25,125,0.9)',
      fillColor: 'rgba(255,255,255,0.8)',
      lineWidth: 1, radius: 5
    });
  });

  return results.multiHandLandmarks;
}

// ─── CAMERA BG TEMPLATE ───────────────────────────────────────────────
function injectCameraBg() {
  const div = document.createElement('div');
  div.id = 'camera-bg';
  div.innerHTML = `<video id="video-el" playsinline></video><canvas id="hand-canvas"></canvas>`;
  document.body.prepend(div);
}

// ─── STATUS FLASH TEMPLATE ────────────────────────────────────────────
function injectFlash() {
  const div = document.createElement('div');
  div.id = 'status-flash';
  document.body.appendChild(div);
}