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
import { IRectangle } from "./types";
import { IOption } from "./types";
import { BinResult } from "./serialization";
export interface MaxRectsPackerWasmOptions {
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
export declare class MaxRectsPackerWasm {
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
     *   wasmUrl: '/maxrects_packer_bg.wasm',
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
