use crate::maxrects_bin::PackerOption;
use crate::rectangle::Rectangle;

/// Special bin for a single oversized element that exceeds max dimensions
pub struct OversizedElementBin {
    pub width: i16,
    pub height: i16,
    pub max_width: i16,
    pub max_height: i16,
    pub rects: Vec<Rectangle>,
    pub free_rects: Vec<Rectangle>,
    pub options: PackerOption,
}

impl OversizedElementBin {
    pub fn new(width: i16, height: i16, data: u32) -> Self {
        let mut rect = Rectangle::new(0, 0, width, height);
        rect.data = data;
        rect.oversized = true;

        OversizedElementBin {
            width,
            height,
            max_width: width,
            max_height: height,
            rects: vec![rect],
            free_rects: Vec::new(),
            options: PackerOption {
                smart: false,
                pot: false,
                square: false,
            },
        }
    }

    pub fn add(&mut self, _width: i16, _height: i16, _data: u32) -> Option<Rectangle> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_data_correctly() {
        let bin = OversizedElementBin::new(2000, 2000, 42);
        assert_eq!(bin.width, 2000);
        assert_eq!(bin.height, 2000);
        assert_eq!(bin.rects[0].x, 0);
        assert_eq!(bin.rects[0].y, 0);
        assert_eq!(bin.rects[0].width, 2000);
        assert_eq!(bin.rects[0].height, 2000);
        assert_eq!(bin.rects[0].data, 42);
        assert!(bin.rects[0].oversized);
    }

    #[test]
    fn add_returns_none() {
        let mut bin = OversizedElementBin::new(2000, 2000, 42);
        assert!(bin.add(1, 1, 0).is_none());
    }
}
