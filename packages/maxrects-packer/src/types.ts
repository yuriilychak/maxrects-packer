/**
 * Shared type definitions for the maxrects-packer WASM wrapper.
 */

/**
 * Rectangle interface — matches the shape expected by the packing algorithm.
 */
export interface IRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    [propName: string]: any;
}

/**
 * Packing options.
 * @property smart  Smart sizing packer (default true)
 * @property pot    Power-of-2 sizing (default true)
 * @property square Square sizing (default false)
 */
export interface IOption {
    smart?: boolean;
    pot?: boolean;
    square?: boolean;
}
