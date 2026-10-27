import { memo, useEffect, useRef } from "react";
import type { MapController } from "./useMapView";

const TILE_SIZE = 2000;

// Seeded random so the buildings don't change on every render
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function WorldArt({ controller }: { controller: MapController }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    return controller.subscribe((v) => {
      viewRef.current = v;
    });
  }, [controller]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    // --- 1. Create Seamless Tile ---
    const offscreen = document.createElement("canvas");
    offscreen.width = TILE_SIZE * dpr;
    offscreen.height = TILE_SIZE * dpr;
    const oCtx = offscreen.getContext("2d")!;
    oCtx.scale(dpr, dpr);

    const rand = mulberry32(1337);

    // Background
    oCtx.fillStyle = "#020202";
    oCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Buildings (filled blocks)
    oCtx.fillStyle = "#0a0a0c";
    for (let i = 0; i < TILE_SIZE; i += 40) {
      for (let j = 0; j < TILE_SIZE; j += 40) {
        if (rand() > 0.6) {
          oCtx.fillRect(i + 4, j + 4, 32, 32);
        }
      }
    }

    // Grid streets (Seamless)
    oCtx.strokeStyle = "#15171c";
    oCtx.lineWidth = 1;
    for (let i = 0; i <= TILE_SIZE; i += 40) {
      oCtx.beginPath();
      oCtx.moveTo(i, 0);
      oCtx.lineTo(i, TILE_SIZE);
      oCtx.stroke();
      oCtx.beginPath();
      oCtx.moveTo(0, i);
      oCtx.lineTo(TILE_SIZE, i);
      oCtx.stroke();
    }

    // Ring Roads
    oCtx.strokeStyle = "#2a2d35";
    oCtx.lineWidth = 6;
    oCtx.shadowColor = "#4ad4ff";
    oCtx.shadowBlur = 15;
    oCtx.beginPath();
    oCtx.arc(TILE_SIZE / 2, TILE_SIZE / 2, 700, 0, Math.PI * 2);
    oCtx.stroke();
    oCtx.beginPath();
    oCtx.arc(TILE_SIZE / 2, TILE_SIZE / 2, 400, 0, Math.PI * 2);
    oCtx.stroke();

    // Winding River (Seamless)
    oCtx.strokeStyle = "#111318";
    oCtx.lineWidth = 80;
    oCtx.lineCap = "round";
    oCtx.lineJoin = "round";
    oCtx.beginPath();
    for (let y = 0; y <= TILE_SIZE; y += 10) {
      const x = TILE_SIZE / 2 + Math.sin(y * (Math.PI * 2 / TILE_SIZE)) * 200;
      if (y === 0) oCtx.moveTo(x, y);
      else oCtx.lineTo(x, y);
    }
    oCtx.stroke();
    
    // Inner water
    oCtx.strokeStyle = "#000000";
    oCtx.lineWidth = 76;
    oCtx.stroke();

    // Diagonal Highways (Seamless)
    oCtx.strokeStyle = "#2a2d35";
    oCtx.lineWidth = 4;
    oCtx.shadowColor = "#4ad4ff";
    oCtx.shadowBlur = 15;
    oCtx.beginPath();
    oCtx.moveTo(0, 0);
    oCtx.lineTo(TILE_SIZE, TILE_SIZE);
    oCtx.stroke();
    oCtx.beginPath();
    oCtx.moveTo(0, TILE_SIZE);
    oCtx.lineTo(TILE_SIZE, 0);
    oCtx.stroke();

    oCtx.shadowBlur = 0;

    // Resize handler
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    // --- 2. Animation Loop ---
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#020202";
      ctx.fillRect(0, 0, width, height);

      const v = viewRef.current;
      const minWX = -v.x / v.k;
      const minWY = -v.y / v.k;
      const maxWX = minWX + width / v.k;
      const maxWY = minWY + height / v.k;

      const startX = Math.floor(minWX / TILE_SIZE) * TILE_SIZE;
      const endX = Math.ceil(maxWX / TILE_SIZE) * TILE_SIZE;
      const startY = Math.floor(minWY / TILE_SIZE) * TILE_SIZE;
      const endY = Math.ceil(maxWY / TILE_SIZE) * TILE_SIZE;

      ctx.translate(v.x, v.y);
      ctx.scale(v.k, v.k);

      for (let x = startX; x <= endX; x += TILE_SIZE) {
        for (let y = startY; y <= endY; y += TILE_SIZE) {
          ctx.drawImage(offscreen, x, y, TILE_SIZE, TILE_SIZE);
        }
      }

      // Animated Traffic
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#4ad4ff";
      ctx.shadowBlur = 10;

      const trafficProgress = (now * 0.0001) % 1;
      
      for (let x = startX; x <= endX; x += TILE_SIZE) {
        for (let y = startY; y <= endY; y += TILE_SIZE) {
          // Diagonal 1
          ctx.beginPath();
          ctx.arc(x + trafficProgress * TILE_SIZE, y + trafficProgress * TILE_SIZE, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Diagonal 2
          ctx.beginPath();
          ctx.arc(x + trafficProgress * TILE_SIZE, y + (1 - trafficProgress) * TILE_SIZE, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Ring Road
          const angle = now * 0.0005;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2 + Math.cos(angle) * 700, y + TILE_SIZE / 2 + Math.sin(angle) * 700, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2 + Math.cos(angle + Math.PI) * 700, y + TILE_SIZE / 2 + Math.sin(angle + Math.PI) * 700, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="mr-canvas absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export default memo(WorldArt);