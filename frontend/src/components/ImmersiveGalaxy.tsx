import { useEffect, useRef } from "react";


interface Star {
  x: number; // 0..1
  y: number; // 0..1
  z: number; // 0 (far) .. 1 (near)
  r: number; // radius in CSS px
  a: number; // base alpha
  tw: number; // twinkle speed
  ph: number; // twinkle phase
  tint: number; // index into TINTS
  glow: boolean;
}

const TINTS = ["rgb(255,255,255)", "rgb(205,220,255)", "rgb(255,236,215)"];
const BAND_ANGLE = -0.35;
const MAX_STARS = 1400;

function gauss(): number {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.577;
}

function makeStars(quiet: boolean): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < MAX_STARS; i++) {
    const inBand = Math.random() < 0.55;
    let x: number;
    let y: number;
    if (inBand) {
      const along = (Math.random() - 0.5) * 1.5;
      const across = gauss() * 0.075;
      x = 0.5 + along * Math.cos(BAND_ANGLE) - across * Math.sin(BAND_ANGLE);
      y = 0.5 + along * Math.sin(BAND_ANGLE) + across * Math.cos(BAND_ANGLE);
    } else {
      x = Math.random();
      y = Math.random();
    }
    x = ((x % 1) + 1) % 1;
    y = ((y % 1) + 1) % 1;

    const bright = !quiet && Math.random() < 0.012;
    const z = bright ? 0.9 + Math.random() * 0.1 : Math.pow(Math.random(), inBand ? 2.2 : 1.6);
    stars.push({
      x,
      y,
      z,
      r: bright ? 1.5 + Math.random() * 0.6 : quiet ? 0.3 + z * 0.7 : 0.35 + z * 1.0,
      a: bright ? 0.95 : (quiet ? 0.16 : 0.22) + z * (quiet ? 0.4 : 0.6) * (0.6 + Math.random() * 0.4),
      tw: 0.4 + Math.random() * 1.4,
      ph: Math.random() * Math.PI * 2,
      tint: Math.random() < 0.7 ? 0 : Math.random() < 0.6 ? 1 : 2,
      glow: bright,
    });
  }
  return stars;
}

function buildNebula(w: number, h: number): HTMLCanvasElement {
  // Rendered at half resolution; it is soft by nature and this keeps the per-frame blit cheap.
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w / 2));
  canvas.height = Math.max(1, Math.ceil(h / 2));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(0.5, 0.5);

  const big = Math.max(w, h);

  // The band itself: an elongated, tilted glow through the middle.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(BAND_ANGLE);
  ctx.scale(1, 0.28);
  const band = ctx.createRadialGradient(0, 0, 0, 0, 0, big * 0.75);
  band.addColorStop(0, "rgba(130,148,205,0.20)");
  band.addColorStop(0.4, "rgba(78,96,160,0.10)");
  band.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = band;
  ctx.fillRect(-big * 2, -big * 3, big * 4, big * 6);
  ctx.restore();

  const blob = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  blob(w * 0.46, h * 0.52, Math.min(w, h) * 0.3, "rgba(214,176,148,0.10)"); // warm core
  blob(w * 0.8, h * 0.2, big * 0.4, "rgba(70,100,190,0.12)"); // cool upper right
  blob(w * 0.14, h * 0.84, big * 0.36, "rgba(120,84,132,0.08)"); // faint rose, lower left

  return canvas;
}

/**
 * `quiet` drops the large glowing stars so only fine pinpoints remain. Use it where real, interactive
 * stars sit on top and must never be confused with the backdrop.
 */
export default function ImmersiveGalaxy({
  reducedMotion = false,
  quiet = false,
}: {
  reducedMotion?: boolean;
  quiet?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    const stars = makeStars(quiet);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let count = 0;
    let nebula: HTMLCanvasElement | null = null;
    let raf = 0;
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (nebula) {
        const sx = Math.sin(t * 0.00002) * w * 0.02;
        const sy = Math.cos(t * 0.000017) * h * 0.02;
        ctx.globalAlpha = 1;
        ctx.drawImage(nebula, -w * 0.075 + sx, -h * 0.075 + sy, w * 1.15, h * 1.15);
      }

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      for (let i = 0; i < count; i++) {
        const s = stars[i];
        if (!s) continue;
        const dx = reducedMotion ? 0 : t * 0.00001 * (0.15 + s.z);
        const px = ((((s.x + dx) % 1) + 1) % 1) * w + pointer.x * 14 * s.z;
        const py = s.y * h + pointer.y * 14 * s.z;
        const twinkle = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 0.001 * s.tw + s.ph);
        const alpha = s.a * twinkle;

        ctx.fillStyle = TINTS[s.tint] ?? "rgb(255,255,255)";
        if (s.glow) {
          ctx.globalAlpha = alpha * 0.1;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.25;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        if (s.r < 0.9) {
          ctx.fillRect(px - s.r, py - s.r, s.r * 2, s.r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      count = Math.min(MAX_STARS, Math.round((w * h) / 700));
      nebula = buildNebula(w, h);
      if (reducedMotion) draw(0);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      pointer.tx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      pointer.ty = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    if (!reducedMotion) {
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [reducedMotion, quiet]);

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Soft vignette keeps the edges deep and the centre readable. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)" }}
      />
    </div>
  );
}