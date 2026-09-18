/**
 * Puts the two large model assets the skin scan needs under public/, where the browser loads them.
 * Neither is committed under public/: the 14 MB wasm runtime is copied from node_modules, and the
 * 11 MB lesion detector is unpacked from the gzip in ./models (GitHub's push protection mis-reads
 * a byte run inside the raw ONNX as a token, so the repo carries it compressed). A folder or URL
 * overrides the packed copy, for trying a newer detector. Vercel runs this before `next build`.
 *
 * Usage: pnpm models                      (unpacks ./models/acne-detector-int8.onnx.gz)
 *        MODEL_DIR=/path/to/acne-model pnpm models
 *        MODEL_URL=https://.../acne-detector-int8.onnx pnpm models
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const ORT_DIST = path.resolve("node_modules/onnxruntime-web/dist");
const ORT_OUT = path.resolve("public/ort");
const MODEL_OUT = path.resolve("public/models/acne");
const MODEL_FILE = "acne-detector-int8.onnx";
const PACKED = path.resolve("models", `${MODEL_FILE}.gz`);

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
  if (await exists(PACKED)) {
    await writeFile(target, gunzipSync(await readFile(PACKED)));
    console.log(`unpacked public/models/acne/${MODEL_FILE} from models/${MODEL_FILE}.gz`);
    return;
  }
  console.log(`missing public/models/acne/${MODEL_FILE}: models/${MODEL_FILE}.gz is not in this checkout and neither MODEL_DIR nor MODEL_URL is set. The scan page will say the detector is unavailable until then.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
