# Zöli-Scan

Statische Offline-first Web App zum Scannen von Zutatenlisten. Die App nutzt die Kamera im Browser, fuehrt OCR lokal mit Transformers.js aus und prueft den erkannten Text clientseitig gegen glutenhaltige Zutaten.

## Architektur

- Kein Backend, keine API, keine serverseitige Inferenz.
- OCR laeuft in `ocr-worker.js` mit Transformers.js und `Xenova/trocr-small-printed`.
- Beim ersten Modellstart werden Transformers.js, ONNX/WASM-Dateien und Modellgewichte in den Browser-Cache geladen.
- `sw.js` cached die App-Shell, PWA-Icons und runtime-nahe Ressourcen fuer spaetere Offline-Nutzung.
- Nach erfolgreichem Modell-Warm-up fragt die App persistenten Browser-Speicher an, damit mobile Browser den Cache seltener entfernen.
- Die Gluten-Pruefung ist regelbasiert in `app.js`, damit keine Zutatenliste an einen Server gesendet wird.

## Lokal starten

Kamera und Service Worker brauchen einen Secure Context. Fuer lokale Tests reicht `localhost`:

```bash
python3 -m http.server 4174 --bind 127.0.0.1
```

Dann im Browser oeffnen:

```text
http://127.0.0.1:4174
```

Beim ersten Start `Modell vorbereiten` ausfuehren. Danach kann die installierte PWA offline laufen, solange der Browser den Cache nicht loescht. Auf mobilen Geraeten die App nach dem Warm-up zum Homescreen hinzufuegen, damit sie im Standalone-Modus startet.

## Hinweise

- Direktes Oeffnen per `file://` kann UI-Dateien anzeigen, ist fuer Kamera, Module und Service Worker aber browserabhaengig und nicht empfohlen.
- Kleine, gebogene oder spiegelnde Zutatenlisten bleiben schwierig fuer TrOCR. Deshalb gibt es die manuelle Textpruefung.
- Die App ist ein technischer Hinweisgeber und ersetzt keine medizinische Beratung oder zertifizierte Glutenfrei-Kennzeichnung.
