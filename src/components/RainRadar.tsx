import type { RadarData } from "../types.ts";

interface Props {
  data?: RadarData;
}

const GRID_RADIUS = 1; // 3x3 grid

export default function RainRadar({ data }: Props) {
  if (!data) return null;

  const offsets: number[] = [];
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) offsets.push(i);

  return (
    <div className="rain-radar">
      <div className="rain-radar__grid">
        {offsets.map((dy) =>
          offsets.map((dx) => {
            const x = data.centerTileX + dx;
            const y = data.centerTileY + dy;
            const isCenter = dx === 0 && dy === 0;
            return (
              <div key={`${dx},${dy}`} className="rain-radar__cell">
                <img
                  className="rain-radar__base"
                  src={`https://tile.openstreetmap.org/${data.zoom}/${x}/${y}.png`}
                  alt=""
                />
                <img
                  className="rain-radar__precip"
                  src={`https://tilecache.rainviewer.com${data.radarPath}/128/${data.zoom}/${x}/${y}/2/1_1.png`}
                  alt=""
                />
                {isCenter && <span className="rain-radar__marker" />}
              </div>
            );
          })
        )}
      </div>
      <p className="rain-radar__attribution">© OpenStreetMap contributors / RainViewer.com</p>
    </div>
  );
}
