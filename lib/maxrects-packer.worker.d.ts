/**
 * WebWorker entry point for parallel rectangle packing.
 *
 * The glue code is bundled into this worker by rollup. The main thread
 * sends the WASM binary once; the worker instantiates it synchronously.
 *
 * Protocol:
 *   Main → Worker: { type: 'init', wasmBinary: ArrayBuffer }
 *   Worker → Main: { type: 'ready' }
 *
 *   Main → Worker: { type: 'process', chunk: Uint8Array, width, height, padding, options }
 *   Worker → Main: { type: 'result', data: Uint8Array }
 *   Worker → Main: { type: 'error', message: string }
 */
export {};
