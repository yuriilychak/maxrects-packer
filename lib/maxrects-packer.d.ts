/**
 * Shared type definitions for the maxrects-packer WASM wrapper.
 */
/**
 * Rectangle interface — matches the shape expected by the packing algorithm.
 */
interface IRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    [propName: string]: any;
}
/**
 * Packing options.
 * @property smart  Smart sizing packer (default true)
 * @property pot    Power-of-2 sizing (default true)
 * @property square Square sizing (default false)
 */
interface IOption {
    smart?: boolean;
    pot?: boolean;
    square?: boolean;
}

declare function serializeOptions(options: IOption): number;
declare function serializeInputRects(rects: IRectangle[], dataMap: Map<number, any>): Uint8Array;
declare function deserializeChunks(data: Uint8Array): Uint8Array[];
declare function serializeWorkerResults(results: Uint8Array[]): Uint8Array;
interface BinResult {
    width: number;
    height: number;
    maxWidth: number;
    maxHeight: number;
    oversized: boolean;
    rects: IRectangle[];
    freeRects: IRectangle[];
    options: IOption;
}
declare function deserializeBins(data: Uint8Array, dataMap: Map<number, any>, options: IOption): BinResult[];

/**
 * Pool of WebWorkers for parallel WASM chunk processing.
 *
 * Each worker receives a copy of the WASM binary and instantiates it
 * synchronously using the bundled glue code. No network fetches in workers.
 */
interface WorkerPoolOptions {
    /** Number of workers in the pool */
    numWorkers: number;
    /**
     * URL or factory for the worker script.
     * - string | URL: passed to `new Worker(url, { type: 'module' })`
     * - function: called to create each Worker (for custom bundler setups)
     */
    workerSource: string | URL | (() => Worker);
    /** Pre-fetched WASM binary to send to each worker */
    wasmBinary: ArrayBuffer;
}
declare class WorkerPool {
    private workers;
    private taskQueue;
    private constructor();
    /**
     * Create and initialize a worker pool.
     * All workers are initialized with the WASM module before returning.
     */
    static create(options: WorkerPoolOptions): Promise<WorkerPool>;
    private setupWorkerHandler;
    private drainQueue;
    private dispatchToWorker;
    /**
     * Process an array of chunks in parallel across workers.
     * Returns results in the same order as the input chunks.
     */
    processChunks(chunks: Uint8Array[], config: {
        width: number;
        height: number;
        padding: number;
        options: number;
    }): Promise<Uint8Array[]>;
    /** Terminate all workers and release resources. */
    terminate(): void;
}

/**
 * Async WASM-powered MaxRects packer with WebWorker parallelism.
 *
 * Flow:
 * 1. TS serializes input rects → Uint8Array (tag ↔ data map stays in TS)
 * 2. WASM sorts + splits into chunks (round-robin for balanced work)
 * 3. WebWorker pool processes each chunk with WASM `process_chunk`
 * 4. WASM `merge_results` keeps full bins, repacks partial bins
 * 5. TS deserializes final bins → typed result matching the TS library API
 */

interface MaxRectsPackerWasmOptions {
    /** Max atlas width (default 4096) */
    width?: number;
    /** Max atlas height (default 4096) */
    height?: number;
    /** Padding between rectangles (default 0) */
    padding?: number;
    /** Packing options */
    options?: IOption;
    /** Number of WebWorkers (default: navigator.hardwareConcurrency or 4) */
    numWorkers?: number;
    /** Worker source — URL string, URL object, or factory function */
    workerSource: string | URL | (() => Worker);
    /**
     * URL to fetch the .wasm binary from.
     * Provide either wasmUrl or wasmBinary, not both.
     */
    wasmUrl?: string | URL;
    /**
     * Pre-fetched WASM binary (ArrayBuffer).
     * Provide either wasmUrl or wasmBinary, not both.
     */
    wasmBinary?: ArrayBuffer;
}
declare class MaxRectsPackerWasm {
    readonly width: number;
    readonly height: number;
    readonly padding: number;
    readonly packerOptions: IOption;
    private pool;
    private optionsBits;
    /** tag → original data mapping */
    private dataMap;
    /** Deserialized bins from the last addArray call */
    private _bins;
    private constructor();
    /**
     * Create and initialize a WASM packer with a WebWorker pool.
     *
     * The WASM binary is fetched once (or provided directly) and a copy is
     * sent to each worker. Workers instantiate WASM synchronously from the
     * bundled glue code — no additional network requests.
     *
     * @example
     * ```ts
     * const packer = await MaxRectsPackerWasm.create({
     *   wasmUrl: '/maxrects-packer.wasm',
     *   workerSource: new URL('./worker.js', import.meta.url),
     *   numWorkers: 4,
     *   options: { smart: true, pot: true, square: false }
     * });
     *
     * const bins = await packer.addArray(rects);
     * ```
     */
    static create(opts: MaxRectsPackerWasmOptions): Promise<MaxRectsPackerWasm>;
    /** Current bins result (populated after addArray) */
    get bins(): BinResult[];
    /**
     * Pack an array of rectangles using parallel WebWorkers.
     *
     * 1. Serializes rects to binary (tags map data to original objects)
     * 2. WASM sorts and splits into chunks
     * 3. Workers process chunks in parallel
     * 4. WASM merges results (repacks partial bins)
     * 5. Deserializes to typed BinResult[]
     *
     * @returns The packed bins
     */
    addArray(rects: IRectangle[]): Promise<BinResult[]>;
    /** Terminate all workers and release resources. */
    terminate(): void;
}

/**
 * Type declarations for wasm_glue.js — the WASM bindgen glue code.
 */

declare function merge_results(results: Uint8Array, width: number, height: number, padding: number, options: number): Uint8Array;
declare function process_chunk(chunk: Uint8Array, width: number, height: number, padding: number, options: number): Uint8Array;
declare function prepare_chunks(rects: Uint8Array, num_chunks: number): Uint8Array;

declare class MaxRectsPacker {
    free(): void;
    add(width: number, height: number, data: number): void;
    constructor(width: number, height: number, padding: number, options: number);
    load(data: Uint8Array): void;
    save(): Uint8Array;
    addArray(data: Uint8Array): void;
    readonly bins: Uint8Array;
}

interface InitOutput {
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

type SyncInitInput = BufferSource | WebAssembly.Module;
type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

/**
 * Synchronously instantiate WASM from a BufferSource or WebAssembly.Module.
 * Use in workers where sync compilation is allowed (no size limit).
 */
declare function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * Asynchronously instantiate WASM from a URL, Response, BufferSource, or WebAssembly.Module.
 * Use in the main thread to avoid sync compilation size limits.
 */
declare function initWasm(module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

export { MaxRectsPacker, MaxRectsPackerWasm, WorkerPool, deserializeBins, deserializeChunks, initSync, initWasm, initWasm as initWasmDefault, merge_results, prepare_chunks, process_chunk, serializeInputRects, serializeOptions, serializeWorkerResults };
export type { BinResult, IOption, IRectangle, MaxRectsPackerWasmOptions, WorkerPoolOptions };
