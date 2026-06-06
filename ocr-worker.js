const DEFAULT_MODEL_ID = "tesseract-deu";
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js";
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

let activeModelId = null;
let activeEngine = null;
let loadPromise = null;

let tesseractModulePromise = null;
let tesseractWorker = null;

let transformersModulePromise = null;
let trocrRecognizer = null;

self.addEventListener("message", async (event) => {
  const { type, modelId, image, options } = event.data || {};

  try {
    if (type === "load") {
      await loadRecognizer(modelId);
      return;
    }

    if (type === "scan") {
      await recognizeImage(image, options);
      return;
    }

    if (type === "dispose") {
      await disposeRecognizer();
    }
  } catch (error) {
    loadPromise = null;
    postMessage({
      type: "error",
      payload: {
        message: error?.message || "OCR konnte nicht ausgeführt werden.",
      },
    });
  }
});

async function loadRecognizer(modelId = DEFAULT_MODEL_ID) {
  const config = getEngineConfig(modelId);

  if (isRecognizerReady(config)) {
    postReady(config);
    return getActiveRecognizer(config);
  }

  if (loadPromise && activeModelId === config.id) {
    return loadPromise;
  }

  await disposeRecognizer();
  activeModelId = config.id;
  activeEngine = config.engine;

  loadPromise =
    config.engine === "tesseract" ? loadTesseractRecognizer(config) : loadTrocrRecognizer(config);
  return loadPromise;
}

function getEngineConfig(modelId = DEFAULT_MODEL_ID) {
  if (!modelId || modelId === "tesseract-deu") {
    return {
      id: "tesseract-deu",
      engine: "tesseract",
      label: "Tesseract Deutsch",
      languages: "deu+eng",
    };
  }

  return {
    id: modelId,
    engine: "trocr",
    label: modelId,
  };
}

function isRecognizerReady(config) {
  return (
    activeModelId === config.id &&
    ((config.engine === "tesseract" && tesseractWorker) ||
      (config.engine === "trocr" && trocrRecognizer))
  );
}

function getActiveRecognizer(config) {
  return config.engine === "tesseract" ? tesseractWorker : trocrRecognizer;
}

async function loadTesseractRecognizer(config) {
  postMessage({
    type: "progress",
    payload: {
      progress: 8,
      label: "OCR lädt",
      detail: "Tesseract.js wird vorbereitet.",
    },
  });

  const tesseract = await getTesseractModule();
  const createWorker = tesseract.createWorker || tesseract.default?.createWorker;
  if (!createWorker) {
    throw new Error("Tesseract.js konnte nicht initialisiert werden.");
  }
  const worker = await createWorker(config.languages, 1, {
    logger: (progress) => {
      postMessage({
        type: "progress",
        payload: normalizeTesseractProgress(progress),
      });
    },
  });

  await worker.setParameters({
    tessedit_pageseg_mode: "4",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_do_invert: "0",
  });

  tesseractWorker = worker;
  loadPromise = null;
  postReady(config);
  return worker;
}

async function loadTrocrRecognizer(config) {
  const { env, pipeline } = await getTransformersModule();
  env.useBrowserCache = true;
  env.useWasmCache = true;
  env.cacheKey = "zoli-scan-transformers-cache";

  trocrRecognizer = await pipeline("image-to-text", config.id, {
    dtype: "q8",
    progress_callback: (progress) => {
      postMessage({
        type: "progress",
        payload: normalizeTransformersProgress(progress),
      });
    },
  });

  loadPromise = null;
  postReady(config);
  return trocrRecognizer;
}

async function recognizeImage(blob, options = {}) {
  const config = getEngineConfig(activeModelId || DEFAULT_MODEL_ID);
  const recognizer = await loadRecognizer(config.id);
  const startedAt = performance.now();
  const text =
    config.engine === "tesseract"
      ? await recognizeWithTesseract(recognizer, blob, options)
      : await recognizeWithTrocr(recognizer, blob);

  postMessage({
    type: "result",
    payload: {
      text: cleanupText(text),
      durationMs: Math.round(performance.now() - startedAt),
      modelId: config.id,
      engine: config.engine,
    },
  });
}

async function recognizeWithTesseract(worker, blob, options = {}) {
  const primaryPsm = String(options.psm || "4");
  const fallbackPsm = String(options.fallbackPsm || "11");
  const primary = await runTesseractPass(worker, blob, primaryPsm);

  if (!shouldRunTesseractFallback(primary, options, primaryPsm, fallbackPsm)) {
    return primary.text;
  }

  postMessage({
    type: "progress",
    payload: {
      progress: 84,
      label: "Text wird gegengeprüft",
      detail: "Ein zweiter Layout-Modus wird für schwachen OCR-Text getestet.",
    },
  });

  const fallback = await runTesseractPass(worker, blob, fallbackPsm);
  return chooseTesseractCandidate(primary, fallback).text;
}

async function runTesseractPass(worker, blob, pageSegMode) {
  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
  });
  const result = await worker.recognize(blob);
  const text = cleanupText(result?.data?.text || "");
  return {
    text,
    confidence: Number(result?.data?.confidence || 0),
    pageSegMode,
  };
}

function shouldRunTesseractFallback(candidate, options, primaryPsm, fallbackPsm) {
  if (!fallbackPsm || primaryPsm === fallbackPsm) {
    return false;
  }

  const compactLength = candidate.text.replace(/\s+/g, "").length;
  const minTextLength = Number(options.minTextLength || 30);
  const minConfidence = Number(options.minConfidence || 40);
  return compactLength < minTextLength || candidate.confidence < minConfidence;
}

function chooseTesseractCandidate(primary, fallback) {
  return scoreTesseractCandidate(fallback) > scoreTesseractCandidate(primary) ? fallback : primary;
}

function scoreTesseractCandidate(candidate) {
  const text = candidate.text || "";
  const letterCount = (text.match(/\p{L}/gu) || []).length;
  const tokenCount = text.split(/\s+/).filter((token) => token.length > 2).length;
  const oddCharacterCount = (text.match(/[^\p{L}\p{N}\s.,;:!?%()[\]{}+\-/&äöüÄÖÜß]/gu) || [])
    .length;
  return letterCount + tokenCount * 4 + Math.max(0, candidate.confidence) * 0.7 - oddCharacterCount * 3;
}

async function recognizeWithTrocr(pipe, blob) {
  const { RawImage } = await getTransformersModule();
  const image = await RawImage.fromBlob(blob);
  const output = await pipe(image, {
    max_new_tokens: 128,
  });
  return extractGeneratedText(output);
}

async function disposeRecognizer() {
  const cleanup = [];
  if (tesseractWorker?.terminate) {
    cleanup.push(tesseractWorker.terminate());
  }
  if (trocrRecognizer?.dispose) {
    cleanup.push(trocrRecognizer.dispose());
  }
  await Promise.allSettled(cleanup);
  tesseractWorker = null;
  trocrRecognizer = null;
  activeModelId = null;
  activeEngine = null;
  loadPromise = null;
}

function getTesseractModule() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import(TESSERACT_URL);
  }
  return tesseractModulePromise;
}

function getTransformersModule() {
  if (!transformersModulePromise) {
    transformersModulePromise = import(TRANSFORMERS_URL);
  }
  return transformersModulePromise;
}

function postReady(config) {
  postMessage({
    type: "ready",
    payload: {
      modelId: config.label,
      engine: config.engine,
    },
  });
}

function normalizeTesseractProgress(progress) {
  const status = progress?.status || "loading";
  const rawProgress = typeof progress?.progress === "number" ? progress.progress * 100 : 0;
  const progressText = status === "recognizing text" ? "Text wird gelesen" : "OCR lädt";

  return {
    progress: rawProgress,
    label: progressText,
    detail: status,
  };
}

function normalizeTransformersProgress(progress) {
  const status = progress?.status || "loading";
  const file = progress?.file ? String(progress.file).split("/").pop() : "";
  const rawProgress =
    typeof progress?.progress === "number"
      ? progress.progress
      : typeof progress?.loaded === "number" && typeof progress?.total === "number"
        ? (progress.loaded / progress.total) * 100
        : 0;

  return {
    progress: rawProgress,
    label: status === "done" ? "Datei geladen" : "Modell lädt",
    detail: file || "Modelldateien werden im Browser-Cache gespeichert.",
  };
}

function cleanupText(text) {
  return String(text || "")
    .replace(/([A-Za-zÄÖÜäöüß])-+\s*\n\s*([A-Za-zÄÖÜäöüß])/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractGeneratedText(output) {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return output
      .map((item) => item?.generated_text || item?.text || "")
      .filter(Boolean)
      .join("\n");
  }

  return output?.generated_text || output?.text || "";
}
