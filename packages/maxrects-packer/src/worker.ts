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

import { initSync, process_chunk } from "./wasm_glue.js";

const ctx: Worker = self as any;

let ready = false;

ctx.onmessage = (e: MessageEvent) => {
    const { type } = e.data;

    if (type === 'init') {
        try {
            initSync(e.data.wasmBinary);
            ready = true;
            ctx.postMessage({ type: 'ready' });
        } catch (err: any) {
            ctx.postMessage({ type: 'error', message: err.message || String(err) });
        }
    } else if (type === 'process') {
        try {
            if (!ready) throw new Error('Worker not initialized');
            const { chunk, width, height, padding, options } = e.data;
            const result = process_chunk(new Uint8Array(chunk), width, height, padding, options);
            ctx.postMessage({ type: 'result', data: result }, [result.buffer]);
        } catch (err: any) {
            ctx.postMessage({ type: 'error', message: err.message || String(err) });
        }
    }
};
