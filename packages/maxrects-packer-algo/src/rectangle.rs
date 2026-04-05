use serde::{Deserialize, Serialize};

/// Interface for rectangle-like objects passed from JS
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IRectangle {
    pub x: i16,
    pub y: i16,
    pub width: i16,
    pub height: i16,
    #[serde(default)]
    pub data: u32,
    #[serde(default)]
    pub oversized: bool,
}

/// Core rectangle used internally by the packing algorithm
#[derive(Clone, Debug)]
pub struct Rectangle {
    pub x: i16,
    pub y: i16,
    pub width: i16,
    pub height: i16,
    pub data: u32,
    pub oversized: bool,
}

impl Rectangle {
    pub fn new(x: i16, y: i16, width: i16, height: i16) -> Self {
        Rectangle {
            x,
            y,
            width,
            height,
            data: 0,
            oversized: false,
        }
    }

    pub fn area(&self) -> i32 {
        (self.width as i32) * (self.height as i32)
    }

    /// Test if this rectangle collides (overlaps) with another
    pub fn collide(&self, rect: &Rectangle) -> bool {
        !(rect.x >= self.x + self.width
            || rect.x + rect.width <= self.x
            || rect.y >= self.y + self.height
            || rect.y + rect.height <= self.y)
    }

    /// Test if this rectangle fully contains another
    pub fn contain(&self, rect: &Rectangle) -> bool {
        rect.x >= self.x
            && rect.y >= self.y
            && rect.x + rect.width <= self.x + self.width
            && rect.y + rect.height <= self.y + self.height
    }

    pub fn to_irectangle(&self) -> IRectangle {
        IRectangle {
            x: self.x,
            y: self.y,
            width: self.width,
            height: self.height,
            data: self.data,
            oversized: self.oversized,
        }
    }
}

impl From<&IRectangle> for Rectangle {
    fn from(r: &IRectangle) -> Self {
        Rectangle {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            data: r.data,
            oversized: r.oversized,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_area() {
        let r = Rectangle::new(0, 0, 10, 20);
        assert_eq!(r.area(), 200);
    }

    #[test]
    fn test_collide_overlapping() {
        let a = Rectangle::new(0, 0, 10, 10);
        let b = Rectangle::new(5, 5, 10, 10);
        assert!(a.collide(&b));
        assert!(b.collide(&a));
    }

    #[test]
    fn test_collide_no_overlap() {
        let a = Rectangle::new(0, 0, 10, 10);
        let b = Rectangle::new(10, 0, 10, 10);
        assert!(!a.collide(&b));
    }

    #[test]
    fn test_collide_touching_edge() {
        let a = Rectangle::new(0, 0, 10, 10);
        let b = Rectangle::new(10, 10, 10, 10);
        assert!(!a.collide(&b));
    }

    #[test]
    fn test_contain() {
        let outer = Rectangle::new(0, 0, 100, 100);
        let inner = Rectangle::new(10, 10, 50, 50);
        assert!(outer.contain(&inner));
        assert!(!inner.contain(&outer));
    }

    #[test]
    fn test_contain_same_size() {
        let a = Rectangle::new(0, 0, 10, 10);
        let b = Rectangle::new(0, 0, 10, 10);
        assert!(a.contain(&b));
        assert!(b.contain(&a));
    }

    #[test]
    fn test_contain_partial() {
        let a = Rectangle::new(0, 0, 10, 10);
        let b = Rectangle::new(5, 5, 10, 10);
        assert!(!a.contain(&b));
    }
}
