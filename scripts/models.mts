/**
 * Puts the two large model assets the skin scan needs under public/, where the browser loads them.
 * They are not committed: the 14 MB wasm runtime is copied from node_modules, and the 11 MB lesion
 * detector is copied from a folder you point at (the SkinLoop acne-model bundle) or downloaded
 * from MODEL_URL. GitHub's push protection also mis-reads a byte run inside the ONNX as a token.
 *
 * Usage: pnpm models                      (copies from ./vendor/acne-model if present)
 *        MODEL_DIR=/path/to/acne-model pnpm models
 *        MODEL_URL=https://.../acne-detector-int8.onnx pnpm models
 */
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ORT_DIST = path.resolve("node_modules/onnxruntime-web/dist");
const ORT_OUT = path.resolve("public/ort");
const MODEL_OUT = path.resolve("public/models/acne");
const MODEL_FILE = "acne-detector-int8.onnx";

async function exists(p: string): Promise<boolean> {
  return stat(p).then(() => true, () => false);
}

async function main() {
  await mkdir(ORT_OUT, { recursive: true });
  for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
    await copyFile(path.join(ORT_DIST, f), path.join(ORT_OUT, f));
    console.log(`copied  public/ort/${f}`);
  }

  await mkdir(MODEL_OUT, { recursive: true });
  const target = path.join(MODEL_OUT, MODEL_FILE);
  const dir = process.env.MODEL_DIR ?? path.resolve("vendor/acne-model");
  const source = path.join(dir, MODEL_FILE);
  if (await exists(source)) {
    await copyFile(source, target);
    console.log(`copied  public/models/acne/${MODEL_FILE} from ${dir}`);
    return;
  }
  const url = process.env.MODEL_URL;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MODEL_URL returned ${res.status}`);
    await writeFile(target, Buffer.from(await res.arrayBuffer()));
    console.log(`fetched public/models/acne/${MODEL_FILE}`);
    return;
  }
  console.log(`missing public/models/acne/${MODEL_FILE}: unzip the acne-model bundle to ./vendor/acne-model, or set MODEL_DIR or MODEL_URL. The scan page will say the detector is unavailable until then.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
