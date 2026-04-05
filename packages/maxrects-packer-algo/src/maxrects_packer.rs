use serde::{Deserialize, Serialize};

use crate::maxrects_bin::{MaxRectsBin, PackerOption};
use crate::oversized_element_bin::OversizedElementBin;
use crate::rectangle::{IRectangle, Rectangle};

pub use crate::maxrects_bin::EDGE_MAX_VALUE as _EDGE_MAX_VALUE;
pub const EDGE_MIN_VALUE: i16 = 128;

/// Serializable bin representation for save/load
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SavedBin {
    pub width: i16,
    pub height: i16,
    pub max_width: i16,
    pub max_height: i16,
    pub free_rects: Vec<IRectangle>,
    pub rects: Vec<IRectangle>,
    pub options: PackerOption,
}

/// Tagged enum for bins in the packer
pub enum Bin {
    MaxRects(MaxRectsBin),
    Oversized(OversizedElementBin),
}

impl Bin {
    pub fn width(&self) -> i16 {
        match self {
            Bin::MaxRects(b) => b.width,
            Bin::Oversized(b) => b.width,
        }
    }

    pub fn height(&self) -> i16 {
        match self {
            Bin::MaxRects(b) => b.height,
            Bin::Oversized(b) => b.height,
        }
    }

    pub fn rects(&self) -> &[Rectangle] {
        match self {
            Bin::MaxRects(b) => &b.rects,
            Bin::Oversized(b) => &b.rects,
        }
    }

    pub fn free_rects(&self) -> &[Rectangle] {
        match self {
            Bin::MaxRects(b) => &b.free_rects,
            Bin::Oversized(b) => &b.free_rects,
        }
    }

    pub fn options(&self) -> &PackerOption {
        match self {
            Bin::MaxRects(b) => &b.options,
            Bin::Oversized(b) => &b.options,
        }
    }

    pub fn max_width(&self) -> i16 {
        match self {
            Bin::MaxRects(b) => b.max_width,
            Bin::Oversized(b) => b.max_width,
        }
    }

    pub fn max_height(&self) -> i16 {
        match self {
            Bin::MaxRects(b) => b.max_height,
            Bin::Oversized(b) => b.max_height,
        }
    }

    pub fn add(
        &mut self,
        width: i16,
        height: i16,
        data: u32,
    ) -> Option<Rectangle> {
        match self {
            Bin::MaxRects(b) => b.add(width, height, data),
            Bin::Oversized(b) => b.add(width, height, data),
        }
    }
}

/// The main packer managing multiple bins
pub struct MaxRectsPacker {
    pub width: i16,
    pub height: i16,
    pub padding: i16,
    pub options: PackerOption,
    pub bins: Vec<Bin>,
}

impl MaxRectsPacker {
    pub fn new(width: i16, height: i16, padding: i16, options: PackerOption) -> Self {
        MaxRectsPacker {
            width,
            height,
            padding,
            options,
            bins: Vec::new(),
        }
    }

    /// Add a single rectangle to the packer
    pub fn add(&mut self, width: i16, height: i16, data: u32) {
        if width > self.width || height > self.height {
            self.bins
                .push(Bin::Oversized(OversizedElementBin::new(width, height, data)));
        } else {
            let added = self
                .bins
                .iter_mut()
                .any(|bin| bin.add(width, height, data).is_some());
            if !added {
                let mut bin =
                    MaxRectsBin::new(self.width, self.height, self.padding, self.options.clone());
                bin.add(width, height, data);
                self.bins.push(Bin::MaxRects(bin));
            }
        }
    }

    /// Add an array of rectangles, sorted by max dimension descending
    pub fn add_array(&mut self, rects: &[IRectangle]) {
        let sorted = Self::sort(rects);
        for r in sorted {
            self.add(r.width, r.height, r.data);
        }
    }

    /// Save current bins for later restoration
    pub fn save(&self) -> Vec<SavedBin> {
        self.bins
            .iter()
            .map(|bin| SavedBin {
                width: bin.width(),
                height: bin.height(),
                max_width: bin.max_width(),
                max_height: bin.max_height(),
                free_rects: bin
                    .free_rects()
                    .iter()
                    .map(|r| IRectangle {
                        x: r.x,
                        y: r.y,
                        width: r.width,
                        height: r.height,
                        data: 0,
                        oversized: false,
                    })
                    .collect(),
                rects: Vec::new(),
                options: bin.options().clone(),
            })
            .collect()
    }

    /// Load previously saved bins, overwriting current state
    pub fn load(&mut self, bins: &[SavedBin]) {
        for (index, saved) in bins.iter().enumerate() {
            if saved.max_width > self.width || saved.max_height > self.height {
                self.bins.push(Bin::Oversized(OversizedElementBin::new(
                    saved.width,
                    saved.height,
                    0,
                )));
            } else {
                let mut new_bin = MaxRectsBin::new(
                    self.width,
                    self.height,
                    self.padding,
                    saved.options.clone(),
                );
                new_bin.free_rects.clear();
                for r in &saved.free_rects {
                    new_bin
                        .free_rects
                        .push(Rectangle::new(r.x, r.y, r.width, r.height));
                }
                new_bin.width = saved.width;
                new_bin.height = saved.height;
                if index < self.bins.len() {
                    self.bins[index] = Bin::MaxRects(new_bin);
                } else {
                    self.bins.push(Bin::MaxRects(new_bin));
                }
            }
        }
    }

    /// Sort rectangles by max(width, height) descending
    pub fn sort(rects: &[IRectangle]) -> Vec<IRectangle> {
        let mut sorted = rects.to_vec();
        sorted.sort_by(|a, b| {
            let a_max = a.width.max(a.height);
            let b_max = b.width.max(b.height);
            b_max.cmp(&a_max)
        });
        sorted
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opt() -> PackerOption {
        PackerOption {
            smart: true,
            pot: false,
            square: false,
        }
    }

    fn val() -> u32 {
        0
    }

    #[test]
    fn adds_first_element() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        packer.add(1000, 1000, 1);
        assert_eq!(packer.bins[0].rects()[0].data, 1);
    }

    #[test]
    fn creates_additional_bin() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        packer.add(1000, 1000, 1);
        packer.add(1000, 1000, 2);
        assert_eq!(packer.bins.len(), 2);
        assert_eq!(packer.bins[1].rects()[0].data, 2);
    }

    #[test]
    fn adds_to_existing_bins() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        packer.add(1000, 1000, 1);
        packer.add(1000, 1000, 2);
        packer.add(10, 10, 3);
        packer.add(10, 10, 4);
        assert_eq!(packer.bins.len(), 2);
    }

    #[test]
    fn allows_oversized_elements() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        packer.add(1000, 1000, 1);
        packer.add(2000, 2000, 2);
        assert_eq!(packer.bins.len(), 2);
        assert_eq!(packer.bins[1].rects()[0].width, 2000);
        assert!(packer.bins[1].rects()[0].oversized);
    }

    #[test]
    fn sort_does_not_mutate() {
        let input = vec![
            IRectangle { x: 0, y: 0, width: 1, height: 1, data: val(), oversized: false },
            IRectangle { x: 0, y: 0, width: 2, height: 2, data: val(), oversized: false },
        ];
        MaxRectsPacker::sort(&input);
        assert_eq!(input[0].width, 1);
    }

    #[test]
    fn sort_works_correctly() {
        let input = vec![
            IRectangle { x: 0, y: 0, width: 1, height: 1, data: val(), oversized: false },
            IRectangle { x: 0, y: 0, width: 3, height: 1, data: val(), oversized: false },
            IRectangle { x: 0, y: 0, width: 2, height: 2, data: val(), oversized: false },
        ];
        let output = MaxRectsPacker::sort(&input);
        assert_eq!(output[0].width, 3);
        assert_eq!(output[1].width, 2);
        assert_eq!(output[2].width, 1);
    }

    #[test]
    fn add_array_multiple_elements() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        let input = vec![
            IRectangle { x: 0, y: 0, width: 1000, height: 1000, data: 1, oversized: false },
            IRectangle { x: 0, y: 0, width: 1000, height: 1000, data: 2, oversized: false },
        ];
        packer.add_array(&input);
        assert_eq!(packer.bins.len(), 2);
    }

    #[test]
    fn add_array_big_rects_first() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        let input = vec![
            IRectangle { x: 0, y: 0, width: 600, height: 20, data: 1, oversized: false },
            IRectangle { x: 0, y: 0, width: 600, height: 20, data: 2, oversized: false },
            IRectangle { x: 0, y: 0, width: 1000, height: 1000, data: 3, oversized: false },
            IRectangle { x: 0, y: 0, width: 1000, height: 1000, data: 4, oversized: false },
        ];
        packer.add_array(&input);
        assert_eq!(packer.bins.len(), 2);
    }

    #[test]
    fn save_and_load() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 0, opt());
        let input = vec![
            IRectangle { x: 0, y: 0, width: 512, height: 512, data: 1, oversized: false },
            IRectangle { x: 0, y: 0, width: 512, height: 512, data: 2, oversized: false },
            IRectangle { x: 0, y: 0, width: 512, height: 512, data: 3, oversized: false },
            IRectangle { x: 0, y: 0, width: 512, height: 512, data: 4, oversized: false },
        ];
        packer.add(input[0].width, input[0].height, input[0].data);
        assert_eq!(packer.bins.len(), 1);
        let bins = packer.save();
        assert_eq!(bins[0].free_rects.len(), 0);
        packer.load(&bins);
        packer.add_array(&input);
        assert_eq!(packer.bins.len(), 2);
    }

    #[test]
    fn passes_padding_through() {
        let mut packer = MaxRectsPacker::new(1024, 1024, 4, opt());
        packer.add(500, 500, 1);
        packer.add(500, 500, 1);
        packer.add(500, 500, 1);
        assert_eq!(packer.bins[0].width(), 1004);
    }
}
