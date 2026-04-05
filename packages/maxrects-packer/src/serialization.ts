import { IRectangle } from "./types";
import { IOption } from "./types";

// --- PackerOption u8 bitfield ---

export function serializeOptions (options: IOption): number {
    let bits = 0;
    if (options.smart) bits |= 0b001;
    if (options.pot) bits |= 0b010;
    if (options.square) bits |= 0b100;
    return bits;
}

// --- Input rectangles: [width_i16, height_i16, tag_u32] × N = 8 bytes each ---

export function serializeInputRects (rects: IRectangle[], dataMap: Map<number, any>): Uint8Array {
    const buf = new Uint8Array(rects.length * 8);
    const view = new DataView(buf.buffer);
    let offset = 0;

    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const tag = dataMap.size;
        dataMap.set(tag, r.data);

        view.setInt16(offset, r.width, true); offset += 2;
        view.setInt16(offset, r.height, true); offset += 2;
        view.setUint32(offset, tag, true); offset += 4;
    }

    return buf;
}

// --- Deserialize chunks from prepare_chunks output ---
// Format: [num_chunks: u8] [chunk_len: u32_le, chunk_data...] × N

export function deserializeChunks (data: Uint8Array): Uint8Array[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const numChunks = view.getUint8(offset); offset += 1;
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < numChunks; i++) {
        const chunkLen = view.getUint32(offset, true); offset += 4;
        // slice() creates an independent copy — safe for Transferable
        chunks.push(data.slice(offset, offset + chunkLen));
        offset += chunkLen;
    }

    return chunks;
}

// --- Serialize worker results for merge_results input ---
// Format: [num_results: u8] [result_len: u32_le, bins_data...] × N

export function serializeWorkerResults (results: Uint8Array[]): Uint8Array {
    let totalSize = 1; // num_results: u8
    for (const r of results) {
        totalSize += 4 + r.byteLength;
    }

    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);
    let offset = 0;

    view.setUint8(offset, results.length); offset += 1;
    for (const r of results) {
        view.setUint32(offset, r.byteLength, true); offset += 4;
        buf.set(r, offset); offset += r.byteLength;
    }

    return buf;
}

// --- Bins output deserialization ---

export interface BinResult {
    width: number;
    height: number;
    maxWidth: number;
    maxHeight: number;
    oversized: boolean;
    rects: IRectangle[];
    freeRects: IRectangle[];
    options: IOption;
}

export function deserializeBins (
    data: Uint8Array,
    dataMap: Map<number, any>,
    options: IOption
): BinResult[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const numBins = view.getUint16(offset, true); offset += 2;
    const bins: BinResult[] = [];

    for (let b = 0; b < numBins; b++) {
        const binType = view.getUint8(offset); offset += 1;
        const width = view.getInt16(offset, true); offset += 2;
        const height = view.getInt16(offset, true); offset += 2;
        const maxWidth = view.getInt16(offset, true); offset += 2;
        const maxHeight = view.getInt16(offset, true); offset += 2;
        const numRects = view.getUint16(offset, true); offset += 2;

        const rects: IRectangle[] = [];
        for (let r = 0; r < numRects; r++) {
            const x = view.getInt16(offset, true); offset += 2;
            const y = view.getInt16(offset, true); offset += 2;
            const w = view.getInt16(offset, true); offset += 2;
            const h = view.getInt16(offset, true); offset += 2;
            const tag = view.getUint32(offset, true); offset += 4;

            const rect: IRectangle = { x, y, width: w, height: h, data: dataMap.get(tag) };
            if (binType === 1) rect.oversized = true;
            rects.push(rect);
        }

        bins.push({
            width,
            height,
            maxWidth,
            maxHeight,
            oversized: binType === 1,
            rects,
            freeRects: [],
            options
        });
    }

    return bins;
}
