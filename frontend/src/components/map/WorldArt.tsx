import { memo, useEffect, useRef } from "react";
import type { MapController } from "./useMapView";
import { getWorld, WORLD_H, WORLD_W } from "./world";

const LEVEL_RADII = [92, 68, 46, 26];
const RIPPLE_OPACITY = [0.75, 0.5, 0.3];

const GRID =
  Array.from({ length: 15 }, (_, i) => `M${(i + 1) * 100} 0V${WORLD_H}`).join("") +
  Array.from({ length: 9 }, (_, i) => `M0 ${(i + 1) * 100}H${WORLD_W}`).join("");

// The artwork never re-renders. It is drawn once; panning and zooming only change the
// transform on one <g>, written directly to the DOM by the map controller.
function WorldArt({ controller }: { controller: MapController }) {
  const world = getWorld();
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);

  useEffect(
    () =>
      controller.subscribe((v, lod) => {
        groupRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.k})`);
        if (svgRef.current) svgRef.current.dataset.lod = String(lod);
      }),
    [controller],
  );

  return (
    <svg ref={svgRef} data-lod="0" className="mr-svg absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="mr-land-clip">
          <path d={world.coast} />
        </clipPath>
        <clipPath id="mr-frame-clip">
          <rect x={24} y={24} width={WORLD_W - 48} height={WORLD_H - 48} />
        </clipPath>
        <radialGradient id="mr-sea-g" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" style={{ stopColor: "var(--map-sea-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--map-sea-b)" }} />
        </radialGradient>
        <radialGradient id="mr-land-g" cx="0.4" cy="0.35" r="0.85">
          <stop offset="0" style={{ stopColor: "var(--map-land-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--map-land-b)" }} />
        </radialGradient>
        {world.labels.map((l) => (
          <path key={l.id} id={`mr-lbl-${l.id}`} d={l.d} />
        ))}
      </defs>

      <g ref={groupRef}>
        {/* Sea, with a faint graticule and portolan rhumb lines */}
        <rect x={-1200} y={-1000} width={WORLD_W + 2400} height={WORLD_H + 2000} fill="url(#mr-sea-g)" />
        <path className="mr-grid" d={GRID} />
        <g clipPath="url(#mr-frame-clip)">
          <path className="mr-rhumb" d={world.rhumb} />
        </g>
        <path className="mr-wave mr-lod-1" d={world.waves} />

        {/* The land sits on the sheet: a soft lift shadow, then engraved water-lines and shallows */}
        <path className="mr-lift" d={world.coast} transform="translate(3 6)" />
        {world.ripples.map((d, i) => (
          <path key={i} className="mr-ripple" d={d} opacity={RIPPLE_OPACITY[i]} />
        ))}
        <path className="mr-halo" d={world.coast} strokeWidth={58} opacity={0.3} />
        <path className="mr-halo" d={world.coast} strokeWidth={36} opacity={0.45} />
        <path className="mr-halo" d={world.coast} strokeWidth={18} opacity={0.65} />

        <path className="mr-ship mr-lod-1" d={world.ships} />

        {/* Land */}
        <path className="mr-land" d={world.coast} />

        <g clipPath="url(#mr-land-clip)">
          {world.meadows.map((d, i) => (
            <path key={i} className="mr-meadow" d={d} />
          ))}
          {/* Shore tint, so the land seems to rise from the water */}
          <path className="mr-rim" d={world.coast} strokeWidth={30} opacity={0.5} />
          <path className="mr-rim" d={world.coast} strokeWidth={12} opacity={0.6} />

          {/* Elevation: each ribbon is an offset of the ridge line, giving true contour edges. */}
          {LEVEL_RADII.map((r, i) =>
            world.spines.map((d, s) => {
              const rr = r * (world.spineScale[s] ?? 1);
              return (
                <g key={`${i}-${s}`}>
                  <path className="mr-ribbon mr-hyp-line" d={d} strokeWidth={rr * 2} />
                  <path className={`mr-ribbon mr-hyp-${i + 1}`} d={d} strokeWidth={rr * 2 - 1.6} />
                </g>
              );
            }),
          )}

          <path className="mr-stipple" d={world.stipple} />
          {world.rivers.map((d, i) => (
            <g key={i}>
              <path className="mr-river-under" d={d} />
              <path className="mr-river" d={d} />
            </g>
          ))}
        </g>

        {world.lakes.map((d, i) => (
          <path key={i} className="mr-water" d={d} />
        ))}

        <path className="mr-coast" d={world.coast} />
        <path className="mr-grove" d={world.grove} />
        <path className="mr-forest" d={world.forest} />

        {/* Names, used for atmosphere only */}
        {world.labels.map((l) => (
          <text key={l.id} className={`mr-label mr-label-${l.kind} ${l.kind === "isle" ? "mr-lod-1" : ""}`} fontSize={l.size} letterSpacing={l.spacing}>
            <textPath href={`#mr-lbl-${l.id}`} startOffset="50%" textAnchor="middle">
              {l.text}
            </textPath>
          </text>
        ))}

        {world.peaks.map((p, i) => (
          <g key={i}>
            <path className="mr-peak" d={p.body} />
            <path className="mr-shade" d={p.shade} />
            {p.snow && <path className="mr-snow" d={p.snow} />}
          </g>
        ))}

        {/* Compass rose */}
        <g transform="translate(150 885)" className="mr-compass">
          <circle r={36} />
          <circle r={30} className="mr-compass-fine" />
          <path className="mr-compass-star" d="M0 -48L7 -7L48 0L7 7L0 48L-7 7L-48 0L-7 -7Z" />
          <path className="mr-compass-fine" d="M0 -30L5 -5L30 0L5 5L0 30L-5 5L-30 0L-5 -5Z" transform="rotate(45)" />
          <text y={-58} textAnchor="middle" className="mr-label mr-label-land" fontSize={14}>
            N
          </text>
        </g>

        {/* Scale bar */}
        <g transform="translate(1360 940)" className="mr-scale mr-lod-1">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 30} y={0} width={30} height={5} className={i % 2 ? "mr-scale-b" : "mr-scale-a"} />
          ))}
          <text x={0} y={-5} fontSize={9} className="mr-label mr-label-land">
            0
          </text>
          <text x={126} y={5} fontSize={9} className="mr-label mr-label-land">
            100 leagues
          </text>
        </g>

        {/* Atlas border with graduated ticks */}
        <path className="mr-ticks" d={world.ticks} />
        <rect className="mr-frame" x={24} y={24} width={WORLD_W - 48} height={WORLD_H - 48} />
        <rect className="mr-frame mr-frame-fine" x={32} y={32} width={WORLD_W - 64} height={WORLD_H - 64} />
      </g>
    </svg>
  );
}

export default memo(WorldArt);