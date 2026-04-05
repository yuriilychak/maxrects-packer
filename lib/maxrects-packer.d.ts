/**
 * maxrects-packer — WASM-accelerated 2D bin packer with WebWorker parallelism.
 *
 * @example
 * ```ts
 * import { MaxRectsPackerWasm } from 'maxrects-packer';
 *
 * const packer = await MaxRectsPackerWasm.create({
 *   wasmUrl: '/maxrects_packer_bg.wasm',
 *   workerSource: new URL('./worker.js', import.meta.url),
 * });
 *
 * const bins = await packer.addArray(rects);
 * packer.terminate();
 * ```
 */
export { IRectangle, IOption } from "./types";
export { BinResult, serializeOptions, serializeInputRects, deserializeChunks, serializeWorkerResults, deserializeBins } from "./serialization";
export { WorkerPool, WorkerPoolOptions } from "./worker_pool";
export { MaxRectsPackerWasmOptions, MaxRectsPackerWasm } from "./packer";
export { initWasm, initSync, MaxRectsPacker, process_chunk, prepare_chunks, merge_results } from "./wasm_glue.js";
export { default as initWasmDefault } from "./wasm_glue.js";
