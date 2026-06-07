# Zöli-Scan

Statische Offline-first Web App zum Scannen von Zutatenlisten. Die App nutzt die Kamera im Browser, fuehrt OCR lokal mit Tesseract.js bzw. optional Transformers.js aus und prueft den erkannten Text clientseitig gegen glutenhaltige Zutaten.

## Architektur

- Kein Backend, keine API, keine serverseitige Inferenz.
- OCR laeuft in `ocr-worker.js` standardmaessig mit Tesseract.js fuer dichten Etiketttext.
- Der Live-Scan sampelt bis zu 10 Kameraframes pro Sekunde, verteilt OCR-Jobs auf mehrere Tesseract-Worker und verwirft Frames, wenn alle Worker belegt sind, statt eine wachsende Warteschlange aufzubauen.
- Live-Ergebnisse werden ueber ein kurzes Rolling-Fenster fusioniert: aehnliche Zeilen werden dedupliziert, bessere OCR-Varianten ersetzen schwaechere und neue Textfragmente bleiben erhalten, wenn eine runde Verpackung gedreht wird.
- Fuer Dosen und Flaschen gibt es ein eigenes Scan-Profil mit engerem Kameraausschnitt, adaptiver Bildvorverarbeitung und OCR-Fallback bei schwachen Ergebnissen.
- Der zweite OCR-Fallback-Pass bleibt fuer Einzelbilder aktiv, wird im Live-Modus aber uebersprungen, weil die Fusion mehrerer Frames die Gegenpruefung uebernimmt.
- TrOCR (`Xenova/trocr-small-printed` / `Xenova/trocr-base-printed`) bleibt als Fallback auswaehlbar.
- Beim ersten Modellstart werden OCR-WASM-Dateien und Sprach- bzw. Modellgewichte in den Browser-Cache geladen.
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

Beim ersten Start `OCR vorbereiten` ausfuehren. Danach kann die installierte PWA offline laufen, solange der Browser den Cache nicht loescht. Auf mobilen Geraeten die App nach dem Warm-up zum Homescreen hinzufuegen, damit sie im Standalone-Modus startet.

## Hinweise

- Direktes Oeffnen per `file://` kann UI-Dateien anzeigen, ist fuer Kamera, Module und Service Worker aber browserabhaengig und nicht empfohlen.
- Kleine, gebogene oder spiegelnde Zutatenlisten bleiben schwierig fuer Browser-OCR. Das Profil `Dose / Flasche`, gute Beleuchtung und langsames Drehen der Verpackung verbessern die Trefferquote; deshalb gibt es weiterhin die manuelle Textpruefung.
- Die App ist ein technischer Hinweisgeber und ersetzt keine medizinische Beratung oder zertifizierte Glutenfrei-Kennzeichnung.
