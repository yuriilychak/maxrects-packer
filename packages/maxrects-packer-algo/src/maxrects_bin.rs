use serde::{Deserialize, Serialize};

use crate::rectangle::Rectangle;

pub const EDGE_MAX_VALUE: i16 = 4096;

/// Packing options
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackerOption {
    #[serde(default = "default_true")]
    pub smart: bool,
    #[serde(default = "default_true")]
    pub pot: bool,
    #[serde(default)]
    pub square: bool,
}

fn default_true() -> bool {
    true
}

impl Default for PackerOption {
    fn default() -> Self {
        PackerOption {
            smart: true,
            pot: true,
            square: true,
        }
    }
}

impl From<u8> for PackerOption {
    fn from(bits: u8) -> Self {
        PackerOption {
            smart: bits & 0b001 != 0,
            pot: bits & 0b010 != 0,
            square: bits & 0b100 != 0,
        }
    }
}

impl From<&PackerOption> for u8 {
    fn from(opt: &PackerOption) -> Self {
        let mut bits: u8 = 0;
        if opt.smart { bits |= 0b001; }
        if opt.pot { bits |= 0b010; }
        if opt.square { bits |= 0b100; }
        bits
    }
}

/// A single bin that packs rectangles using the MaxRects algorithm
pub struct MaxRectsBin {
    pub width: i16,
    pub height: i16,
    pub max_width: i16,
    pub max_height: i16,
    pub padding: i16,
    pub free_rects: Vec<Rectangle>,
    pub rects: Vec<Rectangle>,
    pub options: PackerOption,
    vertical_expand: bool,
    stage: Rectangle,
}

impl MaxRectsBin {
    pub fn new(max_width: i16, max_height: i16, padding: i16, options: PackerOption) -> Self {
        let width = if options.smart { 0 } else { max_width };
        let height = if options.smart { 0 } else { max_height };
        let stage = Rectangle::new(0, 0, width, height);

        let mut bin = MaxRectsBin {
            width,
            height,
            max_width,
            max_height,
            padding,
            free_rects: Vec::new(),
            rects: Vec::new(),
            options,
            vertical_expand: false,
            stage,
        };
        bin.free_rects.push(Rectangle::new(
            0,
            0,
            max_width + padding,
            max_height + padding,
        ));
        bin
    }

    /// Try to add a rectangle to this bin. Returns the placed rectangle or None.
    pub fn add(
        &mut self,
        width: i16,
        height: i16,
        data: u32,
    ) -> Option<Rectangle> {
        let node = self.find_node(width + self.padding, height + self.padding);
        if let Some(node) = node {
            self.update_bin_size(&node);
            let mut i: usize = 0;
            let mut num_to_process = self.free_rects.len();
            while i < num_to_process {
                if self.split_node(i, &node) {
                    self.free_rects.remove(i);
                    num_to_process -= 1;
                } else {
                    i += 1;
                }
            }
            self.prune_free_list();
            self.vertical_expand = self.width > self.height;
            let mut rect = Rectangle::new(node.x, node.y, width, height);
            rect.data = data;
            self.rects.push(rect.clone());
            Some(rect)
        } else if !self.vertical_expand {
            // Try expanding horizontally first, then vertically
            let try_h = Rectangle::new(
                self.width + self.padding,
                0,
                width + self.padding,
                height + self.padding,
            );
            let try_v = Rectangle::new(
                0,
                self.height + self.padding,
                width + self.padding,
                height + self.padding,
            );
            if self.update_bin_size(&try_h) || self.update_bin_size(&try_v) {
                return self.add(width, height, data);
            }
            None
        } else {
            // Try expanding vertically first, then horizontally
            let try_v = Rectangle::new(
                0,
                self.height + self.padding,
                width + self.padding,
                height + self.padding,
            );
            let try_h = Rectangle::new(
                self.width + self.padding,
                0,
                width + self.padding,
                height + self.padding,
            );
            if self.update_bin_size(&try_v) || self.update_bin_size(&try_h) {
                return self.add(width, height, data);
            }
            None
        }
    }

    /// Find the best free rectangle to place a node of given size (Best Area Fit)
    fn find_node(&self, width: i16, height: i16) -> Option<Rectangle> {
        let idx = crate::simd_ops::find_best_fit(&self.free_rects, width, height)?;
        let r = &self.free_rects[idx];
        Some(Rectangle::new(r.x, r.y, width, height))
    }

    /// Split a free rectangle around a used node. Returns true if the free rect was split.
    fn split_node(&mut self, free_rect_idx: usize, used_node: &Rectangle) -> bool {
        let fr = &self.free_rects[free_rect_idx];
        if !fr.collide(used_node) {
            return false;
        }

        // We need to read free_rect fields before mutating self
        let fr_x = fr.x;
        let fr_y = fr.y;
        let fr_w = fr.width;
        let fr_h = fr.height;

        // Vertical split
        if used_node.x < fr_x + fr_w && used_node.x + used_node.width > fr_x {
            // Top side
            if used_node.y > fr_y && used_node.y < fr_y + fr_h {
                let new_node = Rectangle::new(fr_x, fr_y, fr_w, used_node.y - fr_y);
                self.free_rects.push(new_node);
            }
            // Bottom side
            if used_node.y + used_node.height < fr_y + fr_h {
                let new_node = Rectangle::new(
                    fr_x,
                    used_node.y + used_node.height,
                    fr_w,
                    fr_y + fr_h - (used_node.y + used_node.height),
                );
                self.free_rects.push(new_node);
            }
        }

        // Horizontal split
        if used_node.y < fr_y + fr_h && used_node.y + used_node.height > fr_y {
            // Left side
            if used_node.x > fr_x && used_node.x < fr_x + fr_w {
                let new_node = Rectangle::new(fr_x, fr_y, used_node.x - fr_x, fr_h);
                self.free_rects.push(new_node);
            }
            // Right side
            if used_node.x + used_node.width < fr_x + fr_w {
                let new_node = Rectangle::new(
                    used_node.x + used_node.width,
                    fr_y,
                    fr_x + fr_w - (used_node.x + used_node.width),
                    fr_h,
                );
                self.free_rects.push(new_node);
            }
        }

        true
    }

    /// Remove redundant free rectangles (contained within others)
    fn prune_free_list(&mut self) {
        crate::simd_ops::prune_contained(&mut self.free_rects);
    }

    /// Update bin size to accommodate a new node. Returns true if expansion succeeded.
    fn update_bin_size(&mut self, node: &Rectangle) -> bool {
        if !self.options.smart {
            return false;
        }
        if self.stage.contain(node) {
            return false;
        }
        let mut tmp_width = self.width.max(node.x + node.width - self.padding);
        let mut tmp_height = self.height.max(node.y + node.height - self.padding);
        if self.options.pot {
            tmp_width = (tmp_width as u32).next_power_of_two() as i16;
            tmp_height = (tmp_height as u32).next_power_of_two() as i16;
        }
        if self.options.square {
            tmp_width = tmp_width.max(tmp_height);
            tmp_height = tmp_width;
        }
        if tmp_width > self.max_width + self.padding || tmp_height > self.max_height + self.padding
        {
            return false;
        }
        self.expand_free_rects(tmp_width + self.padding, tmp_height + self.padding);
        self.width = tmp_width;
        self.height = tmp_height;
        self.stage.width = tmp_width;
        self.stage.height = tmp_height;
        true
    }

    /// Expand free rectangles when the bin grows
    fn expand_free_rects(&mut self, width: i16, height: i16) {
        for fr in self.free_rects.iter_mut() {
            if fr.x + fr.width >= (self.width + self.padding).min(width) {
                fr.width = width - fr.x;
            }
            if fr.y + fr.height >= (self.height + self.padding).min(height) {
                fr.height = height - fr.y;
            }
        }
        self.free_rects.push(Rectangle::new(
            self.width + self.padding,
            0,
            width - self.width - self.padding,
            height,
        ));
        self.free_rects.push(Rectangle::new(
            0,
            self.height + self.padding,
            width,
            height - self.height - self.padding,
        ));
        self.free_rects.retain(|fr| fr.width > 0 && fr.height > 0);
        self.prune_free_list();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opt() -> PackerOption {
        PackerOption {
            smart: true,
            pot: true,
            square: false,
        }
    }

    fn val() -> u32 {
        0
    }

    #[test]
    fn initially_zero_size() {
        let bin = MaxRectsBin::new(1024, 1024, 0, opt());
        assert_eq!(bin.width, 0);
        assert_eq!(bin.height, 0);
    }

    #[test]
    fn adds_rects_correctly() {
        let mut bin = MaxRectsBin::new(1024, 1024, 0, opt());
        let pos = bin.add(200, 100, val()).unwrap();
        assert_eq!(pos.x, 0);
        assert_eq!(pos.y, 0);
    }

    #[test]
    fn updates_size_correctly() {
        let mut bin = MaxRectsBin::new(1024, 1024, 0, opt());
        bin.add(200, 100, val());
        assert_eq!(bin.width, 256);
        assert_eq!(bin.height, 128);
    }

    #[test]
    fn stores_data_correctly() {
        let mut bin = MaxRectsBin::new(1024, 1024, 0, opt());
        bin.add(200, 100, 42);
        assert_eq!(bin.rects[0].data, 42);
    }

    #[test]
    fn fits_squares_correctly() {
        let mut bin = MaxRectsBin::new(1024, 1024, 0, opt());
        let mut i: u32 = 0;
        while bin.add(100, 100, i).is_some() {
            i += 1;
            if i == 1000 {
                break;
            }
        }
        assert_eq!(i, 100);
        assert_eq!(bin.rects.len(), 100);
        assert_eq!(bin.width, 1024);
        assert_eq!(bin.height, 1024);
        for (idx, rect) in bin.rects.iter().enumerate() {
            assert_eq!(rect.data, idx as u32);
        }
    }

    #[test]
    fn monkey_test_no_padding() {
        use rand::prelude::*;
        use rand_chacha::ChaCha8Rng;
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let mut bin = MaxRectsBin::new(1024, 1024, 0, opt());
        let mut rects = Vec::new();
        loop {
            let w = (rng.gen::<f64>() * 200.0).floor() as i16;
            let h = (rng.gen::<f64>() * 200.0).floor() as i16;
            if let Some(pos) = bin.add(w, h, val()) {
                assert_eq!(pos.width, w);
                assert_eq!(pos.height, h);
                rects.push(pos);
            } else {
                break;
            }
        }
        assert!(bin.width <= 1024);
        assert!(bin.height <= 1024);
        // Check no overlaps
        for (i, r1) in rects.iter().enumerate() {
            for (j, r2) in rects.iter().enumerate() {
                if i != j {
                    let intersect = r1.x < r2.x + r2.width
                        && r2.x < r1.x + r1.width
                        && r1.y < r2.y + r2.height
                        && r2.y < r1.y + r1.height;
                    assert!(!intersect, "intersection: {:?} vs {:?}", r1, r2);
                }
            }
            assert!(r1.x + r1.width <= bin.width);
            assert!(r1.y + r1.height <= bin.height);
        }
    }

    #[test]
    fn padding_initially_empty() {
        let bin = MaxRectsBin::new(1024, 1024, 4, opt());
        assert_eq!(bin.width, 0);
        assert_eq!(bin.height, 0);
    }

    #[test]
    fn padding_handles_correctly() {
        let mut bin = MaxRectsBin::new(1024, 1024, 4, opt());
        bin.add(512, 512, val());
        bin.add(508, 512, val());
        bin.add(512, 508, val());
        assert_eq!(bin.width, 1024);
        assert_eq!(bin.height, 1024);
        assert_eq!(bin.rects.len(), 3);
    }

    #[test]
    fn padding_adds_rects_close_to_max() {
        let mut bin = MaxRectsBin::new(1024, 1024, 4, opt());
        assert!(bin.add(1024, 1024, val()).is_some());
        assert_eq!(bin.rects.len(), 1);
    }

    #[test]
    fn monkey_test_padding() {
        use rand::prelude::*;
        use rand_chacha::ChaCha8Rng;
        let mut rng = ChaCha8Rng::seed_from_u64(99);
        let mut bin = MaxRectsBin::new(1024, 1024, 40, PackerOption::default());
        let mut rects = Vec::new();
        loop {
            let w = (rng.gen::<f64>() * 200.0).floor() as i16;
            let h = (rng.gen::<f64>() * 200.0).floor() as i16;
            if let Some(pos) = bin.add(w, h, val()) {
                assert_eq!(pos.width, w);
                assert_eq!(pos.height, h);
                rects.push(pos);
            } else {
                break;
            }
        }
        assert!(bin.width <= 1024);
        assert!(bin.height <= 1024);
        for (i, r1) in rects.iter().enumerate() {
            for (j, r2) in rects.iter().enumerate() {
                if i != j {
                    let intersect = r1.x < r2.x + r2.width
                        && r2.x < r1.x + r1.width
                        && r1.y < r2.y + r2.height
                        && r2.y < r1.y + r1.height;
                    assert!(!intersect, "intersection: {:?} vs {:?}", r1, r2);
                }
            }
            assert!(r1.x + r1.width <= bin.width);
            assert!(r1.y + r1.height <= bin.height);
        }
    }
}
