import { memo, useEffect, useRef } from "react";
import type { MapController } from "./useMapView";
import { getWorld, WORLD_H, WORLD_W } from "./world";

const LEVEL_RADII = [92, 68, 46, 26];

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
        {/* Sea */}
        <rect x={-1200} y={-1000} width={WORLD_W + 2400} height={WORLD_H + 2000} fill="url(#mr-sea-g)" />
        <path
          className="mr-grid"
          d={Array.from({ length: 15 }, (_, i) => `M${(i + 1) * 100} 0V${WORLD_H}`).join("") + Array.from({ length: 9 }, (_, i) => `M0 ${(i + 1) * 100}H${WORLD_W}`).join("")}
        />
        <path className="mr-wave mr-lod-1" d={world.waves} />

        {/* Shallow water around every coast */}
        <path className="mr-halo" d={world.coast} strokeWidth={58} opacity={0.3} />
        <path className="mr-halo" d={world.coast} strokeWidth={36} opacity={0.45} />
        <path className="mr-halo" d={world.coast} strokeWidth={18} opacity={0.65} />

        {/* Land */}
        <path className="mr-land" d={world.coast} />

        <g clipPath="url(#mr-land-clip)">
          {/* Elevation: each ribbon is an offset of the ridge line, giving true contour edges. */}
          {LEVEL_RADII.map((r, i) =>
            world.spines.map((d, s) => {
              // Indexing can give undefined under strict settings, so fall back to full size.
              const scale = world.spineScale[s] ?? 1;
              const rr = r * scale;
              return (
                <g key={`${i}-${s}`}>
                  <path className="mr-ribbon mr-hyp-line" d={d} strokeWidth={rr * 2} />
                  <path className={`mr-ribbon mr-hyp-${i + 1}`} d={d} strokeWidth={rr * 2 - 1.6} />
                </g>
              );
            }),
          )}
          {world.rivers.map((d, i) => (
            <path key={i} className="mr-river" d={d} />
          ))}
        </g>

        {world.lakes.map((d, i) => (
          <path key={i} className="mr-water" d={d} />
        ))}

        <path className="mr-coast" d={world.coast} />
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

        {/* Neatline, like the edge of an atlas plate */}
        <rect className="mr-frame" x={24} y={24} width={WORLD_W - 48} height={WORLD_H - 48} />
        <rect className="mr-frame mr-frame-fine" x={32} y={32} width={WORLD_W - 64} height={WORLD_H - 64} />
      </g>
    </svg>
  );
}

export default memo(WorldArt);