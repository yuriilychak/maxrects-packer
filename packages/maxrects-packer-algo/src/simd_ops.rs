//! SIMD-accelerated rectangle operations with scalar fallback.
//!
//! Uses WASM SIMD (simd128) when targeting wasm32 with simd128 enabled,
//! falls back to scalar otherwise (native builds, tests, older browsers).
//!
//! Optimized operations:
//! - `find_best_fit`: Best-area-fit search over free rectangles (i16x8 batch)
//! - `prune_contained`: O(n²) containment pruning (i16x8 pair checks)

use crate::rectangle::Rectangle;

// ---------------------------------------------------------------------------
// Public dispatch — compile-time cfg selects SIMD or scalar
// ---------------------------------------------------------------------------

/// Find the index of the free rectangle with the best area fit for a
/// `target_w × target_h` placement. Returns `None` if nothing fits.
#[inline]
pub fn find_best_fit(free_rects: &[Rectangle], target_w: i16, target_h: i16) -> Option<usize> {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    {
        wasm_simd::find_best_fit(free_rects, target_w, target_h)
    }

    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    {
        scalar::find_best_fit(free_rects, target_w, target_h)
    }
}

/// Remove free rectangles that are fully contained by other free rectangles.
#[inline]
pub fn prune_contained(rects: &mut Vec<Rectangle>) {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    {
        wasm_simd::prune_contained(rects)
    }

    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    {
        scalar::prune_contained(rects)
    }
}

// ---------------------------------------------------------------------------
// Scalar fallback
// ---------------------------------------------------------------------------

mod scalar {
    #![allow(dead_code)]
    use crate::rectangle::Rectangle;

    pub fn find_best_fit(
        free_rects: &[Rectangle],
        target_w: i16,
        target_h: i16,
    ) -> Option<usize> {
        let target_area = (target_w as i32) * (target_h as i32);
        let mut best_score = i32::MAX;
        let mut best_idx: Option<usize> = None;

        for (i, r) in free_rects.iter().enumerate() {
            if r.width >= target_w && r.height >= target_h {
                let area_fit = (r.width as i32) * (r.height as i32) - target_area;
                if area_fit < best_score {
                    best_score = area_fit;
                    best_idx = Some(i);
                }
            }
        }

        best_idx
    }

    pub fn prune_contained(rects: &mut Vec<Rectangle>) {
        let mut i: usize = 0;
        while i < rects.len() {
            let mut j = i + 1;
            let mut removed = false;
            while j < rects.len() {
                if rects[j].contain(&rects[i]) {
                    rects.remove(i);
                    removed = true;
                    break;
                }
                if rects[i].contain(&rects[j]) {
                    rects.remove(j);
                } else {
                    j += 1;
                }
            }
            if !removed {
                i += 1;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// WASM SIMD (simd128) implementation
// ---------------------------------------------------------------------------

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
mod wasm_simd {
    use crate::rectangle::Rectangle;
    use core::arch::wasm32::*;

    /// SIMD find_best_fit: processes 8 free rects per iteration.
    ///
    /// Gathers widths/heights into i16x8 vectors, batch-compares against
    /// target dimensions, computes area fits via widening multiply, then
    /// extracts the minimum.
    pub fn find_best_fit(
        free_rects: &[Rectangle],
        target_w: i16,
        target_h: i16,
    ) -> Option<usize> {
        let n = free_rects.len();
        if n == 0 {
            return None;
        }

        let target_area = (target_w as i32) * (target_h as i32);
        let mut best_score = i32::MAX;
        let mut best_idx: Option<usize> = None;

        let tw_v = i16x8_splat(target_w);
        let th_v = i16x8_splat(target_h);
        let ta_v = i32x4_splat(target_area);

        let full_chunks = n / 8;

        for c in 0..full_chunks {
            let base = c * 8;

            // Gather widths and heights from AoS into contiguous buffers
            let mut ws = [0i16; 8];
            let mut hs = [0i16; 8];
            for k in 0..8 {
                ws[k] = free_rects[base + k].width;
                hs[k] = free_rects[base + k].height;
            }

            unsafe {
                let v_ws = v128_load(ws.as_ptr() as *const v128);
                let v_hs = v128_load(hs.as_ptr() as *const v128);

                // Eligibility: width >= target_w AND height >= target_h
                let w_ok = i16x8_ge(v_ws, tw_v);
                let h_ok = i16x8_ge(v_hs, th_v);
                let eligible = v128_and(w_ok, h_ok);
                let mask = i16x8_bitmask(eligible);

                if mask == 0 {
                    continue;
                }

                // Widening multiply: area = w * h for 8 rects (split into 2×i32x4)
                let areas_lo = i32x4_extmul_low_i16x8(v_ws, v_hs);
                let areas_hi = i32x4_extmul_high_i16x8(v_ws, v_hs);
                let fits_lo = i32x4_sub(areas_lo, ta_v);
                let fits_hi = i32x4_sub(areas_hi, ta_v);

                // Store area_fit values back to memory for scalar min-search
                let mut fit_vals = [0i32; 8];
                v128_store(fit_vals.as_mut_ptr() as *mut v128, fits_lo);
                v128_store(fit_vals[4..].as_mut_ptr() as *mut v128, fits_hi);

                for k in 0..8u8 {
                    if (mask >> k) & 1 != 0 && fit_vals[k as usize] < best_score {
                        best_score = fit_vals[k as usize];
                        best_idx = Some(base + k as usize);
                    }
                }
            }
        }

        // Scalar remainder (< 8 rects)
        let start = full_chunks * 8;
        for i in start..n {
            let r = &free_rects[i];
            if r.width >= target_w && r.height >= target_h {
                let area_fit = (r.width as i32) * (r.height as i32) - target_area;
                if area_fit < best_score {
                    best_score = area_fit;
                    best_idx = Some(i);
                }
            }
        }

        best_idx
    }

    /// SIMD prune_contained: checks 2 containment pairs per SIMD operation.
    ///
    /// Uses "containment form" vectors `[min_x, min_y, -max_x, -max_y]` so that
    /// `b contains a` reduces to: all lanes of `(a_cf - b_cf) >= 0`.
    /// With i16x8, we pack two rects' CF into one register and check both
    /// via a single subtraction + bitmask.
    pub fn prune_contained(rects: &mut Vec<Rectangle>) {
        let n = rects.len();
        if n < 2 {
            return;
        }

        // Precompute containment-form: [min_x, min_y, -max_x, -max_y]
        let cf: Vec<[i16; 4]> = rects
            .iter()
            .map(|r| [r.x, r.y, -(r.x + r.width), -(r.y + r.height)])
            .collect();

        let mut to_remove = vec![false; n];

        for i in 0..n {
            if to_remove[i] {
                continue;
            }

            let ai = cf[i];
            let a_buf: [i16; 8] = [ai[0], ai[1], ai[2], ai[3], ai[0], ai[1], ai[2], ai[3]];

            let mut j = i + 1;

            // SIMD: process pairs of j values (2 containment checks per v128 op)
            while j + 1 < n {
                if to_remove[j] && to_remove[j + 1] {
                    j += 2;
                    continue;
                }

                let bj = cf[j];
                let bk = cf[j + 1];
                let b_buf: [i16; 8] =
                    [bj[0], bj[1], bj[2], bj[3], bk[0], bk[1], bk[2], bk[3]];

                unsafe {
                    let va = v128_load(a_buf.as_ptr() as *const v128);
                    let vb = v128_load(b_buf.as_ptr() as *const v128);

                    // a_cf - b_cf: lanes >= 0 means b contains a
                    let diff_ab = i16x8_sub(va, vb);
                    let mask_ab = i16x8_bitmask(diff_ab);

                    // b_cf - a_cf: lanes >= 0 means a contains b
                    let diff_ba = i16x8_sub(vb, va);
                    let mask_ba = i16x8_bitmask(diff_ba);

                    // Check j contains i (lower 4 lanes, bits 0-3)
                    if !to_remove[j] && (mask_ab & 0x0F) == 0 {
                        to_remove[i] = true;
                        break;
                    }
                    // Check i contains j
                    if !to_remove[j] && (mask_ba & 0x0F) == 0 {
                        to_remove[j] = true;
                    }

                    // Check j+1 contains i (upper 4 lanes, bits 4-7)
                    if !to_remove[j + 1] && (mask_ab & 0xF0) == 0 {
                        to_remove[i] = true;
                        break;
                    }
                    // Check i contains j+1
                    if !to_remove[j + 1] && (mask_ba & 0xF0) == 0 {
                        to_remove[j + 1] = true;
                    }
                }

                j += 2;
            }

            // Scalar remainder: single j left over
            if !to_remove[i] && j < n && !to_remove[j] {
                let d = [
                    ai[0] - cf[j][0],
                    ai[1] - cf[j][1],
                    ai[2] - cf[j][2],
                    ai[3] - cf[j][3],
                ];

                if d[0] >= 0 && d[1] >= 0 && d[2] >= 0 && d[3] >= 0 {
                    to_remove[i] = true;
                } else if d[0] <= 0 && d[1] <= 0 && d[2] <= 0 && d[3] <= 0 {
                    to_remove[j] = true;
                }
            }
        }

        // Remove marked rects (retain preserves order)
        let mut idx = 0;
        rects.retain(|_| {
            let keep = !to_remove[idx];
            idx += 1;
            keep
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rectangle::Rectangle;

    #[test]
    fn find_best_fit_empty() {
        assert_eq!(find_best_fit(&[], 10, 10), None);
    }

    #[test]
    fn find_best_fit_none_fit() {
        let rects = vec![Rectangle::new(0, 0, 5, 5), Rectangle::new(0, 0, 8, 3)];
        assert_eq!(find_best_fit(&rects, 10, 10), None);
    }

    #[test]
    fn find_best_fit_single() {
        let rects = vec![Rectangle::new(0, 0, 100, 100)];
        assert_eq!(find_best_fit(&rects, 50, 50), Some(0));
    }

    #[test]
    fn find_best_fit_picks_tightest() {
        let rects = vec![
            Rectangle::new(0, 0, 200, 200), // area 40000, fit = 40000 - 2500 = 37500
            Rectangle::new(0, 0, 60, 60),   // area 3600, fit = 3600 - 2500 = 1100
            Rectangle::new(0, 0, 50, 50),   // area 2500, fit = 0 (perfect)
            Rectangle::new(0, 0, 30, 30),   // too small
        ];
        assert_eq!(find_best_fit(&rects, 50, 50), Some(2));
    }

    #[test]
    fn find_best_fit_batch_boundary() {
        // 9 rects — tests the 8-rect SIMD batch + 1 scalar remainder
        let mut rects: Vec<Rectangle> = (0..8)
            .map(|_| Rectangle::new(0, 0, 5, 5)) // too small
            .collect();
        rects.push(Rectangle::new(0, 0, 100, 100)); // only one that fits
        assert_eq!(find_best_fit(&rects, 10, 10), Some(8));
    }

    #[test]
    fn prune_removes_contained() {
        let mut rects = vec![
            Rectangle::new(0, 0, 100, 100),
            Rectangle::new(10, 10, 50, 50), // contained by first
        ];
        prune_contained(&mut rects);
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0].width, 100);
    }

    #[test]
    fn prune_keeps_non_overlapping() {
        let mut rects = vec![
            Rectangle::new(0, 0, 50, 50),
            Rectangle::new(60, 60, 50, 50),
        ];
        prune_contained(&mut rects);
        assert_eq!(rects.len(), 2);
    }

    #[test]
    fn prune_equal_rects() {
        let mut rects = vec![
            Rectangle::new(0, 0, 50, 50),
            Rectangle::new(0, 0, 50, 50),
        ];
        prune_contained(&mut rects);
        assert_eq!(rects.len(), 1);
    }

    #[test]
    fn prune_chain() {
        // A contains B contains C → should keep only A
        let mut rects = vec![
            Rectangle::new(0, 0, 100, 100),
            Rectangle::new(10, 10, 50, 50),
            Rectangle::new(20, 20, 10, 10),
        ];
        prune_contained(&mut rects);
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0].width, 100);
    }

    #[test]
    fn prune_many_rects() {
        // Tests batch processing boundary (> 8 rects with various containment)
        let mut rects = vec![
            Rectangle::new(0, 0, 200, 200),  // big container
            Rectangle::new(5, 5, 10, 10),    // contained
            Rectangle::new(20, 20, 10, 10),  // contained
            Rectangle::new(40, 40, 10, 10),  // contained
            Rectangle::new(60, 60, 10, 10),  // contained
            Rectangle::new(80, 80, 10, 10),  // contained
            Rectangle::new(100, 100, 10, 10),// contained
            Rectangle::new(120, 120, 10, 10),// contained
            Rectangle::new(140, 140, 10, 10),// contained
            Rectangle::new(300, 300, 50, 50),// NOT contained (outside)
        ];
        prune_contained(&mut rects);
        assert_eq!(rects.len(), 2);
        assert_eq!(rects[0].width, 200);
        assert_eq!(rects[1].width, 50);
    }
}
