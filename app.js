const STORAGE_KEY = "zoli-scan-settings";
const APP_VERSION = "2026-06-07-live-ocr-v1";

const DEFAULT_SETTINGS = {
  intervalMs: 100,
  modelId: "tesseract-deu",
  scanProfile: "curved-label",
  autoCopy: true,
  strictTrace: true,
};

const DEFAULT_MODEL_ID = "tesseract-deu";
const DEFAULT_SCAN_PROFILE = "curved-label";
const OCR_CANVAS_PADDING = 18;
const LIVE_RESULT_WINDOW_MS = 9000;
const LIVE_RESULT_MAX_FRAMES = 36;
const LIVE_STATUS_UPDATE_MS = 500;
const LIVE_TESSERACT_WORKER_LIMIT = getLiveTesseractWorkerLimit();
const SCAN_PROFILES = {
  "curved-label": {
    frame: { x: 0.18, y: 0.08, width: 0.64, height: 0.78 },
    targetWidth: 1180,
    liveTargetWidth: 720,
    minTargetWidth: 760,
    contrast: 1.2,
    brightness: 1.05,
    adaptiveRadiusRatio: 0.034,
    thresholdBias: 6,
    psm: "4",
    fallbackPsm: "11",
    minTextLength: 34,
    minConfidence: 42,
  },
  ingredients: {
    frame: { x: 0.08, y: 0.16, width: 0.84, height: 0.66 },
    targetWidth: 1120,
    liveTargetWidth: 720,
    minTargetWidth: 720,
    contrast: 1.18,
    brightness: 1.05,
    adaptiveRadiusRatio: 0.036,
    thresholdBias: 5,
    psm: "6",
    fallbackPsm: "4",
    minTextLength: 30,
    minConfidence: 40,
  },
  "small-text": {
    frame: { x: 0.06, y: 0.08, width: 0.88, height: 0.82 },
    targetWidth: 1420,
    liveTargetWidth: 860,
    minTargetWidth: 900,
    contrast: 1.24,
    brightness: 1.06,
    adaptiveRadiusRatio: 0.028,
    thresholdBias: 7,
    psm: "4",
    fallbackPsm: "11",
    minTextLength: 40,
    minConfidence: 44,
  },
};

const GLUTEN_RULES = [
  {
    id: "gluten",
    label: "Gluten",
    severity: "danger",
    terms: [
      "gluten",
      "glutenhaltig",
      "glutenhaltige",
      "glutenhaltiges",
      "gluteneiweiss",
      "gluteneiweiß",
      "glutenprotein",
    ],
    note: "Direkter Gluten-Hinweis.",
  },
  {
    id: "wheat",
    label: "Weizen",
    severity: "danger",
    terms: [
      "weizen",
      "weizenmehl",
      "weizenstarke",
      "weizenstärke",
      "weizengriess",
      "weizengrieß",
      "weizenkleie",
      "weizeneiweiss",
      "weizeneiweiß",
      "weizengluten",
      "hartweizen",
      "weichweizen",
      "wheat",
      "wheat flour",
      "wheat starch",
      "ble",
      "blé",
      "farine de ble",
      "farine de blé",
      "trigo",
      "frumento",
      "farina di frumento",
    ],
    note: "Weizen ist glutenhaltig.",
  },
  {
    id: "barley",
    label: "Gerste / Malz",
    severity: "danger",
    terms: [
      "gerste",
      "gerstenmalz",
      "gerstenmalzextrakt",
      "gerstenmalzmehl",
      "malzextrakt",
      "malzessig",
      "barley",
      "barley malt",
      "malt extract",
      "malted barley",
      "orge",
      "cebada",
      "orzo",
      "malto d orzo",
    ],
    note: "Gerste und Gerstenmalz sind glutenhaltig.",
  },
  {
    id: "rye",
    label: "Roggen",
    severity: "danger",
    terms: ["roggen", "roggenmehl", "rye", "rye flour", "seigle", "centeno", "segale"],
    note: "Roggen ist glutenhaltig.",
  },
  {
    id: "spelt",
    label: "Dinkel / Urgetreide",
    severity: "danger",
    terms: [
      "dinkel",
      "dinkelmehl",
      "spelt",
      "epeautre",
      "épeautre",
      "espelta",
      "kamut",
      "khorasan",
      "emmer",
      "einkorn",
      "farro",
      "triticale",
    ],
    note: "Dinkel und verwandte Getreide enthalten Gluten.",
  },
  {
    id: "processed-grains",
    label: "Bulgur / Couscous / Seitan",
    severity: "danger",
    terms: ["bulgur", "couscous", "seitan", "semolina", "griess", "grieß"],
    note: "Typische Weizenprodukte.",
  },
  {
    id: "oats",
    label: "Hafer",
    severity: "warn",
    terms: ["hafer", "haferflocken", "oat", "oats", "oat flakes"],
    note: "Hafer ist nur geeignet, wenn er ausdrücklich glutenfrei ist.",
  },
];

const SAFE_PHRASES = [
  "glutenfrei",
  "gluten free",
  "gluten-free",
  "ohne gluten",
  "free from gluten",
  "sans gluten",
  "sin gluten",
  "senza glutine",
  "glutenfreier hafer",
  "glutenfreie haferflocken",
  "certified gluten free",
  "certified gluten-free",
];

const TRACE_PATTERNS = [
  "kann spuren von gluten enthalten",
  "kann spuren von weizen enthalten",
  "kann spuren von gerste enthalten",
  "kann spuren von roggen enthalten",
  "may contain gluten",
  "may contain wheat",
  "may contain barley",
  "may contain rye",
  "spuren von gluten",
  "spuren von weizen",
  "spuren von gerste",
  "spuren von roggen",
];

const els = {
  body: document.body,
  cameraVideo: document.querySelector("#cameraVideo"),
  captureCanvas: document.querySelector("#captureCanvas"),
  cameraEmpty: document.querySelector("#cameraEmpty"),
  cameraStage: document.querySelector(".camera-stage"),
  scanFrame: document.querySelector(".scan-frame"),
  cameraStatus: document.querySelector("#cameraStatus"),
  cameraButton: document.querySelector("#cameraButton"),
  modelButton: document.querySelector("#modelButton"),
  scanButton: document.querySelector("#scanButton"),
  loopButton: document.querySelector("#loopButton"),
  scanModeLabel: document.querySelector("#scanModeLabel"),
  lastScanTime: document.querySelector("#lastScanTime"),
  connectionBadge: document.querySelector("#connectionBadge"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  modelProgress: document.querySelector("#modelProgress"),
  modelProgressLabel: document.querySelector("#modelProgressLabel"),
  modelProgressDetail: document.querySelector("#modelProgressDetail"),
  resultPanel: document.querySelector("#resultPanel"),
  resultIcon: document.querySelector("#resultIcon"),
  resultTitle: document.querySelector("#resultTitle"),
  resultMessage: document.querySelector("#resultMessage"),
  matchCount: document.querySelector("#matchCount"),
  matchesList: document.querySelector("#matchesList"),
  highlightedText: document.querySelector("#highlightedText"),
  manualText: document.querySelector("#manualText"),
  analyzeManualButton: document.querySelector("#analyzeManualButton"),
  clearTextButton: document.querySelector("#clearTextButton"),
  copyTextButton: document.querySelector("#copyTextButton"),
  scanProfileSelect: document.querySelector("#scanProfileSelect"),
  intervalSelect: document.querySelector("#intervalSelect"),
  modelSelect: document.querySelector("#modelSelect"),
  autoCopyToggle: document.querySelector("#autoCopyToggle"),
  strictTraceToggle: document.querySelector("#strictTraceToggle"),
};

const state = {
  settings: loadSettings(),
  workerPool: [],
  workerReady: false,
  modelReady: false,
  loadingModel: false,
  busy: false,
  startingCamera: false,
  capturingFrame: false,
  activeScans: 0,
  scanSequence: 0,
  stream: null,
  loopTimer: null,
  pendingScanAfterLoad: false,
  liveFusion: createLiveFusionState(),
  liveStats: createLiveStats(),
  lastText: "",
  lastMatches: [],
};

init();

function init() {
  applySettingsToControls();
  bindEvents();
  updateConnectionStatus();
  registerServiceWorker();
  analyzeAndRender("", "initial");
}

function bindEvents() {
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  window.addEventListener("beforeunload", () => stopCamera());

  els.cameraButton.addEventListener("click", toggleCamera);
  els.modelButton.addEventListener("click", () => ensureModelReady());
  els.scanButton.addEventListener("click", () => scanCameraFrame());
  els.loopButton.addEventListener("click", toggleLoopScan);
  els.analyzeManualButton.addEventListener("click", () => {
    analyzeAndRender(els.manualText.value, "manual");
  });
  els.clearTextButton.addEventListener("click", () => {
    els.manualText.value = "";
    analyzeAndRender("", "manual");
  });
  els.copyTextButton.addEventListener("click", copyRecognizedText);

  els.scanProfileSelect.addEventListener("change", () => {
    state.settings.scanProfile = els.scanProfileSelect.value;
    saveSettings();
    resetLiveFusion();
    applyScanProfileFrame();
  });
  els.intervalSelect.addEventListener("change", () => {
    state.settings.intervalMs = Number(els.intervalSelect.value);
    saveSettings();
    if (state.loopTimer) {
      stopLoopScan();
      startLoopScan();
    }
  });
  els.modelSelect.addEventListener("change", () => {
    state.settings.modelId = els.modelSelect.value;
    state.modelReady = false;
    state.workerReady = false;
    destroyWorker();
    resetLiveFusion();
    saveSettings();
    setRuntimeStatus("OCR nicht geladen", "neutral");
    setProgress(0, "OCR wartet", "Die ausgewählte OCR-Methode ist noch nicht vorbereitet.");
  });
  els.autoCopyToggle.addEventListener("change", () => {
    state.settings.autoCopy = els.autoCopyToggle.checked;
    saveSettings();
  });
  els.strictTraceToggle.addEventListener("change", () => {
    state.settings.strictTrace = els.strictTraceToggle.checked;
    saveSettings();
    analyzeAndRender(state.lastText, "settings");
  });
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function applySettingsToControls() {
  if ([...els.intervalSelect.options].some((option) => option.value === String(state.settings.intervalMs))) {
    els.intervalSelect.value = String(state.settings.intervalMs);
  } else {
    state.settings.intervalMs = DEFAULT_SETTINGS.intervalMs;
    els.intervalSelect.value = String(DEFAULT_SETTINGS.intervalMs);
    saveSettings();
  }

  if (!SCAN_PROFILES[state.settings.scanProfile]) {
    state.settings.scanProfile = DEFAULT_SCAN_PROFILE;
    saveSettings();
  }
  els.scanProfileSelect.value = state.settings.scanProfile;
  applyScanProfileFrame();

  if ([...els.modelSelect.options].some((option) => option.value === state.settings.modelId)) {
    els.modelSelect.value = state.settings.modelId;
  } else {
    state.settings.modelId = DEFAULT_MODEL_ID;
    els.modelSelect.value = DEFAULT_MODEL_ID;
    saveSettings();
  }
  els.autoCopyToggle.checked = state.settings.autoCopy;
  els.strictTraceToggle.checked = state.settings.strictTrace;
}

function applyScanProfileFrame() {
  const profile = getCurrentScanProfile();
  const { x, y, width, height } = profile.frame;
  const top = y * 100;
  const right = (1 - x - width) * 100;
  const bottom = (1 - y - height) * 100;
  const left = x * 100;
  els.scanFrame.style.inset = `${top}% ${right}% ${bottom}% ${left}%`;
}

function getCurrentScanProfile() {
  return SCAN_PROFILES[state.settings.scanProfile] || SCAN_PROFILES[DEFAULT_SCAN_PROFILE];
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!window.isSecureContext) {
    setRuntimeStatus("Offline-Cache braucht HTTPS oder localhost", "warn");
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

function updateConnectionStatus() {
  if (navigator.onLine) {
    setBadge(els.connectionBadge, "Online", "ready");
  } else {
    setBadge(els.connectionBadge, "Offline", "warn");
  }
}

function setRuntimeStatus(text, tone = "neutral") {
  setBadge(els.runtimeStatus, text, tone);
}

function setBadge(element, text, tone) {
  element.textContent = text;
  element.className = `status-badge status-badge--${tone}`;
}

async function toggleCamera() {
  if (state.stream) {
    stopCamera();
    return;
  }
  await startCamera();
}

async function startCamera() {
  if (state.stream) {
    return true;
  }

  if (state.startingCamera) {
    return false;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Kamera-API nicht verfügbar");
    setResultNotice("unknown", "Kamera nicht verfügbar", "Nutze die manuelle Prüfung auf diesem Gerät.");
    return false;
  }

  state.startingCamera = true;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
    await tuneCameraTrack(state.stream);
    els.cameraVideo.srcObject = state.stream;
    els.cameraStage.classList.add("has-stream");
    els.cameraButton.querySelector("span").textContent = "Kamera aus";
    setCameraStatus("Kamera läuft");
    return true;
  } catch (error) {
    console.warn("Camera failed", error);
    setCameraStatus("Kamera-Zugriff abgelehnt");
    setResultNotice("unknown", "Kamera blockiert", "Prüfe Browser-Berechtigung oder nutze die manuelle Prüfung.");
    return false;
  } finally {
    state.startingCamera = false;
  }
}

async function tuneCameraTrack(stream) {
  const [track] = stream.getVideoTracks();
  if (!track?.applyConstraints) {
    return;
  }

  const capabilities = track.getCapabilities?.() || {};
  const advanced = [];
  if (capabilities.focusMode?.includes("continuous")) {
    advanced.push({ focusMode: "continuous" });
  }
  if (capabilities.exposureMode?.includes("continuous")) {
    advanced.push({ exposureMode: "continuous" });
  }
  if (capabilities.whiteBalanceMode?.includes("continuous")) {
    advanced.push({ whiteBalanceMode: "continuous" });
  }

  if (!advanced.length) {
    return;
  }

  try {
    await track.applyConstraints({ advanced });
  } catch (error) {
    console.warn("Camera tuning failed", error);
  }
}

function stopCamera() {
  if (!state.stream) {
    return;
  }
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  els.cameraVideo.srcObject = null;
  els.cameraStage.classList.remove("has-stream");
  els.cameraButton.querySelector("span").textContent = "Kamera";
  stopLoopScan();
  setCameraStatus("Kamera ist aus");
}

function setCameraStatus(text) {
  els.cameraStatus.textContent = text;
}

async function ensureModelReady(slot = getWorkerSlot(0)) {
  if (isSlotReady(slot)) {
    if (slot.index === 0) {
      state.modelReady = true;
    }
    return true;
  }
  if (slot.loading) {
    return false;
  }

  slot.loading = true;
  slot.modelId = state.settings.modelId;
  if (slot.index === 0) {
    state.loadingModel = true;
    setRuntimeStatus("OCR lädt", "warn");
    setProgress(4, "OCR lädt", "Die Texterkennung startet im Web Worker.");
    els.modelButton.disabled = true;
  }

  try {
    slot.worker.postMessage({ type: "load", modelId: state.settings.modelId });
    return false;
  } catch (error) {
    slot.loading = false;
    if (slot.index === 0) {
      state.loadingModel = false;
      els.modelButton.disabled = false;
      setRuntimeStatus("Modellfehler", "danger");
      setProgress(0, "Modellfehler", error.message);
    }
    return false;
  }
}

function getWorkerSlot(index = 0) {
  const existing = state.workerPool[index];
  if (existing) {
    return existing;
  }

  const slot = {
    index,
    worker: new Worker(`./ocr-worker.js?v=${APP_VERSION}`, { type: "module" }),
    ready: false,
    loading: false,
    busy: false,
    modelId: null,
    requestId: null,
    mode: null,
  };
  slot.worker.addEventListener("message", (event) => handleWorkerMessage(event, slot));
  slot.worker.addEventListener("error", (event) => {
    console.error("Worker error", event.message);
    releaseWorkerSlot(slot);
    slot.loading = false;
    slot.ready = false;
    if (slot.index === 0) {
      state.loadingModel = false;
      state.modelReady = false;
      els.modelButton.disabled = false;
      setRuntimeStatus("Workerfehler", "danger");
      setProgress(0, "Workerfehler", event.message || "OCR-Worker konnte nicht starten.");
    }
  });
  state.workerPool[index] = slot;
  return slot;
}

function isSlotReady(slot) {
  return slot?.ready && slot.modelId === state.settings.modelId;
}

function destroyWorkerPool() {
  for (const slot of state.workerPool) {
    if (!slot) {
      continue;
    }
    slot.worker.postMessage({ type: "dispose" });
    slot.worker.terminate();
  }
  state.workerPool = [];
  state.workerReady = false;
  state.modelReady = false;
  state.loadingModel = false;
  state.busy = false;
  state.activeScans = 0;
  state.capturingFrame = false;
  state.pendingScanAfterLoad = false;
  setBusy(false);
}

function destroyWorker() {
  destroyWorkerPool();
}

async function handleWorkerMessage(event, slot) {
  const { type, payload, requestId } = event.data || {};

  if (type === "progress") {
    if (slot.index !== 0 && state.modelReady) {
      return;
    }
    const progress = Math.max(5, Math.min(99, Math.round(payload.progress || 0)));
    setProgress(progress, payload.label || "Modell lädt", payload.detail || "Dateien werden im Browser-Cache gespeichert.");
    return;
  }

  if (type === "ready") {
    if (payload.id && payload.id !== state.settings.modelId) {
      return;
    }
    slot.ready = true;
    slot.loading = false;
    slot.modelId = state.settings.modelId;
    if (slot.index === 0) {
      state.workerReady = true;
      state.modelReady = true;
      state.loadingModel = false;
      els.modelButton.disabled = false;
      const storageNote = await requestPersistentStorage();
      setRuntimeStatus("OCR offline bereit", "ready");
      setProgress(100, "OCR bereit", `${payload.modelId} ist im Browser verfügbar.${storageNote}`);
      if (state.pendingScanAfterLoad) {
        state.pendingScanAfterLoad = false;
        window.setTimeout(() => scanCameraFrame(state.loopTimer ? "live" : "single"), 0);
      }
      if (state.loopTimer) {
        warmLiveWorkerPool();
      }
    } else if (state.loopTimer) {
      renderLiveScanStatus();
    }
    return;
  }

  if (type === "result") {
    if (requestId && slot.requestId && requestId !== slot.requestId) {
      return;
    }
    const wasLiveScan = slot.mode === "live";
    releaseWorkerSlot(slot);
    setRuntimeStatus(
      getRuntimeResultLabel(payload.durationMs, wasLiveScan),
      "ready",
    );
    const text = payload.text?.trim() || "";
    updateLastScanTime();
    handleRecognizedText(text, payload, wasLiveScan);
    return;
  }

  if (type === "error") {
    releaseWorkerSlot(slot);
    slot.loading = false;
    slot.ready = false;
    if (slot.index === 0) {
      state.loadingModel = false;
      state.modelReady = false;
      state.pendingScanAfterLoad = false;
      els.modelButton.disabled = false;
      setRuntimeStatus("OCR-Fehler", "danger");
      setProgress(0, "OCR-Fehler", payload.message || "Unbekannter Fehler.");
      setResultNotice("unknown", "OCR nicht möglich", payload.message || "Nutze die manuelle Prüfung.");
    } else {
      renderLiveScanStatus();
    }
  }
}

function setProgress(value, label, detail) {
  els.modelProgress.value = value;
  els.modelProgressLabel.textContent = label;
  els.modelProgressDetail.textContent = detail;
}

function reserveWorkerSlot(isLiveScan) {
  const slots = getLiveWorkerSlots(isLiveScan);
  const slot = slots.find((candidate) => isSlotReady(candidate) && !candidate.busy);
  if (!slot) {
    return null;
  }

  slot.busy = true;
  slot.requestId = ++state.scanSequence;
  slot.mode = isLiveScan ? "live" : "single";
  state.activeScans += 1;
  setBusy(true);
  return slot;
}

function releaseWorkerSlot(slot) {
  if (!slot?.busy) {
    return;
  }

  slot.busy = false;
  slot.requestId = null;
  slot.mode = null;
  state.activeScans = Math.max(0, state.activeScans - 1);
  setBusy(state.activeScans > 0);
}

function getLiveWorkerSlots(isLiveScan) {
  const targetCount = isLiveScan ? getLiveWorkerTargetCount() : 1;
  const slots = [];
  for (let index = 0; index < targetCount; index += 1) {
    const slot = getWorkerSlot(index);
    slots.push(slot);
    if (!isSlotReady(slot) && !slot.loading) {
      ensureModelReady(slot);
    }
  }
  return slots;
}

function warmLiveWorkerPool() {
  getLiveWorkerSlots(true);
  renderLiveScanStatus();
}

function getLiveWorkerTargetCount() {
  if (state.settings.modelId !== DEFAULT_MODEL_ID) {
    return 1;
  }
  return LIVE_TESSERACT_WORKER_LIMIT;
}

function getLiveTesseractWorkerLimit() {
  const cores = Number(navigator.hardwareConcurrency || 4);
  if (cores >= 8) {
    return 4;
  }
  if (cores >= 4) {
    return 3;
  }
  return 2;
}

function handleRecognizedText(text, payload = {}, isLiveScan = Boolean(state.loopTimer)) {
  const nextText = isLiveScan ? updateLiveFusion(text, payload) : text;
  analyzeAndRender(nextText, isLiveScan ? "live" : "ocr");
  if (state.settings.autoCopy && nextText) {
    els.manualText.value = nextText;
  }
  if (isLiveScan) {
    recordLiveProcessedFrame();
  }
}

function getRuntimeResultLabel(durationMs, isLiveScan = Boolean(state.loopTimer)) {
  const duration = durationMs ? formatDuration(durationMs) : "";
  if (!isLiveScan) {
    return duration ? `OCR ${duration}` : "OCR offline bereit";
  }

  const readyWorkers = getReadyWorkerCount();
  return duration ? `Live ${duration} · ${readyWorkers} OCR` : `Live-OCR · ${readyWorkers} OCR`;
}

function getReadyWorkerCount() {
  return state.workerPool.filter((slot) => isSlotReady(slot)).length;
}

function createLiveFusionState() {
  return {
    frames: [],
    mergedText: "",
  };
}

function resetLiveFusion() {
  state.liveFusion = createLiveFusionState();
}

function updateLiveFusion(text, payload = {}) {
  const cleanedText = cleanupFusionText(text);
  const now = performance.now();
  if (cleanedText) {
    state.liveFusion.frames.push({
      text: cleanedText,
      confidence: Number(payload.confidence || 0),
      timestamp: now,
      quality: scoreTextQuality(cleanedText, payload.confidence),
    });
  }

  state.liveFusion.frames = state.liveFusion.frames
    .filter((frame) => now - frame.timestamp <= LIVE_RESULT_WINDOW_MS)
    .slice(-LIVE_RESULT_MAX_FRAMES);
  state.liveFusion.mergedText = mergeLiveTextFrames(state.liveFusion.frames);
  return state.liveFusion.mergedText;
}

function cleanupFusionText(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function mergeLiveTextFrames(frames) {
  if (!frames.length) {
    return "";
  }

  const bestFrame = frames.reduce((best, frame) => (frame.quality > best.quality ? frame : best), frames[0]);
  const lines = [];
  addUniqueFusionLines(lines, bestFrame.text, bestFrame.quality);

  for (const frame of frames) {
    if (frame === bestFrame) {
      continue;
    }
    addUniqueFusionLines(lines, frame.text, frame.quality);
  }

  return lines
    .sort((left, right) => left.firstSeen - right.firstSeen)
    .map((line) => line.text)
    .join("\n")
    .trim();
}

function addUniqueFusionLines(lines, text, quality) {
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const normalized = normalizeText(line);
    if (normalized.replace(/\s+/g, "").length < 4) {
      continue;
    }

    const existing = lines.find((candidate) => areSimilarFusionLines(candidate.normalized, normalized));
    const lineQuality = scoreTextQuality(line, quality);
    if (existing) {
      if (lineQuality > existing.quality) {
        existing.text = line;
        existing.normalized = normalized;
        existing.quality = lineQuality;
      }
      continue;
    }

    lines.push({
      text: line,
      normalized,
      quality: lineQuality,
      firstSeen: lines.length,
    });
  }
}

function areSimilarFusionLines(left, right) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftCompact = left.replace(/\s+/g, "");
  const rightCompact = right.replace(/\s+/g, "");
  if (leftCompact.length >= 10 && rightCompact.length >= 10) {
    const maxDistance = Math.max(2, Math.round(Math.min(leftCompact.length, rightCompact.length) * 0.12));
    if (levenshteinWithin(leftCompact, rightCompact, maxDistance)) {
      return true;
    }
  }

  const leftTokens = getFusionTokens(left);
  const rightTokens = getFusionTokens(right);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return overlap / Math.min(leftTokens.length, rightTokens.length) >= 0.78;
}

function getFusionTokens(text) {
  return text.split(/\s+/).filter((token) => token.length > 2);
}

function scoreTextQuality(text, confidence = 0) {
  const letterCount = (text.match(/\p{L}/gu) || []).length;
  const digitCount = (text.match(/\p{N}/gu) || []).length;
  const wordCount = text.split(/\s+/).filter((token) => token.length > 2).length;
  const oddCharacterCount = (text.match(/[^\p{L}\p{N}\s.,;:!?%()[\]{}+\-/&äöüÄÖÜß]/gu) || []).length;
  return letterCount + digitCount * 0.35 + wordCount * 3 + Number(confidence || 0) * 0.5 - oddCharacterCount * 4;
}

function createLiveStats() {
  return {
    startedAt: 0,
    submitted: 0,
    processed: 0,
    dropped: 0,
    lastRenderAt: 0,
  };
}

function resetLiveStats() {
  state.liveStats = {
    ...createLiveStats(),
    startedAt: performance.now(),
  };
}

function recordLiveSubmittedFrame() {
  if (!state.loopTimer) {
    return;
  }
  state.liveStats.submitted += 1;
  renderLiveScanStatus();
}

function recordLiveProcessedFrame() {
  state.liveStats.processed += 1;
  renderLiveScanStatus();
}

function recordLiveDroppedFrame() {
  if (!state.loopTimer) {
    return;
  }
  state.liveStats.dropped += 1;
  renderLiveScanStatus();
}

function renderLiveScanStatus(force = false) {
  if (!state.loopTimer) {
    return;
  }

  const now = performance.now();
  if (!force && now - state.liveStats.lastRenderAt < LIVE_STATUS_UPDATE_MS) {
    return;
  }

  state.liveStats.lastRenderAt = now;
  const targetFps = getTargetLiveFps();
  const elapsedSeconds = Math.max(0.1, (now - state.liveStats.startedAt) / 1000);
  const processedFps = state.liveStats.processed / elapsedSeconds;
  const readyWorkers = getReadyWorkerCount();
  els.scanModeLabel.textContent = `Live ${formatFps(processedFps)}/${formatFps(targetFps)} fps · ${readyWorkers} OCR`;
}

function getTargetLiveFps() {
  return Math.min(10, 1000 / Math.max(100, state.settings.intervalMs));
}

function formatFps(value) {
  const rounded = value >= 9.95 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded).replace(".", ",");
}

async function scanCameraFrame(mode = "single") {
  const isLiveScan = mode === "live";
  if (!isLiveScan && state.busy) {
    return;
  }

  if (!state.stream) {
    const cameraStarted = await startCamera();
    if (!cameraStarted) {
      return;
    }
  }

  if (!state.modelReady) {
    state.pendingScanAfterLoad = true;
    await ensureModelReady();
    setResultNotice("unknown", "OCR wird vorbereitet", "Der erste Scan startet, sobald die Texterkennung geladen ist.");
    return;
  }

  if (isLiveScan) {
    warmLiveWorkerPool();
  }

  if (state.capturingFrame) {
    recordLiveDroppedFrame();
    return;
  }

  const slot = reserveWorkerSlot(isLiveScan);
  if (!slot) {
    recordLiveDroppedFrame();
    return;
  }

  state.capturingFrame = true;
  let capture = null;
  try {
    capture = await captureScanImage(isLiveScan);
  } finally {
    state.capturingFrame = false;
  }
  if (!capture?.blob) {
    releaseWorkerSlot(slot);
    setResultNotice("unknown", "Kein Kamerabild", "Die Kamera liefert noch kein stabiles Bild.");
    return;
  }

  setRuntimeStatus(isLiveScan ? "Live-OCR läuft" : "OCR läuft", "warn");
  slot.worker.postMessage({
    type: "scan",
    requestId: slot.requestId,
    image: capture.blob,
    options: {
      ...capture.options,
      allowFallback: !isLiveScan,
    },
  });
  recordLiveSubmittedFrame();
}

async function captureScanImage(isLiveScan = false) {
  const video = els.cameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  const profile = getCurrentScanProfile();
  const crop = getVisibleScanCrop(video, els.scanFrame, profile);
  const targetWidth = getTargetScanWidth(crop, profile, isLiveScan);
  const targetHeight = Math.round((crop.height / crop.width) * targetWidth);
  const canvas = els.captureCanvas;
  canvas.width = targetWidth + OCR_CANVAS_PADDING * 2;
  canvas.height = targetHeight + OCR_CANVAS_PADDING * 2;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.filter = `grayscale(1) contrast(${profile.contrast}) brightness(${profile.brightness})`;
  context.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    OCR_CANVAS_PADDING,
    OCR_CANVAS_PADDING,
    targetWidth,
    targetHeight,
  );
  context.restore();
  normalizeScanImage(context, canvas.width, canvas.height, profile);

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    options: {
      scanProfile: state.settings.scanProfile,
      psm: profile.psm,
      fallbackPsm: profile.fallbackPsm,
      minTextLength: profile.minTextLength,
      minConfidence: profile.minConfidence,
    },
  };
}

function getTargetScanWidth(crop, profile, isLiveScan) {
  const maxWidth = isLiveScan ? profile.liveTargetWidth : profile.targetWidth;
  return Math.min(maxWidth, Math.max(profile.minTargetWidth, Math.round(crop.width)));
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function getVisibleScanCrop(video, frame, profile) {
  const fallback = getFallbackCrop(video, profile);
  if (!frame) {
    return fallback;
  }

  const videoRect = video.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  if (!videoRect.width || !videoRect.height || !frameRect.width || !frameRect.height) {
    return fallback;
  }

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  const viewAspect = videoRect.width / videoRect.height;
  let renderedWidth = videoRect.width;
  let renderedHeight = videoRect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (sourceAspect > viewAspect) {
    renderedWidth = videoRect.height * sourceAspect;
    offsetX = (videoRect.width - renderedWidth) / 2;
  } else {
    renderedHeight = videoRect.width / sourceAspect;
    offsetY = (videoRect.height - renderedHeight) / 2;
  }

  const frameLeft = frameRect.left - videoRect.left - offsetX;
  const frameTop = frameRect.top - videoRect.top - offsetY;
  const scaleX = sourceWidth / renderedWidth;
  const scaleY = sourceHeight / renderedHeight;

  const crop = {
    x: frameLeft * scaleX,
    y: frameTop * scaleY,
    width: frameRect.width * scaleX,
    height: frameRect.height * scaleY,
  };

  return clampCrop(crop, sourceWidth, sourceHeight);
}

function getFallbackCrop(video, profile = getCurrentScanProfile()) {
  const frame = profile.frame;
  return {
    x: Math.round(video.videoWidth * frame.x),
    y: Math.round(video.videoHeight * frame.y),
    width: Math.round(video.videoWidth * frame.width),
    height: Math.round(video.videoHeight * frame.height),
  };
}

function clampCrop(crop, sourceWidth, sourceHeight) {
  const x = Math.max(0, Math.min(sourceWidth - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(sourceHeight - 1, Math.round(crop.y)));
  const width = Math.max(1, Math.min(sourceWidth - x, Math.round(crop.width)));
  const height = Math.max(1, Math.min(sourceHeight - y, Math.round(crop.height)));
  return { x, y, width, height };
}

function normalizeScanImage(context, width, height, profile) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const pixels = width * height;
  const luminance = new Uint8Array(pixels);
  let total = 0;

  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
    const value = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    luminance[pixel] = value;
    total += value;
  }

  const invert = total / pixels < 118;
  const histogram = new Uint32Array(256);
  for (let pixel = 0; pixel < luminance.length; pixel += 1) {
    if (invert) {
      luminance[pixel] = 255 - luminance[pixel];
    }
    histogram[luminance[pixel]] += 1;
  }

  stretchLuminance(luminance, histogram, pixels);
  const binary = adaptiveThreshold(luminance, width, height, profile);
  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
    const value = binary[pixel];
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

function stretchLuminance(luminance, histogram, pixels) {
  const low = getHistogramPercentile(histogram, pixels, 0.02);
  const high = getHistogramPercentile(histogram, pixels, 0.985);
  if (high - low < 24) {
    return;
  }

  const scale = 255 / (high - low);
  for (let i = 0; i < luminance.length; i += 1) {
    luminance[i] = clampByte((luminance[i] - low) * scale);
  }
}

function getHistogramPercentile(histogram, totalPixels, percentile) {
  const target = totalPixels * percentile;
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen >= target) {
      return value;
    }
  }
  return histogram.length - 1;
}

function adaptiveThreshold(luminance, width, height, profile) {
  const integralWidth = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  const integralSq = new Float64Array((width + 1) * (height + 1));

  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 1; x <= width; x += 1) {
      const value = luminance[(y - 1) * width + x - 1];
      rowSum += value;
      rowSq += value * value;
      const index = y * integralWidth + x;
      const above = index - integralWidth;
      integral[index] = integral[above] + rowSum;
      integralSq[index] = integralSq[above] + rowSq;
    }
  }

  const binary = new Uint8Array(width * height);
  const radius = Math.max(12, Math.round(Math.min(width, height) * profile.adaptiveRadiusRatio));
  const thresholdBias = profile.thresholdBias;
  const sauvolaK = 0.24;

  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = getIntegralSum(integral, integralWidth, x1, y1, x2, y2);
      const sumSq = getIntegralSum(integralSq, integralWidth, x1, y1, x2, y2);
      const mean = sum / area;
      const variance = Math.max(0, sumSq / area - mean * mean);
      const stddev = Math.sqrt(variance);
      const threshold = mean * (1 + sauvolaK * (stddev / 128 - 1)) - thresholdBias;
      binary[y * width + x] = luminance[y * width + x] > threshold ? 255 : 0;
    }
  }

  return binary;
}

function getIntegralSum(integral, integralWidth, x1, y1, x2, y2) {
  const left = x1;
  const top = y1;
  const right = x2 + 1;
  const bottom = y2 + 1;
  return (
    integral[bottom * integralWidth + right] -
    integral[top * integralWidth + right] -
    integral[bottom * integralWidth + left] +
    integral[top * integralWidth + left]
  );
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toggleLoopScan() {
  if (state.loopTimer) {
    stopLoopScan();
    return;
  }
  startLoopScan();
}

function startLoopScan() {
  resetLiveFusion();
  resetLiveStats();
  els.loopButton.setAttribute("aria-pressed", "true");
  els.loopButton.querySelector("use").setAttribute("href", "#icon-pause");
  els.loopButton.querySelector("span").textContent = "Live stoppen";
  state.loopTimer = window.setInterval(() => scanCameraFrame("live"), state.settings.intervalMs);
  renderLiveScanStatus(true);
  scanCameraFrame("live");
}

function stopLoopScan() {
  if (state.loopTimer) {
    window.clearInterval(state.loopTimer);
    state.loopTimer = null;
  }
  els.loopButton.setAttribute("aria-pressed", "false");
  els.loopButton.querySelector("use").setAttribute("href", "#icon-play");
  els.loopButton.querySelector("span").textContent = "Live-Scan";
  els.scanModeLabel.textContent = "Einzelbild";
}

function setBusy(isBusy) {
  state.busy = isBusy;
  els.body.classList.toggle("is-busy", isBusy);
  els.scanButton.disabled = isBusy;
}

function updateLastScanTime() {
  const date = new Date();
  els.lastScanTime.textContent = date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(durationMs) {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  return `${(durationMs / 1000).toFixed(1).replace(".", ",")} s`;
}

function analyzeAndRender(text, source) {
  const result = analyzeIngredients(text);
  state.lastText = text;
  state.lastMatches = result.matches;
  renderResult(result, text, source);
}

function analyzeIngredients(rawText) {
  const normalized = normalizeText(rawText);
  const safeHits = findPhraseHits(SAFE_PHRASES, normalized);
  const scanText = stripPhrases(normalized, SAFE_PHRASES);

  const matches = [];
  const traceHits = findPhraseHits(TRACE_PATTERNS, normalized);

  for (const rule of GLUTEN_RULES) {
    const terms = findIngredientTerms(rule.terms, scanText);
    if (terms.length) {
      matches.push({ ...rule, terms: [...new Set(terms)] });
    }
  }

  if (state.settings.strictTrace && traceHits.length) {
    matches.push({
      id: "trace",
      label: "Spurenhinweis",
      severity: "warn",
      terms: traceHits,
      note: "Die Verpackung nennt mögliche Spuren glutenhaltiger Zutaten.",
    });
  }

  const uniqueMatches = dedupeMatches(matches);
  const hasDanger = uniqueMatches.some((match) => match.severity === "danger");
  const hasWarn = uniqueMatches.some((match) => match.severity === "warn");
  const compactLength = normalized.replace(/\s+/g, "").length;

  if (!compactLength) {
    return {
      status: "unknown",
      title: "Bereit zum Prüfen",
      message: "Starte Kamera und Modell, oder füge Zutaten manuell ein.",
      matches: [],
      safeHits,
    };
  }

  if (compactLength < 18) {
    return {
      status: "unknown",
      title: "Unklar",
      message: "Der erkannte Text ist zu kurz für eine belastbare Zutatenprüfung.",
      matches: uniqueMatches,
      safeHits,
    };
  }

  if (hasDanger) {
    return {
      status: "danger",
      title: "Gluten gefunden",
      message: "Mindestens ein glutenhaltiger Inhaltsstoff wurde erkannt.",
      matches: uniqueMatches,
      safeHits,
    };
  }

  if (hasWarn) {
    return {
      status: "warn",
      title: "Unklar",
      message: "Es gibt Hinweise, die du auf der Verpackung genauer prüfen solltest.",
      matches: uniqueMatches,
      safeHits,
    };
  }

  if (safeHits.length) {
    return {
      status: "safe",
      title: "Glutenfrei-Hinweis erkannt",
      message: "Es wurde ein glutenfreier Hinweis erkannt und keine glutenhaltige Zutat gefunden.",
      matches: [],
      safeHits,
    };
  }

  return {
    status: "safe",
    title: "Wahrscheinlich glutenfrei",
    message: "Keine bekannten glutenhaltigen Zutaten in diesem Text erkannt.",
    matches: [],
    safeHits,
  };
}

function normalizeText(value) {
  return String(value || "")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPhraseHits(phrases, normalizedText) {
  const foldedText = foldOcrConfusions(normalizedText);
  return phrases.filter((phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    const foldedPhrase = foldOcrConfusions(normalizedPhrase);
    return normalizedText.includes(normalizedPhrase) || foldedText.includes(foldedPhrase);
  });
}

function stripPhrases(normalizedText, phrases) {
  let text = ` ${normalizedText} `;
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    text = text.replaceAll(` ${normalizedPhrase} `, " ");
    text = text.replaceAll(normalizedPhrase, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function findIngredientTerms(terms, scanText) {
  const foldedText = foldOcrConfusions(scanText);
  return terms.filter((term) => {
    const normalizedTerm = normalizeText(term);
    const foldedTerm = foldOcrConfusions(normalizedTerm);
    return (
      containsIngredientTerm(scanText, normalizedTerm) ||
      containsIngredientTerm(foldedText, foldedTerm) ||
      isApproximateTermHit(foldedText, foldedTerm)
    );
  });
}

function containsIngredientTerm(text, term) {
  if (!term) {
    return false;
  }

  if (term === "gluten") {
    return /(^|\s|-)gluten($|\s|-)/u.test(text);
  }

  if (!term.includes(" ") && term.length <= 4) {
    const pattern = new RegExp(`(^|\\s|-)${escapeRegExp(term)}($|\\s|-)`, "u");
    return pattern.test(text);
  }

  return text.includes(term);
}

function foldOcrConfusions(value) {
  return String(value || "")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/\brn/g, "m")
    .replace(/vv/g, "w");
}

function isApproximateTermHit(text, term) {
  if (!term || term.length < 5 || term.includes(" ")) {
    return false;
  }

  const maxDistance = term.length <= 6 ? 1 : 2;
  const tokens = text.split(/\s+/).map((token) => token.replace(/-/g, ""));
  for (const token of tokens) {
    if (token.length < Math.max(4, term.length - maxDistance)) {
      continue;
    }
    if (levenshteinWithin(token, term, maxDistance)) {
      return true;
    }
    if (token.length > term.length) {
      for (let index = 0; index <= token.length - term.length; index += 1) {
        if (levenshteinWithin(token.slice(index, index + term.length), term, maxDistance)) {
          return true;
        }
      }
    }
  }
  return false;
}

function levenshteinWithin(left, right, maxDistance) {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return false;
  }

  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowBest = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const cost = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
      current[rightIndex] = cost;
      rowBest = Math.min(rowBest, cost);
    }
    if (rowBest > maxDistance) {
      return false;
    }
    previous = current;
  }

  return previous[right.length] <= maxDistance;
}

function dedupeMatches(matches) {
  const byId = new Map();
  for (const match of matches) {
    if (!byId.has(match.id)) {
      byId.set(match.id, match);
      continue;
    }
    const existing = byId.get(match.id);
    existing.terms = [...new Set([...existing.terms, ...match.terms])];
  }
  return [...byId.values()];
}

function renderResult(result, text) {
  const statusClass = `result-panel result-panel--${result.status}`;
  els.resultPanel.className = statusClass;
  els.resultTitle.textContent = result.title;
  els.resultMessage.textContent = result.message;

  const iconHref =
    result.status === "danger"
      ? "#icon-alert"
      : result.status === "safe"
        ? "#icon-check"
        : result.status === "warn"
          ? "#icon-alert"
          : "#icon-refresh";
  els.resultIcon.innerHTML = `<svg><use href="${iconHref}"></use></svg>`;

  renderMatches(result);
  renderHighlightedText(text, result.matches);
}

function renderMatches(result) {
  els.matchCount.textContent = String(result.matches.length || result.safeHits?.length || 0);
  els.matchesList.replaceChildren();

  if (!result.matches.length) {
    const pill = document.createElement("span");
    pill.className = result.safeHits?.length ? "match-pill match-pill--safe" : "empty-pill";
    pill.textContent = result.safeHits?.length ? result.safeHits[0] : "Keine Treffer";
    els.matchesList.append(pill);
    return;
  }

  for (const match of result.matches) {
    const pill = document.createElement("span");
    pill.className = `match-pill match-pill--${match.severity}`;
    pill.title = match.note;
    pill.textContent = `${match.label}: ${match.terms.slice(0, 3).join(", ")}`;
    els.matchesList.append(pill);
  }
}

function renderHighlightedText(text, matches) {
  if (!text.trim()) {
    els.highlightedText.textContent = "Noch kein OCR-Text.";
    return;
  }

  const terms = matches.flatMap((match) =>
    match.terms.map((term) => ({
      term,
      severity: match.severity,
    })),
  );

  if (!terms.length) {
    els.highlightedText.textContent = text;
    return;
  }

  const escapedTerms = terms
    .map(({ term }) => escapeRegExp(term))
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${escapedTerms.join("|")})`, "giu");
  const fragments = [];
  let lastIndex = 0;

  text.replace(pattern, (match, _group, offset) => {
    if (offset > lastIndex) {
      fragments.push(document.createTextNode(text.slice(lastIndex, offset)));
    }
    const normalizedMatch = normalizeText(match);
    const termMeta = terms.find((item) => normalizeText(item.term) === normalizedMatch) || terms[0];
    const mark = document.createElement("mark");
    mark.className = termMeta.severity;
    mark.textContent = match;
    fragments.push(mark);
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    fragments.push(document.createTextNode(text.slice(lastIndex)));
  }

  els.highlightedText.replaceChildren(...fragments);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setResultNotice(status, title, message) {
  renderResult({ status, title, message, matches: [], safeHits: [] }, state.lastText);
}

async function copyRecognizedText() {
  const text = state.lastText || els.highlightedText.textContent;
  if (!text?.trim() || !navigator.clipboard) {
    return;
  }
  await navigator.clipboard.writeText(text);
  els.copyTextButton.title = "Kopiert";
  window.setTimeout(() => {
    els.copyTextButton.title = "Text kopieren";
  }, 1200);
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    return "";
  }

  try {
    const isPersisted = await navigator.storage.persist();
    return isPersisted
      ? " Offline-Speicher wurde als persistent markiert."
      : " Der Browser kann Cache bei Speicherknappheit entfernen.";
  } catch {
    return "";
  }
}
