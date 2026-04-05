import { initWasm as initWasmGlue, MaxRectsPacker } from "maxrects-packer";

export interface Rect {
  width: number;
  height: number;
}

export interface PackedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  tag: number;
}

export interface Bin {
  width: number;
  height: number;
  rects: PackedRect[];
}

let wasmReady = false;

export async function initWasm(): Promise<void> {
  if (wasmReady) return;
  const base = import.meta.env.BASE_URL;
  await initWasmGlue(`${base}wasm/maxrects-packer.wasm`);
  wasmReady = true;
}

function serializeRects(rects: Rect[]): Uint8Array {
  const buf = new Uint8Array(rects.length * 8);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < rects.length; i++) {
    const offset = i * 8;
    view.setInt16(offset, rects[i].width, true);
    view.setInt16(offset + 2, rects[i].height, true);
    view.setUint32(offset + 4, i, true);
  }
  return buf;
}

function deserializeBins(data: Uint8Array): Bin[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  const numBins = view.getUint16(offset, true);
  offset += 2;
  const bins: Bin[] = [];
  for (let b = 0; b < numBins; b++) {
    offset += 1; // bin_type
    const width = view.getInt16(offset, true);
    offset += 2;
    const height = view.getInt16(offset, true);
    offset += 2;
    offset += 4; // maxWidth (i16) + maxHeight (i16)
    const numRects = view.getUint16(offset, true);
    offset += 2;
    const rects: PackedRect[] = [];
    for (let r = 0; r < numRects; r++) {
      rects.push({
        x: view.getInt16(offset, true),
        y: view.getInt16(offset + 2, true),
        width: view.getInt16(offset + 4, true),
        height: view.getInt16(offset + 6, true),
        tag: view.getUint32(offset + 8, true),
      });
      offset += 12;
    }
    bins.push({ width, height, rects });
  }
  return bins;
}

export async function packRects(
  rects: Rect[],
  areaWidth: number,
  areaHeight: number,
): Promise<Bin[]> {
  await initWasm();
  // smart=true (bit0), pot=false, square=false
  const options = 1;
  const packer = new MaxRectsPacker(
    areaWidth,
    areaHeight,
    0,
    options,
  );
  packer.addArray(serializeRects(rects));
  const binsData: Uint8Array = packer.bins;
  const bins = deserializeBins(binsData);
  packer.free();
  return bins;
}
