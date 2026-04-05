/**
 * maxrects-packer — WASM-accelerated 2D bin packer with WebWorker parallelism.
 *
 * @example
 * ```ts
 * import init, * as wasm from './pkg/maxrects_packer.js';
 * import { MaxRectsPackerWasm } from 'maxrects-packer';
 *
 * await init();
 * const packer = await MaxRectsPackerWasm.create({
 *   wasm,
 *   wasmUrl: './pkg/maxrects_packer.js',
 *   workerSource: new URL('./worker.js', import.meta.url),
 * });
 *
 * const bins = await packer.addArray(rects);
 * packer.terminate();
 * ```
 */

export { IRectangle, IOption } from "./types";
export {
    BinResult,
    serializeOptions,
    serializeInputRects,
    deserializeChunks,
    serializeWorkerResults,
    deserializeBins
} from "./serialization";
export { WorkerPool, WorkerPoolOptions } from "./worker_pool";
export {
    WasmExports,
    MaxRectsPackerWasmOptions,
    MaxRectsPackerWasm
} from "./packer";
