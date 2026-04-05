/**
 * Pool of WebWorkers for parallel WASM chunk processing.
 *
 * Each worker receives a copy of the WASM binary and instantiates it
 * synchronously using the bundled glue code. No network fetches in workers.
 */
export interface WorkerPoolOptions {
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
export declare class WorkerPool {
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
