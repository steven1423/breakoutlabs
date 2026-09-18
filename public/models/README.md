# Models served to the browser

Everything here runs on the viewer's own device; nothing is uploaded to run it.

The two large binaries are not committed under `public/`: `pnpm models` copies the onnxruntime wasm runtime into
`public/ort/` from node_modules and unpacks the lesion detector into `acne/` from `models/acne-detector-int8.onnx.gz`
at the repo root (`MODEL_DIR` or `MODEL_URL` override it).

- `face/human.js`, `face/blazeface.*`, `face/facemesh.*`, `face/antispoof.*` — @vladmandic/human 3.3.6 (MIT) with the
  MediaPipe BlazeFace and FaceMesh conversions (Apache-2.0). Face detection, the 468-point mesh and head pose, and the
  advisory "is this a photo of a screen" check. The bundle's face-descriptor model (age, gender, identity embedding) is
  deliberately not included: the scan needs to find a face, not recognise one.
- `acne/acne-detector-int8.onnx`, `acne/detector.json` — the SkinLoop lesion detector, YOLOv8s exported to ONNX int8,
  trained on ACNE04 Detection v5 (CC BY 4.0; ACNE04 is released for research), six Roboflow Universe acne sets
  (CC BY 4.0 / MIT / public domain) and SCIN pseudo-labels. Held-out mAP50 0.33. It is a proxy for lesion count and is
  labelled as such everywhere it appears.
