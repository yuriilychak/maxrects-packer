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
import {
    BinResult,
    deserializeBins,
    deserializeChunks,
    serializeInputRects,
    serializeOptions,
    serializeWorkerResults
} from "./serialization";
import { WorkerPool, WorkerPoolOptions } from "./worker_pool";
import initWasm, { prepare_chunks, merge_results } from "./wasm_glue.js";

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

export class MaxRectsPackerWasm {
    public readonly width: number;
    public readonly height: number;
    public readonly padding: number;
    public readonly packerOptions: IOption;

    private pool: WorkerPool;
    private optionsBits: number;

    /** tag → original data mapping */
    private dataMap: Map<number, any> = new Map();

    /** Deserialized bins from the last addArray call */
    private _bins: BinResult[] = [];

    private constructor (
        config: { width: number; height: number; padding: number; options: IOption },
        pool: WorkerPool
    ) {
        this.width = config.width;
        this.height = config.height;
        this.padding = config.padding;
        this.packerOptions = config.options;
        this.optionsBits = serializeOptions(config.options);
        this.pool = pool;
    }

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
    static async create (opts: MaxRectsPackerWasmOptions): Promise<MaxRectsPackerWasm> {
        const config = {
            width: opts.width != null ? opts.width : 4096,
            height: opts.height != null ? opts.height : 4096,
            padding: opts.padding != null ? opts.padding : 0,
            options: opts.options != null ? opts.options : { smart: true, pot: true, square: false },
        };

        // Resolve WASM binary: fetch once or use provided buffer
        let wasmBinary: ArrayBuffer;
        if (opts.wasmBinary) {
            wasmBinary = opts.wasmBinary;
        } else if (opts.wasmUrl) {
            const response = await fetch(opts.wasmUrl as RequestInfo);
            wasmBinary = await response.arrayBuffer();
        } else {
            throw new Error('MaxRectsPackerWasm.create requires either wasmUrl or wasmBinary');
        }

        // Init main-thread WASM instance (async to avoid sync compilation size limits)
        await initWasm(wasmBinary);

        const defaultWorkers = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
        const numWorkers = opts.numWorkers != null ? opts.numWorkers : (defaultWorkers || 4);

        const poolOpts: WorkerPoolOptions = {
            numWorkers,
            workerSource: opts.workerSource,
            wasmBinary,
        };

        const pool = await WorkerPool.create(poolOpts);
        return new MaxRectsPackerWasm(config, pool);
    }

    /** Current bins result (populated after addArray) */
    get bins (): BinResult[] {
        return this._bins;
    }

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
    async addArray (rects: IRectangle[]): Promise<BinResult[]> {
        if (rects.length === 0) {
            this._bins = [];
            return this._bins;
        }

        // 1. Serialize input rects → Uint8Array with tag mapping
        const inputData = serializeInputRects(rects, this.dataMap);

        // 2. WASM: sort + split into chunks (round-robin distribution)
        const numWorkers = this.pool['workers'].length;
        const chunksData = prepare_chunks(inputData, numWorkers);
        const chunks = deserializeChunks(chunksData);

        // 3. Dispatch chunks to WebWorker pool
        const workerResults = await this.pool.processChunks(chunks, {
            width: this.width,
            height: this.height,
            padding: this.padding,
            options: this.optionsBits,
        });

        // 4. WASM: merge worker results (full bins + repack partial bins)
        const mergeInput = serializeWorkerResults(workerResults);
        const finalData = merge_results(
            mergeInput,
            this.width,
            this.height,
            this.padding,
            this.optionsBits
        );

        // 5. Deserialize final bins → typed result
        this._bins = deserializeBins(finalData, this.dataMap, this.packerOptions);
        return this._bins;
    }

    /** Terminate all workers and release resources. */
    terminate (): void {
        this.pool.terminate();
    }
}
