import { PackerConfig } from "../App";
import "./Controls.css";

const POWER_OF_TWO = [64, 128, 256, 512, 1024, 2048, 4096];

interface Props {
  config: PackerConfig;
  onConfigChange: (config: PackerConfig) => void;
  onGenerate: () => void;
  onPack: () => void;
  canPack: boolean;
  canGenerate: boolean;
}

export default function Controls({
  config,
  onConfigChange,
  onGenerate,
  onPack,
  canPack,
  canGenerate,
}: Props) {
  const update = (key: keyof PackerConfig, value: number) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="controls">
      <div className="controls-grid">
        <div className="control-group">
          <label htmlFor="count">Rectangle Count</label>
          <input
            id="count"
            type="number"
            min={1}
            max={500}
            value={config.count}
            onChange={(e) =>
              update("count", Math.max(1, Math.min(500, Number(e.target.value))))
            }
          />
        </div>
        <div className="control-group">
          <label htmlFor="minWidth">Min Width</label>
          <input
            id="minWidth"
            type="number"
            min={1}
            max={4096}
            value={config.minWidth}
            onChange={(e) =>
              update("minWidth", Math.max(1, Number(e.target.value)))
            }
          />
        </div>
        <div className="control-group">
          <label htmlFor="maxWidth">Max Width</label>
          <input
            id="maxWidth"
            type="number"
            min={1}
            max={4096}
            value={config.maxWidth}
            onChange={(e) =>
              update("maxWidth", Math.max(1, Number(e.target.value)))
            }
          />
        </div>
        <div className="control-group">
          <label htmlFor="minHeight">Min Height</label>
          <input
            id="minHeight"
            type="number"
            min={1}
            max={4096}
            value={config.minHeight}
            onChange={(e) =>
              update("minHeight", Math.max(1, Number(e.target.value)))
            }
          />
        </div>
        <div className="control-group">
          <label htmlFor="maxHeight">Max Height</label>
          <input
            id="maxHeight"
            type="number"
            min={1}
            max={4096}
            value={config.maxHeight}
            onChange={(e) =>
              update("maxHeight", Math.max(1, Number(e.target.value)))
            }
          />
        </div>
        <div className="control-group">
          <label htmlFor="areaWidth">Area Width</label>
          <select
            id="areaWidth"
            value={config.areaWidth}
            onChange={(e) => update("areaWidth", Number(e.target.value))}
          >
            {POWER_OF_TWO.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="areaHeight">Area Height</label>
          <select
            id="areaHeight"
            value={config.areaHeight}
            onChange={(e) => update("areaHeight", Number(e.target.value))}
          >
            {POWER_OF_TWO.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="controls-actions">
        <button
          className="btn-generate"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          Generate
        </button>
        <button className="btn-pack" onClick={onPack} disabled={!canPack}>
          Pack
        </button>
      </div>
    </div>
  );
}
