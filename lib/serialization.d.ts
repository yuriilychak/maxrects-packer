import { IRectangle } from "./types";
import { IOption } from "./types";
export declare function serializeOptions(options: IOption): number;
export declare function serializeInputRects(rects: IRectangle[], dataMap: Map<number, any>): Uint8Array;
export declare function deserializeChunks(data: Uint8Array): Uint8Array[];
export declare function serializeWorkerResults(results: Uint8Array[]): Uint8Array;
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
export declare function deserializeBins(data: Uint8Array, dataMap: Map<number, any>, options: IOption): BinResult[];
