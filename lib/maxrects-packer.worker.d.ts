/**
 * WebWorker entry point for parallel rectangle packing.
 *
 * This worker loads a WASM module and processes rectangle chunks
 * using the `process_chunk` export.
 *
 * Bundle this file as a separate worker entry point. The main thread
 * sends an 'init' message with the WASM module URL, then 'process'
 * messages with chunk data.
 *
 * Protocol:
 *   Main → Worker: { type: 'init', wasmUrl: string }
 *   Worker → Main: { type: 'ready' }
 *
 *   Main → Worker: { type: 'process', chunk: Uint8Array, width, height, padding, options }
 *   Worker → Main: { type: 'result', data: Uint8Array }
 *   Worker → Main: { type: 'error', message: string }
 */
declare const ctx: Worker;
declare let processChunk: ((chunk: Uint8Array, w: number, h: number, p: number, o: number) => Uint8Array) | null;
