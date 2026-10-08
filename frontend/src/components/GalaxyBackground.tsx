import { useEffect, useRef } from "react";

const ARMS = 3;
const PARTICLE_COUNT = 900;
const STAR_COUNT = 140;
const TILT = 0.5; // how flattened the galaxy disc looks (1 = face-on)
const ROTATION = -0.35; // radians the whole disc is turned
const CENTER_X = 0.5;
const CENTER_Y = 0.4;

// Keep the 40% here in step with CENTER_Y above.
const GLOW =
  "radial-gradient(circle at 50% 40%, rgba(255, 238, 215, 0.32) 0%, rgba(255, 238, 215, 0) 13%), " +
  "radial-gradient(ellipse 110% 62% at 50% 40%, rgba(72, 78, 150, 0.3) 0%, rgba(30, 32, 72, 0.18) 38%, rgba(0, 0, 0, 0) 72%)";

const COS = Math.cos(ROTATION);
const SIN = Math.sin(ROTATION);

interface Particle {
  radius: number; // 0 (core) to 1 (edge of the disc)
  angle: number;
  speed: number; // radians per second
  size: number;
  alpha: number;
}

interface ParticleGroup {
  color: string;
  particles: Particle[];
}

interface Star {
  x: number; // 0 to 1 across the screen
  y: number;
  size: number;
  alpha: number;
  speed: number;
  phase: number;
}

function buildScene(): { groups: ParticleGroup[]; stars: Star[] } {
  const warm: ParticleGroup = { color: "rgb(255, 232, 205)", particles: [] };
  const white: ParticleGroup = { color: "rgb(255, 255, 255)", particles: [] };
  const cool: ParticleGroup = { color: "rgb(170, 195, 255)", particles: [] };

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const radius = Math.pow(Math.random(), 1.5); // crowded toward the core
    const arm = i % ARMS;
    const scatter = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * (0.35 + radius * 0.7);
    const target = radius < 0.22 ? warm : Math.random() < 0.5 ? white : cool;

    target.particles.push({
      radius,
      angle: (arm / ARMS) * Math.PI * 2 + radius * Math.PI * 2.4 + scatter,
      speed: 0.035 / (0.3 + radius),
      size: 0.6 + Math.random() * 1 + (1 - radius) * 0.6,
      alpha: 0.25 + Math.random() * 0.5 * (1 - radius * 0.5),
    });
  }

  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1.1,
      alpha: 0.25 + Math.random() * 0.6,
      speed: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
    });
  }

  return { groups: [warm, white, cool], stars };
}

export default function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { groups, stars } = buildScene();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let discRadius = 0;
    let frame = 0;

    const render = (seconds: number) => {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgb(255, 255, 255)";
      for (const star of stars) {
        ctx.globalAlpha = star.alpha * (0.55 + 0.45 * Math.sin(seconds * star.speed + star.phase));
        ctx.fillRect(star.x * width, star.y * height, star.size, star.size);
      }

      for (const group of groups) {
        ctx.fillStyle = group.color;
        for (const particle of group.particles) {
          const angle = particle.angle + particle.speed * seconds;
          const distance = particle.radius * discRadius;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance * TILT;
          ctx.globalAlpha = particle.alpha;
          ctx.fillRect(centerX + x * COS - y * SIN, centerY + x * SIN + y * COS, particle.size, particle.size);
        }
      }

      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      centerX = width * CENTER_X;
      centerY = height * CENTER_Y;
      discRadius = Math.min(width, height) * 0.62;

      if (reduceMotion) render(0);
    };

    const loop = (now: number) => {
      render((now - startedAt) / 1000);
      frame = window.requestAnimationFrame(loop);
    };

    resize();
    if (!reduceMotion) frame = window.requestAnimationFrame(loop);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ animation: "page-in 1600ms cubic-bezier(0.2,0.7,0.2,1) both" }}
    >
      <div className="absolute inset-0" style={{ background: GLOW }} />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}