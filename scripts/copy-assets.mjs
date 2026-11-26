// Copies onnxruntime-web WASM binaries into public/ort at install/build time.
// They are not committed to git (≈44MB) and come from the pinned npm package.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const src = join(process.cwd(), "node_modules/onnxruntime-web/dist");
const dst = join(process.cwd(), "public/ort");
if (!existsSync(src)) { console.warn("[copy-assets] onnxruntime-web not installed; skipping"); process.exit(0); }
mkdirSync(dst, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  cpSync(join(src, f), join(dst, f));
}
console.log("[copy-assets] onnxruntime-web wasm → public/ort");
