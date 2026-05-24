// Swing Lab — on-device baseball swing analysis using MediaPipe Pose.
// Loads the model from a CDN at runtime; all video stays in the browser.
import { PoseLandmarker, FilesetResolver, DrawingUtils }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const fileInput = document.getElementById("swing-file");
const analyzeBtn = document.getElementById("swing-analyze");
const video = document.getElementById("swing-video");
const canvas = document.getElementById("swing-canvas");
const statusEl = document.getElementById("swing-status");
const resultsEl = document.getElementById("swing-results");
const ctx = canvas.getContext("2d");

let landmarker = null;
let videoReady = false;

const setStatus = (t) => { statusEl.textContent = t; };

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  video.src = URL.createObjectURL(file);
  resultsEl.innerHTML = "";
  videoReady = false;
  video.addEventListener("loadedmetadata", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    videoReady = true;
    analyzeBtn.disabled = false;
    setStatus("Loaded. Press Analyze to break down your swing.");
  }, { once: true });
});

analyzeBtn.addEventListener("click", () => { if (videoReady) run(); });

async function ensureModel() {
  if (landmarker) return;
  setStatus("Loading the pose model (first run downloads ~10 MB)…");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

function seekTo(t) {
  return new Promise((resolve) => {
    const handler = () => { video.removeEventListener("seeked", handler); resolve(); };
    video.addEventListener("seeked", handler);
    video.currentTime = t;
  });
}

const angleDeg = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function run() {
  analyzeBtn.disabled = true;
  resultsEl.innerHTML = "";
  try {
    await ensureModel();
  } catch (e) {
    setStatus("Couldn't load the pose model — check your internet connection and try again.");
    analyzeBtn.disabled = false;
    return;
  }

  const drawer = new DrawingUtils(ctx);
  const duration = video.duration;
  const fps = 20;
  const step = 1 / fps;
  const maxSamples = 140;
  const frames = [];
  let ts = 0;

  setStatus("Analyzing… watch the skeleton track your swing.");
  video.pause();

  let t = 0, count = 0;
  while (t < duration && count < maxSamples) {
    await seekTo(t);
    ts += 33;
    let result;
    try { result = landmarker.detectForVideo(video, ts); }
    catch { result = null; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (result && result.landmarks && result.landmarks[0]) {
      const lm = result.landmarks[0];
      drawer.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#5b8cff", lineWidth: 3 });
      drawer.drawLandmarks(lm, { color: "#7c5cff", radius: 3 });
      frames.push({ t, lm });
    }
    t += step; count++;
  }

  if (frames.length < 5) {
    setStatus("Couldn't track a body clearly. Use a side-on clip with your whole body in frame and good lighting.");
    analyzeBtn.disabled = false;
    return;
  }

  analyze(frames);
  analyzeBtn.disabled = false;
}

function analyze(frames) {
  const L = { nose: 0, lShoulder: 11, rShoulder: 12, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24 };

  const hipAngles = frames.map((f) => angleDeg(f.lm[L.lHip], f.lm[L.rHip]));
  const shAngles = frames.map((f) => angleDeg(f.lm[L.lShoulder], f.lm[L.rShoulder]));
  const sep = frames.map((_, i) => Math.abs(shAngles[i] - hipAngles[i]));

  const range = (arr) => Math.max(...arr) - Math.min(...arr);
  const hipRange = range(hipAngles);
  const shRange = range(shAngles);
  const maxSep = Math.max(...sep);

  // hand speed (use the faster-moving wrist) in normalized units / second
  const speeds = [];
  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].t - frames[i - 1].t || 0.05;
    const dl = dist(frames[i].lm[L.lWrist], frames[i - 1].lm[L.lWrist]) / dt;
    const dr = dist(frames[i].lm[L.rWrist], frames[i - 1].lm[L.rWrist]) / dt;
    speeds.push(Math.max(dl, dr));
  }
  const peakSpeed = Math.max(...speeds);
  const peakIdx = speeds.indexOf(peakSpeed);
  // launch = first frame exceeding 25% of peak
  let launchIdx = speeds.findIndex((s) => s > peakSpeed * 0.25);
  if (launchIdx < 0) launchIdx = 0;
  const tempoMs = Math.round((frames[peakIdx + 1].t - frames[launchIdx].t) * 1000);

  // head stillness: range of nose position as % of frame
  const noseX = frames.map((f) => f.lm[L.nose].x);
  const noseY = frames.map((f) => f.lm[L.nose].y);
  const headMove = Math.round(Math.max(range(noseX), range(noseY)) * 100);

  // timing: do hips peak before shoulders?
  const idxOfPeakRotation = (arr) => {
    const mid = (Math.max(...arr) + Math.min(...arr)) / 2;
    let best = 0, bestD = -1;
    arr.forEach((v, i) => { const d = Math.abs(v - mid); if (d > bestD) { bestD = d; best = i; } });
    return best;
  };
  const hipsTurnIdx = idxOfPeakRotation(hipAngles);
  const shTurnIdx = idxOfPeakRotation(shAngles);

  const metric = (val, label, note) =>
    `<div class="metric"><div class="m-val">${val}</div><div class="m-label">${label}</div>${note ? `<div class="m-note" style="color:${note.color}">${note.text}</div>` : ""}</div>`;

  const tips = [];
  if (hipRange < 12) tips.push("Limited hip rotation — drive harder with your lower half to unlock power.");
  else tips.push("Good hip rotation through the swing.");
  if (maxSep < 12) tips.push("Hips and shoulders are turning together. Let your hips fire first, then your shoulders, to build separation (the 'X-factor').");
  else tips.push("Nice hip-shoulder separation — that's where bat speed comes from.");
  if (shTurnIdx < hipsTurnIdx) tips.push("Your shoulders are turning ahead of your hips — try staying closed a beat longer.");
  if (headMove > 12) tips.push("Your head moves a lot through the swing — keep your eyes quiet and head still for better contact.");
  else tips.push("Head stays still through contact — great for tracking the ball.");
  tips.push(`Swing tempo (load to peak hand speed): ${tempoMs} ms.`);

  resultsEl.innerHTML =
    metric(hipRange.toFixed(0) + "°", "Hip rotation range") +
    metric(shRange.toFixed(0) + "°", "Shoulder rotation") +
    metric(maxSep.toFixed(0) + "°", "Max hip-shoulder separation") +
    metric(headMove + "%", "Head movement", { text: headMove > 12 ? "Aim lower" : "Quiet — good", color: headMove > 12 ? "var(--amber)" : "var(--green)" }) +
    metric(tempoMs + " ms", "Swing tempo") +
    metric(frames.length, "Frames tracked") +
    `<div class="feedback"><strong>Coaching notes</strong><ul>${tips.map((t) => `<li>${t}</li>`).join("")}</ul>
      <p class="m-note" style="margin-top:10px;color:var(--muted)">These are on-device estimates from 2D video — useful for spotting trends, not a substitute for a coach. Deeper AI breakdowns arrive with the backend.</p></div>`;

  setStatus("Analysis complete.");
}
