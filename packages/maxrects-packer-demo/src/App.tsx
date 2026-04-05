import { useState, useCallback, useEffect } from "react";
import Controls from "./components/Controls";
import PackingCanvas from "./components/PackingCanvas";
import { initWasm, packRects, Rect, Bin } from "./packer";

export interface PackerConfig {
  count: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  areaWidth: number;
  areaHeight: number;
}

const defaultConfig: PackerConfig = {
  count: 50,
  minWidth: 10,
  maxWidth: 100,
  minHeight: 10,
  maxHeight: 100,
  areaWidth: 1024,
  areaHeight: 1024,
};

export default function App() {
  const [config, setConfig] = useState<PackerConfig>(defaultConfig);
  const [rects, setRects] = useState<Rect[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initWasm()
      .then(() => setWasmReady(true))
      .catch((e: Error) => setError(`Failed to load WASM: ${e.message}`));
  }, []);

  const handleGenerate = useCallback(() => {
    const { count, minWidth, maxWidth, minHeight, maxHeight } = config;
    const newRects: Rect[] = [];
    for (let i = 0; i < count; i++) {
      newRects.push({
        width:
          Math.floor(Math.random() * (maxWidth - minWidth + 1)) + minWidth,
        height:
          Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight,
      });
    }
    setRects(newRects);
    setBins([]);
    setError(null);
  }, [config]);

  const handlePack = useCallback(async () => {
    if (rects.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await packRects(rects, config.areaWidth, config.areaHeight);
      setBins(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Packing failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [rects, config.areaWidth, config.areaHeight]);

  const totalPacked = bins.reduce((sum, b) => sum + b.rects.length, 0);

  return (
    <div className="app">
      <h1>MaxRects Packer Demo</h1>
      {error && <div className="error">{error}</div>}
      <Controls
        config={config}
        onConfigChange={setConfig}
        onGenerate={handleGenerate}
        onPack={handlePack}
        canPack={rects.length > 0 && wasmReady && !loading}
        canGenerate={!loading}
      />
      {rects.length > 0 && bins.length === 0 && !loading && (
        <div className="stats">
          {rects.length} rectangles generated. Click &ldquo;Pack&rdquo; to pack
          them.
        </div>
      )}
      {bins.length > 0 && (
        <div className="stats">
          {bins.length} bin{bins.length > 1 ? "s" : ""} &bull; {totalPacked}{" "}
          rectangle{totalPacked !== 1 ? "s" : ""} packed
        </div>
      )}
      {loading && <div className="stats loading">Packing&hellip;</div>}
      <PackingCanvas bins={bins} />
    </div>
  );
}
