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

interface PendingTask {
    resolve: (result: Uint8Array) => void;
    reject: (error: Error) => void;
}

interface PoolWorker {
    worker: Worker;
    busy: boolean;
    pending: PendingTask | null;
}

export class WorkerPool {
    private workers: PoolWorker[] = [];
    private taskQueue: Array<{ task: WorkerTask; pending: PendingTask }> = [];

    private constructor () {}

    /**
     * Create and initialize a worker pool.
     * All workers are initialized with the WASM module before returning.
     */
    static async create (options: WorkerPoolOptions): Promise<WorkerPool> {
        const pool = new WorkerPool();
        const initPromises: Promise<void>[] = [];

        for (let i = 0; i < options.numWorkers; i++) {
            const worker = typeof options.workerSource === 'function'
                ? options.workerSource()
                : new Worker(options.workerSource as string);

            const poolWorker: PoolWorker = { worker, busy: false, pending: null };
            pool.workers.push(poolWorker);

            const initPromise = new Promise<void>((resolve, reject) => {
                const onMessage = (e: MessageEvent) => {
                    if (e.data.type === 'ready') {
                        worker.removeEventListener('message', onMessage);
                        pool.setupWorkerHandler(poolWorker);
                        resolve();
                    } else if (e.data.type === 'error') {
                        worker.removeEventListener('message', onMessage);
                        reject(new Error(e.data.message));
                    }
                };
                worker.addEventListener('message', onMessage);
            });

            worker.postMessage({ type: 'init', wasmBinary: options.wasmBinary });
            initPromises.push(initPromise);
        }

        await Promise.all(initPromises);
        return pool;
    }

    private setupWorkerHandler (poolWorker: PoolWorker): void {
        poolWorker.worker.addEventListener('message', (e: MessageEvent) => {
            const pending = poolWorker.pending;
            poolWorker.pending = null;
            poolWorker.busy = false;

            if (e.data.type === 'result') {
                if (pending) pending.resolve(e.data.data);
            } else if (e.data.type === 'error') {
                if (pending) pending.reject(new Error(e.data.message));
            }

            this.drainQueue();
        });
    }

    private drainQueue (): void {
        while (this.taskQueue.length > 0) {
            const available = this.workers.find(w => !w.busy);
            if (!available) break;

            const item = this.taskQueue.shift()!;
            this.dispatchToWorker(available, item.task, item.pending);
        }
    }

    private dispatchToWorker (poolWorker: PoolWorker, task: WorkerTask, pending: PendingTask): void {
        poolWorker.busy = true;
        poolWorker.pending = pending;
        poolWorker.worker.postMessage({
            type: 'process',
            chunk: task.chunk,
            width: task.width,
            height: task.height,
            padding: task.padding,
            options: task.options,
        }, [task.chunk.buffer]);
    }

    /**
     * Process an array of chunks in parallel across workers.
     * Returns results in the same order as the input chunks.
     */
    async processChunks (
        chunks: Uint8Array[],
        config: { width: number; height: number; padding: number; options: number }
    ): Promise<Uint8Array[]> {
        const promises = chunks.map(chunk => {
            const task: WorkerTask = { chunk, ...config };
            return new Promise<Uint8Array>((resolve, reject) => {
                const pending: PendingTask = { resolve, reject };
                const available = this.workers.find(w => !w.busy);
                if (available) {
                    this.dispatchToWorker(available, task, pending);
                } else {
                    this.taskQueue.push({ task, pending });
                }
            });
        });
        return Promise.all(promises);
    }

    /** Terminate all workers and release resources. */
    terminate (): void {
        for (const pw of this.workers) {
            pw.worker.terminate();
        }
        this.workers = [];
        this.taskQueue = [];
    }
}

interface WorkerTask {
    chunk: Uint8Array;
    width: number;
    height: number;
    padding: number;
    options: number;
}
