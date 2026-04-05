# Max Rects Packer (WASM Fork)

A high-performance max-rectangle 2D bin packing algorithm compiled to **WebAssembly** with optional **SIMD** acceleration and **WebWorker** parallelism.

> **Fork of [soimy/maxrects-packer](https://github.com/soimy/maxrects-packer)** — rewritten from pure TypeScript to a Rust/WASM core with a TypeScript async wrapper.

This packer is designed for packing glyphs or images into multiple sprite-sheet/atlas. Instead of creating one output bin with a minimum size, it creates a minimum number of bins under a given size — avoiding single massive images that are not browser-friendly. Especially useful for WebGL games where the GPU benefits from spritesheets close to power-of-2 sizes.

**[Live Demo](https://yuriilychak.github.io/maxrects-packer/)**

![Preview image](https://raw.githubusercontent.com/soimy/maxrects-packer/master/preview.png)

## What changed in this fork

| Aspect | Original (v2.x) | This fork (v3.0.0) |
|--------|-----------------|---------------------|
| **Core language** | TypeScript | Rust → WebAssembly |
| **Architecture** | Single package | Turborepo monorepo (3 packages) |
| **API style** | Synchronous | Async (WebWorker pool) |
| **Parallelism** | None | Multi-threaded via WebWorkers |
| **SIMD** | None | Optional WASM simd128 |
| **WASM boundary** | N/A | Binary serialization protocol |
| **Build system** | tsc | wasm-pack + Rollup + Turbo |

### Key improvements

- **WASM-compiled algorithm** — the packing hot path runs as optimized WebAssembly instead of interpreted JavaScript
- **SIMD acceleration** — optional `simd128` feature batches 8 rectangles per SIMD operation for `find_best_fit` and `prune_contained`
- **WebWorker parallelism** — input is sorted, split into chunks via round-robin, processed in parallel across workers, then partial bins are merged
- **Efficient binary protocol** — all data crosses the WASM boundary as compact `Uint8Array` buffers (8 bytes per input rect) instead of JS objects

## Monorepo structure

```
├── packages/
│   ├── maxrects-packer-algo/   # Rust → WASM core algorithm
│   ├── maxrects-packer/        # TypeScript async wrapper + workers
│   └── maxrects-packer-demo/   # React + Vite interactive demo
├── lib/                        # Compiled output (WASM + JS + types)
├── turbo.json                  # Build pipeline
└── package.json                # Workspace root
```

## Usage

```bash
npm install maxrects-packer
```

```typescript
import { MaxRectsPackerWasm } from 'maxrects-packer';

// Create packer with WebWorker pool
const packer = await MaxRectsPackerWasm.create({
    wasmUrl: './wasm/maxrects-packer.wasm',
    workerSource: new URL('maxrects-packer/worker', import.meta.url),
    width: 1024,            // Max bin width (default: 4096)
    height: 1024,           // Max bin height (default: 4096)
    padding: 2,             // Padding between rects (default: 0)
    numWorkers: 4,          // Worker count (default: navigator.hardwareConcurrency)
    options: {
        smart: true,        // Smallest possible bin size (default: true)
        pot: true,          // Power-of-2 bin sizing (default: true)
        square: false       // Force square bins (default: false)
    }
});

const input = [
    { x: 0, y: 0, width: 600, height: 20, data: { name: "tree", foo: "bar" } },
    { x: 0, y: 0, width: 600, height: 20, data: { name: "flower" } },
    { x: 0, y: 0, width: 2000, height: 2000, data: { name: "oversized background" } },
    { x: 0, y: 0, width: 1000, height: 1000, data: { name: "background" } },
    { x: 0, y: 0, width: 1000, height: 1000, data: { name: "overlay" } }
];

// Pack rectangles (async — uses WebWorkers)
const bins = await packer.addArray(input);

bins.forEach(bin => {
    console.log(`Bin ${bin.width}×${bin.height}`, bin.rects);
});

// Clean up workers when done
packer.terminate();
```

## API

### `MaxRectsPackerWasm.create(options): Promise<MaxRectsPackerWasm>`

Creates and initializes a WASM packer with a WebWorker pool.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wasmUrl` | `string \| URL` | — | URL to the `.wasm` binary file (provide this or `wasmBinary`) |
| `wasmBinary` | `ArrayBuffer` | — | Pre-fetched WASM binary (provide this or `wasmUrl`) |
| `workerSource` | `string \| URL \| (() => Worker)` | *required* | Worker script URL or factory |
| `width` | `number` | `4096` | Max bin width |
| `height` | `number` | `4096` | Max bin height |
| `padding` | `number` | `0` | Padding between rectangles |
| `numWorkers` | `number` | `navigator.hardwareConcurrency` | Number of WebWorkers |
| `options` | `IOption` | `{ smart: true, pot: true, square: false }` | Packing options |

### `packer.addArray(rects): Promise<BinResult[]>`

Packs an array of rectangles using parallel WebWorkers. Each rect must have `x`, `y`, `width`, `height`, and optionally `data` (any value — preserved through packing via tag mapping).

**Packing flow:**
1. Serialize rects to binary (`Uint8Array`)
2. WASM sorts by `max(width, height)` descending and splits into chunks (round-robin)
3. Workers process chunks in parallel via WASM `process_chunk`
4. WASM `merge_results` keeps full bins intact, repacks partial bins
5. Deserialize to typed `BinResult[]` with original `data` restored

### `packer.bins: BinResult[]`

Array of bins from the last `addArray` call. Each bin contains:

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Bin width |
| `height` | `number` | Bin height |
| `maxWidth` | `number` | Max width constraint |
| `maxHeight` | `number` | Max height constraint |
| `oversized` | `boolean` | Whether this bin exceeds max constraints |
| `rects` | `IRectangle[]` | Packed rectangles with `x`, `y`, `width`, `height`, `data` |
| `options` | `IOption` | Packing options used |

### `packer.terminate(): void`

Terminates all WebWorkers and releases resources. Call when done packing.

### Packing options (`IOption`)

- **`smart`** — packing with smallest possible bin size (default: `true`)
- **`pot`** — bin size rounds up to the smallest power of 2 (default: `true`)
- **`square`** — bin size is always square (default: `false`)

## Low-level WASM API

The WASM module also exposes a synchronous single-threaded API (used by the demo):

```typescript
import initWasm, { MaxRectsPacker, prepare_chunks, process_chunk, merge_results } from 'maxrects-packer';

await initWasm({ module: wasmBinary }); // pass ArrayBuffer or Response

const packer = new MaxRectsPacker(1024, 1024, 2, 0b011); // options as u8 bitfield
packer.add(600, 20, 0);      // width, height, data tag (u32)
packer.addArray(binaryData);  // Uint8Array: [width_i16, height_i16, tag_u32] × N

const binsData = packer.bins; // Uint8Array (binary serialized)
const saved = packer.save();  // Uint8Array (save state)
packer.load(saved);           // Restore state

// Free-function parallel API:
const chunks = prepare_chunks(inputData, numWorkers);
const result = process_chunk(chunk, width, height, padding, options);
const merged = merge_results(serializedResults, width, height, padding, options);
```

## Support for oversized rectangles

Normally all bins are equal to or smaller than `maxWidth`/`maxHeight`. If a rect is added that individually does not fit into those constraints, a special bin is created. This bin contains only that single rect with an `oversized` flag set to `true`.

## Building

**Prerequisites:** Rust toolchain, [wasm-pack](https://rustwasm.github.io/wasm-pack/), Node.js

```bash
# Install dependencies
npm install

# Build all packages (algo → wrapper → demo)
npx turbo run build

# Build only the WASM algorithm
cd packages/maxrects-packer-algo
npm run build          # wasm-pack build --target web --out-dir ../../lib

# Run Rust tests
cd packages/maxrects-packer-algo
cargo test --target x86_64-unknown-linux-gnu

# Run the demo
cd packages/maxrects-packer-demo
npm run dev
```

## Packing algorithm

Uses the Max Rectangles algorithm (best-area-fit with short-side tiebreaker), the same approach used by **Texture Packer**. The WASM implementation optionally accelerates the rectangle search and free-list pruning with SIMD intrinsics.
