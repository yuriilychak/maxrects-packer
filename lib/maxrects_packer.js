let wasm;

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * Merge results from multiple workers.
 * Keeps full bins (non-last) intact, repacks partial bins (last bin from each worker).
 *
 * Input: [num_results: u8] [result_len: u32_le, bins_data...] × num_results
 * Output: standard bins format
 * @param {Uint8Array} results
 * @param {number} width
 * @param {number} height
 * @param {number} padding
 * @param {number} options
 * @returns {Uint8Array}
 */
export function merge_results(results, width, height, padding, options) {
    const ptr0 = passArray8ToWasm0(results, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.merge_results(ptr0, len0, width, height, padding, options);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Process a single chunk of rectangles (called by each WebWorker).
 * Input rects are pre-sorted by prepare_chunks — added directly without re-sorting.
 *
 * Input: packed rects [width_i16, height_i16, tag_u32] × N
 * Output: standard bins format (same as WasmMaxRectsPacker.bins getter)
 * @param {Uint8Array} chunk
 * @param {number} width
 * @param {number} height
 * @param {number} padding
 * @param {number} options
 * @returns {Uint8Array}
 */
export function process_chunk(chunk, width, height, padding, options) {
    const ptr0 = passArray8ToWasm0(chunk, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.process_chunk(ptr0, len0, width, height, padding, options);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Sort input rects and split into chunks for parallel processing.
 * Uses round-robin distribution so each chunk has a balanced mix of sizes.
 *
 * Input: packed rects [width_i16, height_i16, tag_u32] × N
 * Output: [num_chunks: u8] [chunk_len: u32_le, chunk_data...] × num_chunks
 * @param {Uint8Array} rects
 * @param {number} num_chunks
 * @returns {Uint8Array}
 */
export function prepare_chunks(rects, num_chunks) {
    const ptr0 = passArray8ToWasm0(rects, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.prepare_chunks(ptr0, len0, num_chunks);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

const MaxRectsPackerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_maxrectspacker_free(ptr >>> 0, 1));
/**
 * WASM-exposed packer with binary serialization protocol.
 * All non-primitive data crosses the WASM boundary as Uint8Array.
 */
export class MaxRectsPacker {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MaxRectsPackerFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_maxrectspacker_free(ptr, 0);
    }
    /**
     * Add a single rectangle with a u32 data tag.
     * @param {number} width
     * @param {number} height
     * @param {number} data
     */
    add(width, height, data) {
        wasm.maxrectspacker_add(this.__wbg_ptr, width, height, data);
    }
    /**
     * Create a new packer.
     * `options` is a u8 bitfield: bit0=smart, bit1=pot, bit2=square
     * @param {number} width
     * @param {number} height
     * @param {number} padding
     * @param {number} options
     */
    constructor(width, height, padding, options) {
        const ret = wasm.maxrectspacker_new(width, height, padding, options);
        this.__wbg_ptr = ret >>> 0;
        MaxRectsPackerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Get bins as a packed binary buffer.
     * Format:
     *   num_bins: u16_le
     *   Per bin:
     *     bin_type: u8 (0=MaxRects, 1=Oversized)
     *     width: i16_le, height: i16_le, max_width: i16_le, max_height: i16_le
     *     num_rects: u16_le
     *     Per rect (12 bytes): x, y, width, height (i16_le) + tag (u32_le)
     * @returns {Uint8Array}
     */
    get bins() {
        const ret = wasm.maxrectspacker_bins(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Load bins from previously saved binary buffer.
     * @param {Uint8Array} data
     */
    load(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.maxrectspacker_load(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Save bins state as packed binary buffer.
     * @returns {Uint8Array}
     */
    save() {
        const ret = wasm.maxrectspacker_save(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Add rectangles from a packed binary buffer.
     * Format: [width: i16_le, height: i16_le, tag: u32_le] × N (8 bytes per rect)
     * @param {Uint8Array} data
     */
    addArray(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.maxrectspacker_addArray(this.__wbg_ptr, ptr0, len0);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('maxrects_packer_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
