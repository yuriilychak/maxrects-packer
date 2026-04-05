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

const ctx: Worker = self as any;

let processChunk: ((chunk: Uint8Array, w: number, h: number, p: number, o: number) => Uint8Array) | null = null;

ctx.onmessage = async (e: MessageEvent) => {
    const { type } = e.data;

    if (type === 'init') {
        try {
            const wasmModule: any = await import(/* webpackIgnore: true */ e.data.wasmUrl);
            await wasmModule.default();
            processChunk = wasmModule.process_chunk;
            ctx.postMessage({ type: 'ready' });
        } catch (err: any) {
            ctx.postMessage({ type: 'error', message: err.message || String(err) });
        }
    } else if (type === 'process') {
        try {
            if (!processChunk) throw new Error('Worker not initialized');
            const { chunk, width, height, padding, options } = e.data;
            const result = processChunk(new Uint8Array(chunk), width, height, padding, options);
            ctx.postMessage({ type: 'result', data: result }, [result.buffer]);
        } catch (err: any) {
            ctx.postMessage({ type: 'error', message: err.message || String(err) });
        }
    }
};
