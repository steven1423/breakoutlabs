"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataBadge } from "@/components/badge";
import { boxesToLesions, decodeYolo, letterbox, nms, resolveConfig, type DetectorConfig, type LesionBox } from "@/lib/scan/detector";
import { ANGLES, BAND_LABEL, angleFor, summarize, type Angle, type FrameResult, type ScanSummary } from "@/lib/scan/summarize";
import { zonePolygons } from "@/lib/scan/zones";

/**
 * The consented skin scan. Everything happens on the viewer's device: the face bundle finds the
 * face and its pose, the lesion detector runs on a square crop, and the frames are drawn into
 * in-memory canvases for the evidence panel and never sent anywhere. Only the summary is saved,
 * and only when the person presses Save.
 */

type Props = { subjectType: "creator" | "customer"; subjectId: string; subjectName: string };

type Phase = "consent" | "loading" | "ready" | "done";

/** The parts of @vladmandic/human this component uses. The bundle is loaded from /models/face as a script. */
type HumanFace = { box: [number, number, number, number]; boxScore?: number; score?: number; mesh?: number[][]; rotation?: { angle?: { yaw: number; pitch: number; roll: number } }; real?: number };
type HumanInstance = { load(): Promise<unknown>; warmup(): Promise<unknown>; detect(input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<{ face: HumanFace[] }> };
type HumanCtor = new (config: Record<string, unknown>) => HumanInstance;
/** The wasm-only entry: the default bundle also loads the WebGPU (jsep) runtime, 28 MB we do not serve. */
type OrtModule = typeof import("onnxruntime-web/wasm");
type OrtSession = Awaited<ReturnType<OrtModule["InferenceSession"]["create"]>>;

type Capture = { id: number; result: FrameResult; thumb: string; lesions: LesionBox[] };

const FACE_BASE = "/models/face/";
const ACNE_BASE = "/models/acne/";
const CROP_MARGIN = 1.3;
const DETECTOR_SIDE = 640;

const ANGLE_LABEL: Record<Angle, string> = { front: "Facing the camera", left: "Turned to your left", right: "Turned to your right" };

export function SkinScan({ subjectType, subjectId, subjectName }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("consent");
  const [consented, setConsented] = useState(false);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pose, setPose] = useState<{ yaw: number; pitch: number; angle: Angle | null; found: boolean }>({ yaw: 0, pitch: 0, angle: null, found: false });
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const humanRef = useRef<HumanInstance | null>(null);
  const ortRef = useRef<{ ort: OrtModule; session: OrtSession; cfg: DetectorConfig } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const lastFaceRef = useRef<HumanFace | null>(null);

  const stopCamera = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function loadModels() {
    setPhase("loading");
    setError(null);
    try {
      setStatus("Loading the face model");
      await loadScript(`${FACE_BASE}human.js`);
      const Human = (window as unknown as { Human: { Human: HumanCtor } }).Human.Human;
      const human = new Human({
        modelBasePath: FACE_BASE,
        backend: "webgl",
        cacheSensitivity: 0,
        filter: { enabled: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 1, minConfidence: 0.5, return: false },
          mesh: { enabled: true },
          iris: { enabled: false },
          description: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: true },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
      });
      await human.load();
      await human.warmup();
      humanRef.current = human;

      setStatus("Loading the lesion detector");
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      const manifest = await fetch(`${ACNE_BASE}detector.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const cfg = resolveConfig(manifest);
      const weights = await fetch(`${ACNE_BASE}${cfg.model}`, { method: "HEAD" }).catch(() => null);
      if (!weights || !weights.ok) throw new Error(`The lesion detector is not installed on this server (${cfg.model} is missing). Run pnpm models and reload.`);
      const session = await ort.InferenceSession.create(`${ACNE_BASE}${cfg.model}`, { executionProviders: ["wasm"] });
      ortRef.current = { ort, session, cfg };

      setStatus("Starting the camera");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("");
      setPhase("ready");
      loopRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("consent");
      stopCamera();
    }
  }

  async function tick() {
    const video = videoRef.current;
    const human = humanRef.current;
    if (!video || !human || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(tick);
      return;
    }
    try {
      const res = await human.detect(video);
      const face = res.face[0];
      lastFaceRef.current = face ?? null;
      if (face?.rotation?.angle) {
        const yaw = deg(face.rotation.angle.yaw);
        const pitch = deg(face.rotation.angle.pitch);
        setPose({ yaw, pitch, angle: angleFor(yaw, pitch), found: true });
      } else {
        setPose({ yaw: 0, pitch: 0, angle: null, found: false });
      }
    } catch {
      // A dropped frame is not an error worth surfacing.
    }
    // About twelve frames a second is plenty for a pose gate and keeps the laptop cool.
    setTimeout(() => {
      loopRef.current = requestAnimationFrame(tick);
    }, 80);
  }

  async function capture(angle: Angle) {
    const video = videoRef.current;
    const face = lastFaceRef.current;
    if (!video || !face) return;
    const frame = document.createElement("canvas");
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    frame.getContext("2d")!.drawImage(video, 0, 0);
    await analyse(frame, face, angle);
  }

  async function analyseUpload(files: FileList | null) {
    if (!files || !humanRef.current) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const img = await loadImage(file);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const res = await humanRef.current.detect(canvas);
        const face = res.face[0];
        if (!face) {
          setError(`No face found in ${file.name}; it was not used.`);
          continue;
        }
        const yaw = face.rotation?.angle ? deg(face.rotation.angle.yaw) : 0;
        const pitch = face.rotation?.angle ? deg(face.rotation.angle.pitch) : 0;
        await analyse(canvas, face, angleFor(yaw, pitch) ?? "front");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Crop a square around the face, map the mesh into it, run the detector, and keep the result plus a drawn thumbnail. */
  async function analyse(source: HTMLCanvasElement, face: HumanFace, angle: Angle) {
    const det = ortRef.current;
    if (!det) return;
    setBusy(true);
    setError(null);
    try {
      const [bx, by, bw, bh] = face.box;
      const side = Math.max(bw, bh) * CROP_MARGIN;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const x0 = Math.max(0, Math.round(cx - side / 2));
      const y0 = Math.max(0, Math.round(cy - side / 2));
      const cropPx = Math.round(Math.min(side, source.width - x0, source.height - y0));
      // The detector was measured on 480 to 640 px face crops, so the crop is resampled to 640 whatever its source size.
      const crop = document.createElement("canvas");
      crop.width = DETECTOR_SIDE;
      crop.height = DETECTOR_SIDE;
      const ctx = crop.getContext("2d")!;
      ctx.drawImage(source, x0, y0, cropPx, cropPx, 0, 0, DETECTOR_SIDE, DETECTOR_SIDE);
      const scale = DETECTOR_SIDE / cropPx;
      const polys = zonePolygons(face.mesh ?? [], { offsetX: x0, offsetY: y0, scale });

      const pixels = ctx.getImageData(0, 0, DETECTOR_SIDE, DETECTOR_SIDE);
      const lb = letterbox(pixels, det.cfg.inputSize);
      const input = new det.ort.Tensor("float32", lb.tensor, [1, 3, det.cfg.inputSize, det.cfg.inputSize]);
      const inputName = det.session.inputNames[0];
      const outputName = det.session.outputNames[0];
      const results = await det.session.run({ [inputName]: input });
      const out = results[outputName];
      const raw = decodeYolo(out.data as Float32Array, out.dims, det.cfg.confThreshold, det.cfg.classNames.length);
      const lesions = boxesToLesions(nms(raw, det.cfg.iouThreshold), lb, polys);

      // The evidence thumbnail: the crop with the zone outlines and the detections drawn on it. In memory only.
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(208, 245, 121, 0.9)";
      for (const poly of Object.values(polys)) {
        ctx.beginPath();
        poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.closePath();
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(192, 71, 90, 0.95)";
      for (const l of lesions) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, Math.max(6, l.r), 0, Math.PI * 2);
        ctx.stroke();
      }
      const yaw = face.rotation?.angle ? deg(face.rotation.angle.yaw) : 0;
      const pitch = face.rotation?.angle ? deg(face.rotation.angle.pitch) : 0;
      const result: FrameResult = {
        angle,
        yaw: Math.round(yaw * 10) / 10,
        pitch: Math.round(pitch * 10) / 10,
        faceConfidence: Math.round((face.boxScore ?? face.score ?? 0) * 1000) / 1000,
        real: typeof face.real === "number" ? Math.round(face.real * 1000) / 1000 : null,
        cropPx,
        lesions: lesions.map((l) => ({ zone: l.zone, score: l.score })),
        takenAt: new Date().toISOString(),
      };
      setCaptures((prev) => [...prev.filter((c) => c.result.angle !== angle || prev.length >= ANGLES.length), { id: Date.now(), result, thumb: crop.toDataURL("image/jpeg", 0.8), lesions }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    stopCamera();
    setPhase("done");
  }

  async function save() {
    if (!consentedAt || captures.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const det = ortRef.current;
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, consentedAt, model: `${det?.cfg.model ?? "acne-detector"} ${det?.cfg.trained ?? ""}`.trim(), frames: captures.map((c) => c.result) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSaved({ id: body.scan.id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const summary = summarize(captures.map((c) => c.result));
  const captured = new Set(captures.map((c) => c.result.angle));

  return (
    <section className="mt-6 flex flex-col gap-6">
      {phase === "consent" ? (
        <div className="rounded-panel border border-brand/40 bg-surface p-5">
          <p className="text-18">Before the camera starts</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-15 text-muted">
            <li>The scan is of your own face, on your own device. Frames are analysed in this browser and never uploaded.</li>
            <li>What can be saved is a summary: how many marks the detector found per face zone, at which head angles, and when. Not a picture, not a face signature.</li>
            <li>It is a research detector, not a diagnosis. It is here so your baseline and your 90-day retest can be compared on the same terms.</li>
            <li>You can close this page at any time and nothing is kept.</li>
          </ul>
          <label className="mt-4 flex items-start gap-3 text-15">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-1 accent-brand" />
            <span>I am {subjectName}, this is my own face, and I agree to a scan on these terms.</span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!consented}
              onClick={() => {
                setConsentedAt(new Date().toISOString());
                void loadModels();
              }}
              className="rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand disabled:opacity-60"
            >
              Start the camera
            </button>
            {error ? <span className="text-15 text-accent">{error}</span> : null}
          </div>
        </div>
      ) : null}

      {phase === "loading" ? <p className="text-15 text-muted">{status || "Loading"}. The models are about 16 MB and load once.</p> : null}

      <div className={`grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] ${phase === "ready" ? "" : "hidden"}`}>
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <video ref={videoRef} playsInline muted className="aspect-video w-full -scale-x-100 bg-bg object-cover" />
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-13 text-muted">
            <span>{pose.found ? `Face found. Yaw ${pose.yaw.toFixed(0)}°, pitch ${pose.pitch.toFixed(0)}°${pose.angle ? `: ${ANGLE_LABEL[pose.angle].toLowerCase()}` : ": turn until a button lights up"}` : "Looking for a face. Face the camera in good light."}</span>
            <span>The preview is mirrored; nothing is recorded.</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-15">Capture three angles</p>
          {ANGLES.map((a) => (
            <button
              key={a}
              type="button"
              disabled={busy || pose.angle !== a}
              onClick={() => void capture(a)}
              className={`flex items-center justify-between rounded-control border px-4 py-2 text-left text-15 disabled:opacity-50 ${captured.has(a) ? "border-live" : pose.angle === a ? "border-brand bg-brand/10" : "border-line"}`}
            >
              <span>{ANGLE_LABEL[a]}</span>
              <span className="text-13 text-muted">{captured.has(a) ? "captured, press again to retake" : pose.angle === a ? "ready" : "turn your head"}</span>
            </button>
          ))}
          <label className="mt-2 text-13 text-muted">
            Or use photos from your device (they are analysed here too, not uploaded)
            <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => void analyseUpload(e.target.files)} className="mt-1 block text-13" />
          </label>
          <button type="button" disabled={busy || captures.length === 0} onClick={finish} className="mt-2 rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand disabled:opacity-60">
            {busy ? "Analysing" : `Finish with ${captures.length} ${captures.length === 1 ? "frame" : "frames"}`}
          </button>
          {error ? <p className="text-15 text-accent">{error}</p> : null}
        </div>
      </div>

      {captures.length > 0 ? <Results summary={summary!} captures={captures} phase={phase} saved={saved} busy={busy} onSave={() => void save()} error={phase === "done" ? error : null} /> : null}
    </section>
  );
}

function Results({ summary, captures, phase, saved, busy, onSave, error }: { summary: ScanSummary; captures: Capture[]; phase: Phase; saved: { id: string } | null; busy: boolean; onSave: () => void; error: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Detector reading" value={BAND_LABEL[summary.band]} detail={`${summary.lesionsPerFrame} marks per frame, most in one frame ${summary.lesionsMax}`} accent />
        <Tile label="Frames used" value={String(summary.frames)} detail={summary.angles.map((a) => a).join(", ")} />
        <Tile label="Busiest zone" value={[...summary.perZone].sort((a, b) => b.count - a.count)[0]?.label ?? "–"} detail="Mean marks per frame by zone below" />
        <Tile label="Quality" value={summary.lowResolution || summary.spoofFlag ? "Check" : "Good"} detail={[summary.lowResolution ? "small face crop" : null, summary.spoofFlag ? "low anti-spoof score (advisory)" : null].filter(Boolean).join(", ") || "Crop size and anti-spoof fine"} />
      </div>

      <div className="rounded-panel border border-line bg-surface p-5">
        <p className="text-15">Marks per frame by zone</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {summary.perZone.map((z) => {
            const max = Math.max(1, ...summary.perZone.map((p) => p.count));
            return (
              <li key={z.zone} className="grid grid-cols-[7rem_minmax(0,1fr)_4rem] items-center gap-3 text-13">
                <span className="text-muted">{z.label}</span>
                <span className="h-2 rounded-full bg-raised"><span className="block h-2 rounded-full bg-brand" style={{ width: `${(z.count / max) * 100}%` }} /></span>
                <span className="text-right">{z.count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-panel border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-15">What was analysed</p>
          <DataBadge status="live" reason="On this device; frames are not uploaded" />
        </div>
        <p className="text-13 text-muted">Each crop below is what the detector saw: the five face zones in lime, its detections in coral. These images exist only in this tab.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {captures.map((c) => (
            <li key={c.id} className="rounded-control border border-line p-2 text-13">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.thumb} alt={`${ANGLE_LABEL[c.result.angle]}, ${c.lesions.length} detections`} className="aspect-square w-full rounded-control object-cover" />
              <p className="mt-2">{ANGLE_LABEL[c.result.angle]}</p>
              <p className="text-muted">Yaw {c.result.yaw}°, pitch {c.result.pitch}°. Face {Math.round(c.result.faceConfidence * 100)}%{c.result.real !== null ? `, real ${Math.round(c.result.real * 100)}%` : ""}. Crop {c.result.cropPx}px. {c.lesions.length} detections.</p>
            </li>
          ))}
        </ul>
      </div>

      {phase === "done" ? (
        <div className="flex flex-wrap items-center gap-3">
          {saved ? (
            <span className="text-15 text-live">Saved. The summary above is on your creator page; no frame was uploaded.</span>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={onSave} className="rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand disabled:opacity-60">{busy ? "Saving" : "Save the summary"}</button>
              <span className="text-13 text-muted">Saves the counts, zones, angles and times above. Close the page instead and nothing is kept.</span>
            </>
          )}
          {error ? <span className="text-15 text-accent">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Tile({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <div className={`rounded-panel border bg-surface px-4 py-3 ${accent ? "border-brand" : "border-line"}`}>
      <p className="text-13 text-muted">{label}</p>
      <p className={`text-24 ${accent ? "text-brand" : ""}`}>{value}</p>
      <p className="text-13 text-muted">{detail}</p>
    </div>
  );
}

function deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Could not read ${file.name}`));
    img.src = url;
  });
}
