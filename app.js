const STORAGE_KEY = "zoli-scan-settings";

const DEFAULT_SETTINGS = {
  intervalMs: 4000,
  modelId: "Xenova/trocr-small-printed",
  autoCopy: true,
  strictTrace: true,
};

const GLUTEN_RULES = [
  {
    id: "gluten",
    label: "Gluten",
    severity: "danger",
    terms: ["gluten", "gluteneiweiss", "gluteneiweiß", "glutenprotein"],
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
      "hartweizen",
      "weichweizen",
      "wheat",
      "wheat flour",
      "wheat starch",
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
      "malzextrakt",
      "malzessig",
      "barley",
      "barley malt",
      "malt extract",
      "malted barley",
    ],
    note: "Gerste und Gerstenmalz sind glutenhaltig.",
  },
  {
    id: "rye",
    label: "Roggen",
    severity: "danger",
    terms: ["roggen", "roggenmehl", "rye", "rye flour"],
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
  "may contain gluten",
  "may contain wheat",
  "may contain barley",
  "spuren von gluten",
  "spuren von weizen",
  "spuren von gerste",
];

const els = {
  body: document.body,
  cameraVideo: document.querySelector("#cameraVideo"),
  captureCanvas: document.querySelector("#captureCanvas"),
  cameraEmpty: document.querySelector("#cameraEmpty"),
  cameraStage: document.querySelector(".camera-stage"),
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
  intervalSelect: document.querySelector("#intervalSelect"),
  modelSelect: document.querySelector("#modelSelect"),
  autoCopyToggle: document.querySelector("#autoCopyToggle"),
  strictTraceToggle: document.querySelector("#strictTraceToggle"),
};

const state = {
  settings: loadSettings(),
  worker: null,
  workerReady: false,
  modelReady: false,
  loadingModel: false,
  busy: false,
  stream: null,
  loopTimer: null,
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
    saveSettings();
    setRuntimeStatus("Modell nicht geladen", "neutral");
    setProgress(0, "Modell wartet", "Das ausgewählte OCR-Modell ist noch nicht vorbereitet.");
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
  els.intervalSelect.value = String(state.settings.intervalMs);
  els.modelSelect.value = state.settings.modelId;
  els.autoCopyToggle.checked = state.settings.autoCopy;
  els.strictTraceToggle.checked = state.settings.strictTrace;
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
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Kamera-API nicht verfügbar");
    setResultNotice("unknown", "Kamera nicht verfügbar", "Nutze die manuelle Prüfung auf diesem Gerät.");
    return false;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
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

async function ensureModelReady() {
  if (state.modelReady) {
    return true;
  }
  if (state.loadingModel) {
    return false;
  }

  state.loadingModel = true;
  setRuntimeStatus("Modell lädt", "warn");
  setProgress(4, "Modell lädt", "Transformers.js startet im Web Worker.");
  els.modelButton.disabled = true;

  try {
    const worker = getWorker();
    worker.postMessage({ type: "load", modelId: state.settings.modelId });
    return false;
  } catch (error) {
    state.loadingModel = false;
    els.modelButton.disabled = false;
    setRuntimeStatus("Modellfehler", "danger");
    setProgress(0, "Modellfehler", error.message);
    return false;
  }
}

function getWorker() {
  if (state.worker) {
    return state.worker;
  }

  state.worker = new Worker("./ocr-worker.js", { type: "module" });
  state.worker.addEventListener("message", handleWorkerMessage);
  state.worker.addEventListener("error", (event) => {
    console.error("Worker error", event.message);
    state.loadingModel = false;
    state.busy = false;
    setBusy(false);
    setRuntimeStatus("Workerfehler", "danger");
    setProgress(0, "Workerfehler", event.message || "OCR-Worker konnte nicht starten.");
  });
  return state.worker;
}

function destroyWorker() {
  if (!state.worker) {
    return;
  }
  state.worker.postMessage({ type: "dispose" });
  state.worker.terminate();
  state.worker = null;
  state.modelReady = false;
  state.loadingModel = false;
  state.busy = false;
}

async function handleWorkerMessage(event) {
  const { type, payload } = event.data || {};

  if (type === "progress") {
    const progress = Math.max(5, Math.min(99, Math.round(payload.progress || 0)));
    setProgress(progress, payload.label || "Modell lädt", payload.detail || "Dateien werden im Browser-Cache gespeichert.");
    return;
  }

  if (type === "ready") {
    state.modelReady = true;
    state.loadingModel = false;
    els.modelButton.disabled = false;
    const storageNote = await requestPersistentStorage();
    setRuntimeStatus("Modell offline bereit", "ready");
    setProgress(100, "Modell bereit", `${payload.modelId} ist im Browser verfügbar.${storageNote}`);
    return;
  }

  if (type === "result") {
    state.busy = false;
    setBusy(false);
    setRuntimeStatus("Modell offline bereit", "ready");
    const text = payload.text?.trim() || "";
    updateLastScanTime();
    analyzeAndRender(text, "ocr");
    if (state.settings.autoCopy && text) {
      els.manualText.value = text;
    }
    return;
  }

  if (type === "error") {
    state.loadingModel = false;
    state.busy = false;
    els.modelButton.disabled = false;
    setBusy(false);
    setRuntimeStatus("OCR-Fehler", "danger");
    setProgress(0, "OCR-Fehler", payload.message || "Unbekannter Fehler.");
    setResultNotice("unknown", "OCR nicht möglich", payload.message || "Nutze die manuelle Prüfung.");
  }
}

function setProgress(value, label, detail) {
  els.modelProgress.value = value;
  els.modelProgressLabel.textContent = label;
  els.modelProgressDetail.textContent = detail;
}

async function scanCameraFrame() {
  if (state.busy) {
    return;
  }

  if (!state.stream) {
    const cameraStarted = await startCamera();
    if (!cameraStarted) {
      return;
    }
  }

  if (!state.modelReady) {
    await ensureModelReady();
    setResultNotice("unknown", "Modell wird vorbereitet", "Der erste Scan startet, sobald das OCR-Modell geladen ist.");
    return;
  }

  const blob = await captureScanBlob();
  if (!blob) {
    setResultNotice("unknown", "Kein Kamerabild", "Die Kamera liefert noch kein stabiles Bild.");
    return;
  }

  state.busy = true;
  setBusy(true);
  setRuntimeStatus("OCR läuft", "warn");
  getWorker().postMessage({ type: "scan", image: blob });
}

async function captureScanBlob() {
  const video = els.cameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    return null;
  }

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const cropWidth = Math.round(sourceWidth * 0.82);
  const cropHeight = Math.round(sourceHeight * 0.48);
  const cropX = Math.round((sourceWidth - cropWidth) / 2);
  const cropY = Math.round((sourceHeight - cropHeight) / 2);

  const targetWidth = 1280;
  const targetHeight = Math.round((cropHeight / cropWidth) * targetWidth);
  const canvas = els.captureCanvas;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.save();
  context.filter = "grayscale(1) contrast(1.28) brightness(1.06)";
  context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
  context.restore();

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

function toggleLoopScan() {
  if (state.loopTimer) {
    stopLoopScan();
    return;
  }
  startLoopScan();
}

function startLoopScan() {
  els.loopButton.setAttribute("aria-pressed", "true");
  els.loopButton.querySelector("use").setAttribute("href", "#icon-pause");
  els.loopButton.querySelector("span").textContent = "Live stoppen";
  els.scanModeLabel.textContent = "Live-Scan";
  scanCameraFrame();
  state.loopTimer = window.setInterval(() => scanCameraFrame(), state.settings.intervalMs);
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

function analyzeAndRender(text, source) {
  const result = analyzeIngredients(text);
  state.lastText = text;
  state.lastMatches = result.matches;
  renderResult(result, text, source);
}

function analyzeIngredients(rawText) {
  const normalized = normalizeText(rawText);
  const safeHits = SAFE_PHRASES.filter((phrase) => normalized.includes(normalizeText(phrase)));
  let scanText = normalized;
  for (const phrase of SAFE_PHRASES) {
    scanText = scanText.replaceAll(normalizeText(phrase), " ");
  }

  const matches = [];
  const traceHits = TRACE_PATTERNS.filter((pattern) => normalized.includes(normalizeText(pattern)));

  for (const rule of GLUTEN_RULES) {
    const terms = rule.terms.filter((term) => scanText.includes(normalizeText(term)));
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
