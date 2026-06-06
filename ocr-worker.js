import { env, pipeline, RawImage } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.useBrowserCache = true;
env.useWasmCache = true;
env.cacheKey = "zoli-scan-transformers-cache";

let recognizer = null;
let recognizerPromise = null;
let activeModelId = null;

self.addEventListener("message", async (event) => {
  const { type, modelId, image } = event.data || {};

  try {
    if (type === "load") {
      await loadRecognizer(modelId);
      return;
    }

    if (type === "scan") {
      await recognizeImage(image);
      return;
    }

    if (type === "dispose") {
      await disposeRecognizer();
    }
  } catch (error) {
    postMessage({
      type: "error",
      payload: {
        message: error?.message || "OCR konnte nicht ausgeführt werden.",
      },
    });
  }
});

async function loadRecognizer(modelId = "Xenova/trocr-small-printed") {
  if (recognizer && activeModelId === modelId) {
    postMessage({ type: "ready", payload: { modelId } });
    return recognizer;
  }

  if (recognizerPromise && activeModelId === modelId) {
    return recognizerPromise;
  }

  await disposeRecognizer();
  activeModelId = modelId;

  recognizerPromise = pipeline("image-to-text", modelId, {
    dtype: "q8",
    progress_callback: (progress) => {
      postMessage({
        type: "progress",
        payload: normalizeProgress(progress),
      });
    },
  }).then((pipe) => {
    recognizer = pipe;
    postMessage({ type: "ready", payload: { modelId } });
    return pipe;
  });

  return recognizerPromise;
}

async function recognizeImage(blob) {
  const pipe = await loadRecognizer(activeModelId || "Xenova/trocr-small-printed");
  const startedAt = performance.now();
  const image = await RawImage.fromBlob(blob);
  const output = await pipe(image, {
    max_new_tokens: 128,
  });
  postMessage({
    type: "result",
    payload: {
      text: extractGeneratedText(output),
      durationMs: Math.round(performance.now() - startedAt),
    },
  });
}

async function disposeRecognizer() {
  if (recognizer?.dispose) {
    await recognizer.dispose();
  }
  recognizer = null;
  recognizerPromise = null;
}

function normalizeProgress(progress) {
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
