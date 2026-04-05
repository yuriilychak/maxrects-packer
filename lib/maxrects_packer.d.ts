/* tslint:disable */
/* eslint-disable */
/**
 * Merge results from multiple workers.
 * Keeps full bins (non-last) intact, repacks partial bins (last bin from each worker).
 *
 * Input: [num_results: u8] [result_len: u32_le, bins_data...] × num_results
 * Output: standard bins format
 */
export function merge_results(results: Uint8Array, width: number, height: number, padding: number, options: number): Uint8Array;
/**
 * Process a single chunk of rectangles (called by each WebWorker).
 * Input rects are pre-sorted by prepare_chunks — added directly without re-sorting.
 *
 * Input: packed rects [width_i16, height_i16, tag_u32] × N
 * Output: standard bins format (same as WasmMaxRectsPacker.bins getter)
 */
export function process_chunk(chunk: Uint8Array, width: number, height: number, padding: number, options: number): Uint8Array;
/**
 * Sort input rects and split into chunks for parallel processing.
 * Uses round-robin distribution so each chunk has a balanced mix of sizes.
 *
 * Input: packed rects [width_i16, height_i16, tag_u32] × N
 * Output: [num_chunks: u8] [chunk_len: u32_le, chunk_data...] × num_chunks
 */
export function prepare_chunks(rects: Uint8Array, num_chunks: number): Uint8Array;
/**
 * WASM-exposed packer with binary serialization protocol.
 * All non-primitive data crosses the WASM boundary as Uint8Array.
 */
export class MaxRectsPacker {
  free(): void;
  /**
   * Add a single rectangle with a u32 data tag.
   */
  add(width: number, height: number, data: number): void;
  /**
   * Create a new packer.
   * `options` is a u8 bitfield: bit0=smart, bit1=pot, bit2=square
   */
  constructor(width: number, height: number, padding: number, options: number);
  /**
   * Load bins from previously saved binary buffer.
   */
  load(data: Uint8Array): void;
  /**
   * Save bins state as packed binary buffer.
   */
  save(): Uint8Array;
  /**
   * Add rectangles from a packed binary buffer.
   * Format: [width: i16_le, height: i16_le, tag: u32_le] × N (8 bytes per rect)
   */
  addArray(data: Uint8Array): void;
  /**
   * Get bins as a packed binary buffer.
   * Format:
   *   num_bins: u16_le
   *   Per bin:
   *     bin_type: u8 (0=MaxRects, 1=Oversized)
   *     width: i16_le, height: i16_le, max_width: i16_le, max_height: i16_le
   *     num_rects: u16_le
   *     Per rect (12 bytes): x, y, width, height (i16_le) + tag (u32_le)
   */
  readonly bins: Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

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
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
