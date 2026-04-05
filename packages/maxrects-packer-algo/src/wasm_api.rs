use wasm_bindgen::prelude::*;

use crate::maxrects_bin::PackerOption;
use crate::maxrects_packer::{Bin, MaxRectsPacker, SavedBin};
use crate::rectangle::IRectangle;

/// WASM-exposed packer with binary serialization protocol.
/// All non-primitive data crosses the WASM boundary as Uint8Array.
#[wasm_bindgen(js_name = MaxRectsPacker)]
pub struct WasmMaxRectsPacker {
    inner: MaxRectsPacker,
}

#[wasm_bindgen(js_class = MaxRectsPacker)]
impl WasmMaxRectsPacker {
    /// Create a new packer.
    /// `options` is a u8 bitfield: bit0=smart, bit1=pot, bit2=square
    #[wasm_bindgen(constructor)]
    pub fn new(width: i16, height: i16, padding: i16, options: u8) -> WasmMaxRectsPacker {
        WasmMaxRectsPacker {
            inner: MaxRectsPacker::new(width, height, padding, PackerOption::from(options)),
        }
    }

    /// Add a single rectangle with a u32 data tag.
    pub fn add(&mut self, width: i16, height: i16, data: u32) {
        self.inner.add(width, height, data);
    }

    /// Add rectangles from a packed binary buffer.
    /// Format: [width: i16_le, height: i16_le, tag: u32_le] × N (8 bytes per rect)
    #[wasm_bindgen(js_name = addArray)]
    pub fn add_array(&mut self, data: &[u8]) {
        let rects = deserialize_input_rects(data);
        self.inner.add_array(&rects);
    }

    /// Get bins as a packed binary buffer.
    /// Format:
    ///   num_bins: u16_le
    ///   Per bin:
    ///     bin_type: u8 (0=MaxRects, 1=Oversized)
    ///     width: i16_le, height: i16_le, max_width: i16_le, max_height: i16_le
    ///     num_rects: u16_le
    ///     Per rect (12 bytes): x, y, width, height (i16_le) + tag (u32_le)
    #[wasm_bindgen(getter)]
    pub fn bins(&self) -> Vec<u8> {
        serialize_bins(&self.inner)
    }

    /// Save bins state as packed binary buffer.
    pub fn save(&self) -> Vec<u8> {
        serialize_saved_bins(&self.inner.save())
    }

    /// Load bins from previously saved binary buffer.
    pub fn load(&mut self, data: &[u8]) {
        let saved = deserialize_saved_bins(data);
        self.inner.load(&saved);
    }
}

fn deserialize_input_rects(data: &[u8]) -> Vec<IRectangle> {
    let count = data.len() / 8;
    let mut rects = Vec::with_capacity(count);
    let mut off = 0;
    for _ in 0..count {
        let width = i16::from_le_bytes([data[off], data[off + 1]]);
        let height = i16::from_le_bytes([data[off + 2], data[off + 3]]);
        let tag = u32::from_le_bytes([data[off + 4], data[off + 5], data[off + 6], data[off + 7]]);
        rects.push(IRectangle {
            x: 0,
            y: 0,
            width,
            height,
            data: tag,
            oversized: false,
        });
        off += 8;
    }
    rects
}

fn serialize_bins(packer: &MaxRectsPacker) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(&(packer.bins.len() as u16).to_le_bytes());
    append_packer_bins(&mut buf, packer);
    buf
}

fn append_packer_bins(buf: &mut Vec<u8>, packer: &MaxRectsPacker) {
    for bin in &packer.bins {
        let bin_type: u8 = match bin {
            Bin::MaxRects(_) => 0,
            Bin::Oversized(_) => 1,
        };
        buf.push(bin_type);
        buf.extend_from_slice(&bin.width().to_le_bytes());
        buf.extend_from_slice(&bin.height().to_le_bytes());
        buf.extend_from_slice(&bin.max_width().to_le_bytes());
        buf.extend_from_slice(&bin.max_height().to_le_bytes());

        let rects = bin.rects();
        buf.extend_from_slice(&(rects.len() as u16).to_le_bytes());
        for r in rects {
            buf.extend_from_slice(&r.x.to_le_bytes());
            buf.extend_from_slice(&r.y.to_le_bytes());
            buf.extend_from_slice(&r.width.to_le_bytes());
            buf.extend_from_slice(&r.height.to_le_bytes());
            buf.extend_from_slice(&r.data.to_le_bytes());
        }
    }
}

fn serialize_saved_bins(saved: &[SavedBin]) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(&(saved.len() as u16).to_le_bytes());

    for bin in saved {
        buf.extend_from_slice(&bin.width.to_le_bytes());
        buf.extend_from_slice(&bin.height.to_le_bytes());
        buf.extend_from_slice(&bin.max_width.to_le_bytes());
        buf.extend_from_slice(&bin.max_height.to_le_bytes());
        buf.push(u8::from(&bin.options));

        buf.extend_from_slice(&(bin.free_rects.len() as u16).to_le_bytes());
        for r in &bin.free_rects {
            buf.extend_from_slice(&r.x.to_le_bytes());
            buf.extend_from_slice(&r.y.to_le_bytes());
            buf.extend_from_slice(&r.width.to_le_bytes());
            buf.extend_from_slice(&r.height.to_le_bytes());
        }

        buf.extend_from_slice(&(bin.rects.len() as u16).to_le_bytes());
        for r in &bin.rects {
            buf.extend_from_slice(&r.x.to_le_bytes());
            buf.extend_from_slice(&r.y.to_le_bytes());
            buf.extend_from_slice(&r.width.to_le_bytes());
            buf.extend_from_slice(&r.height.to_le_bytes());
            buf.extend_from_slice(&r.data.to_le_bytes());
        }
    }
    buf
}

fn deserialize_saved_bins(data: &[u8]) -> Vec<SavedBin> {
    let mut off = 0;
    let num_bins = read_u16(data, &mut off) as usize;

    let mut bins = Vec::with_capacity(num_bins);
    for _ in 0..num_bins {
        let width = read_i16(data, &mut off);
        let height = read_i16(data, &mut off);
        let max_width = read_i16(data, &mut off);
        let max_height = read_i16(data, &mut off);
        let options = PackerOption::from(read_u8(data, &mut off));

        let num_free = read_u16(data, &mut off) as usize;
        let mut free_rects = Vec::with_capacity(num_free);
        for _ in 0..num_free {
            free_rects.push(IRectangle {
                x: read_i16(data, &mut off),
                y: read_i16(data, &mut off),
                width: read_i16(data, &mut off),
                height: read_i16(data, &mut off),
                data: 0,
                oversized: false,
            });
        }

        let num_rects = read_u16(data, &mut off) as usize;
        let mut rects = Vec::with_capacity(num_rects);
        for _ in 0..num_rects {
            rects.push(IRectangle {
                x: read_i16(data, &mut off),
                y: read_i16(data, &mut off),
                width: read_i16(data, &mut off),
                height: read_i16(data, &mut off),
                data: read_u32(data, &mut off),
                oversized: false,
            });
        }

        bins.push(SavedBin {
            width,
            height,
            max_width,
            max_height,
            free_rects,
            rects,
            options,
        });
    }
    bins
}

#[inline]
fn read_u8(data: &[u8], off: &mut usize) -> u8 {
    let v = data[*off];
    *off += 1;
    v
}

#[inline]
fn read_u16(data: &[u8], off: &mut usize) -> u16 {
    let v = u16::from_le_bytes([data[*off], data[*off + 1]]);
    *off += 2;
    v
}

#[inline]
fn read_i16(data: &[u8], off: &mut usize) -> i16 {
    let v = i16::from_le_bytes([data[*off], data[*off + 1]]);
    *off += 2;
    v
}

#[inline]
fn read_u32(data: &[u8], off: &mut usize) -> u32 {
    let v = u32::from_le_bytes([data[*off], data[*off + 1], data[*off + 2], data[*off + 3]]);
    *off += 4;
    v
}

// --- Parallel processing support ---

struct ParsedRect {
    x: i16,
    y: i16,
    width: i16,
    height: i16,
    tag: u32,
}

struct ParsedBin {
    bin_type: u8,
    width: i16,
    height: i16,
    max_width: i16,
    max_height: i16,
    rects: Vec<ParsedRect>,
}

fn parse_bins_result(data: &[u8]) -> Vec<ParsedBin> {
    let mut off = 0;
    let num_bins = read_u16(data, &mut off) as usize;
    let mut bins = Vec::with_capacity(num_bins);
    for _ in 0..num_bins {
        let bin_type = read_u8(data, &mut off);
        let width = read_i16(data, &mut off);
        let height = read_i16(data, &mut off);
        let max_width = read_i16(data, &mut off);
        let max_height = read_i16(data, &mut off);
        let num_rects = read_u16(data, &mut off) as usize;
        let mut rects = Vec::with_capacity(num_rects);
        for _ in 0..num_rects {
            rects.push(ParsedRect {
                x: read_i16(data, &mut off),
                y: read_i16(data, &mut off),
                width: read_i16(data, &mut off),
                height: read_i16(data, &mut off),
                tag: read_u32(data, &mut off),
            });
        }
        bins.push(ParsedBin { bin_type, width, height, max_width, max_height, rects });
    }
    bins
}

fn append_parsed_bin(buf: &mut Vec<u8>, bin: &ParsedBin) {
    buf.push(bin.bin_type);
    buf.extend_from_slice(&bin.width.to_le_bytes());
    buf.extend_from_slice(&bin.height.to_le_bytes());
    buf.extend_from_slice(&bin.max_width.to_le_bytes());
    buf.extend_from_slice(&bin.max_height.to_le_bytes());
    buf.extend_from_slice(&(bin.rects.len() as u16).to_le_bytes());
    for r in &bin.rects {
        buf.extend_from_slice(&r.x.to_le_bytes());
        buf.extend_from_slice(&r.y.to_le_bytes());
        buf.extend_from_slice(&r.width.to_le_bytes());
        buf.extend_from_slice(&r.height.to_le_bytes());
        buf.extend_from_slice(&r.tag.to_le_bytes());
    }
}

/// Sort input rects and split into chunks for parallel processing.
/// Uses round-robin distribution so each chunk has a balanced mix of sizes.
///
/// Input: packed rects [width_i16, height_i16, tag_u32] × N
/// Output: [num_chunks: u8] [chunk_len: u32_le, chunk_data...] × num_chunks
#[wasm_bindgen]
pub fn prepare_chunks(rects: &[u8], num_chunks: u8) -> Vec<u8> {
    let mut input = deserialize_input_rects(rects);

    // Sort by max(w,h) descending — same as MaxRectsPacker::sort
    input.sort_by(|a, b| {
        let a_max = a.width.max(a.height);
        let b_max = b.width.max(b.height);
        b_max.cmp(&a_max)
    });

    let k = (num_chunks as usize).max(1);
    let mut chunks: Vec<Vec<u8>> = (0..k).map(|_| Vec::new()).collect();

    // Round-robin for balanced workload across workers
    for (i, r) in input.iter().enumerate() {
        let idx = i % k;
        chunks[idx].extend_from_slice(&r.width.to_le_bytes());
        chunks[idx].extend_from_slice(&r.height.to_le_bytes());
        chunks[idx].extend_from_slice(&r.data.to_le_bytes());
    }

    // Remove empty chunks (when fewer rects than workers)
    chunks.retain(|c| !c.is_empty());

    let mut buf = Vec::new();
    buf.push(chunks.len() as u8);
    for chunk in &chunks {
        buf.extend_from_slice(&(chunk.len() as u32).to_le_bytes());
        buf.extend_from_slice(chunk);
    }
    buf
}

/// Process a single chunk of rectangles (called by each WebWorker).
/// Input rects are pre-sorted by prepare_chunks — added directly without re-sorting.
///
/// Input: packed rects [width_i16, height_i16, tag_u32] × N
/// Output: standard bins format (same as WasmMaxRectsPacker.bins getter)
#[wasm_bindgen]
pub fn process_chunk(
    chunk: &[u8],
    width: i16,
    height: i16,
    padding: i16,
    options: u8,
) -> Vec<u8> {
    let rects = deserialize_input_rects(chunk);
    let mut packer = MaxRectsPacker::new(width, height, padding, PackerOption::from(options));
    // Add directly — input is pre-sorted by prepare_chunks
    for r in &rects {
        packer.add(r.width, r.height, r.data);
    }
    serialize_bins(&packer)
}

/// Merge results from multiple workers.
/// Keeps full bins (non-last) intact, repacks partial bins (last bin from each worker).
///
/// Input: [num_results: u8] [result_len: u32_le, bins_data...] × num_results
/// Output: standard bins format
#[wasm_bindgen]
pub fn merge_results(
    results: &[u8],
    width: i16,
    height: i16,
    padding: i16,
    options: u8,
) -> Vec<u8> {
    let mut off = 0usize;
    let num_results = read_u8(results, &mut off) as usize;

    let mut full_bins: Vec<ParsedBin> = Vec::new();
    let mut partial_rects: Vec<IRectangle> = Vec::new();

    for _ in 0..num_results {
        let result_len = read_u32(results, &mut off) as usize;
        let mut worker_bins = parse_bins_result(&results[off..off + result_len]);
        off += result_len;

        if worker_bins.len() <= 1 {
            // Single bin or empty — keep as-is (likely well-filled)
            full_bins.extend(worker_bins);
        } else {
            // Multiple bins: last one may be partial, extract its rects for repacking
            let last = worker_bins.pop().unwrap();
            full_bins.extend(worker_bins);
            for r in last.rects {
                partial_rects.push(IRectangle {
                    x: 0,
                    y: 0,
                    width: r.width,
                    height: r.height,
                    data: r.tag,
                    oversized: r.width > width || r.height > height,
                });
            }
        }
    }

    // Repack partial rects
    let opts = PackerOption::from(options);
    let mut packer = MaxRectsPacker::new(width, height, padding, opts);
    if !partial_rects.is_empty() {
        packer.add_array(&partial_rects);
    }

    // Serialize: full bins + repacked bins
    let total = full_bins.len() + packer.bins.len();
    let mut buf = Vec::new();
    buf.extend_from_slice(&(total as u16).to_le_bytes());
    for bin in &full_bins {
        append_parsed_bin(&mut buf, bin);
    }
    append_packer_bins(&mut buf, &packer);
    buf
}
