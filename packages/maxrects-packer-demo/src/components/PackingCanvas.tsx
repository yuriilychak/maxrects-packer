import { useRef, useEffect } from "react";
import { Bin } from "../packer";
import "./PackingCanvas.css";

interface Props {
  bins: Bin[];
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

function getColor(tag: number): string {
  const hue = (tag * 137.508) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export default function PackingCanvas({ bins }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (bins.length === 0) return;

    const maxDim = Math.max(...bins.map((b) => Math.max(b.width, b.height)));
    const binGap = maxDim * 0.05;

    const totalWidth =
      bins.reduce((s, b) => s + b.width, 0) + binGap * (bins.length - 1);
    const maxHeight = Math.max(...bins.map((b) => b.height));

    const scaleX = CANVAS_WIDTH / totalWidth;
    const scaleY = CANVAS_HEIGHT / maxHeight;
    const scale = Math.min(scaleX, scaleY) * 0.92;

    const scaledTotalW =
      (bins.reduce((s, b) => s + b.width, 0) + binGap * (bins.length - 1)) *
      scale;
    const scaledMaxH = maxHeight * scale;

    let offsetX = (CANVAS_WIDTH - scaledTotalW) / 2;
    const offsetY = (CANVAS_HEIGHT - scaledMaxH) / 2;

    for (const bin of bins) {
      // Bin background
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(offsetX, offsetY, bin.width * scale, bin.height * scale);

      // Bin border
      ctx.strokeStyle = "#343a40";
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, offsetY, bin.width * scale, bin.height * scale);

      // Rectangles
      for (const rect of bin.rects) {
        const rx = offsetX + rect.x * scale;
        const ry = offsetY + rect.y * scale;
        const rw = rect.width * scale;
        const rh = rect.height * scale;

        ctx.fillStyle = getColor(rect.tag);
        ctx.fillRect(rx, ry, rw, rh);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
      }

      offsetX += (bin.width + binGap) * scale;
    }
  }, [bins]);

  if (bins.length === 0) {
    return (
      <div className="canvas-container">
        <div className="canvas-placeholder">
          Generate rectangles and pack them to see the result
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
