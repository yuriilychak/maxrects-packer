/**
 * Type declarations for wasm_glue.js — the WASM bindgen glue code.
 */

export function merge_results(results: Uint8Array, width: number, height: number, padding: number, options: number): Uint8Array;
export function process_chunk(chunk: Uint8Array, width: number, height: number, padding: number, options: number): Uint8Array;
export function prepare_chunks(rects: Uint8Array, num_chunks: number): Uint8Array;

export class MaxRectsPacker {
    free(): void;
    add(width: number, height: number, data: number): void;
    constructor(width: number, height: number, padding: number, options: number);
    load(data: Uint8Array): void;
    save(): Uint8Array;
    addArray(data: Uint8Array): void;
    readonly bins: Uint8Array;
}

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_maxrectspacker_free: (a: number, b: number) => void;
    readonly maxrectspacker_add: (a: number, b: number, c: number, d: number) => void;
    readonly maxrectspacker_addArray: (a: number, b: number, c: number) => void;
    readonly maxrectspacker_bins: (a: number) => [number, number];
    readonly maxrectspacker_load: (a: number, b: number, c: number) => void;
    readonly maxrectspacker_new: (a: number, b: number, c: number, d: number) => number;
    readonly maxrectspacker_save: (a: number) => [number, number];
    readonly merge_results: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly prepare_chunks: (a: number, b: number, c: number) => [number, number];
    readonly process_chunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly __wbindgen_export_0: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

/**
 * Synchronously instantiate WASM from a BufferSource or WebAssembly.Module.
 * Use in workers where sync compilation is allowed (no size limit).
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * Asynchronously instantiate WASM from a URL, Response, BufferSource, or WebAssembly.Module.
 * Use in the main thread to avoid sync compilation size limits.
 */
export function initWasm(module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

export default initWasm;
