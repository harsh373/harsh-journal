import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Inset {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type Lod = 0 | 1 | 2;
type Listener = (view: View, lod: Lod) => void;
type Point = { x: number; y: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const DRAG_THRESHOLD = 6;

interface Hooks {
  onUserMove?: () => void;
}

export function createMapController(getStage: () => HTMLElement | null, hooks: Hooks) {
  let view: View = { x: 0, y: 0, k: 1 };
  let size = { w: 0, h: 0 };
  let minK = 0.5;
  let maxK = 4;
  let ready = false;
  let inset: Inset = { left: 0, right: 0, top: 0, bottom: 0 };
  const listeners = new Set<Listener>();
  let frame = 0;
  let anim = 0;

  const lodFor = (k: number): Lod => (k >= minK * 1.6 ? 2 : k >= minK * 1.2 ? 1 : 0);

  function clampView(v: View): View {
    const k = clamp(v.k, minK, maxK);
    return { x: v.x, y: v.y, k };
  }

  function emitNow() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    const lod = lodFor(view.k);
    listeners.forEach((l) => l(view, lod));
  }
  function emit() {
    if (!frame) frame = requestAnimationFrame(emitNow);
  }

  function setView(next: View) {
    view = clampView(next);
    emit();
  }

  function computeLimits() {
    const contain = Math.min(size.w / 2000, size.h / 2000);
    minK = size.w < 700 ? 0.4 : contain * 0.8;
    maxK = 5;
  }

  function cancelAnim() {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  }

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateTo(dest: View, duration?: number) {
    cancelAnim();
    const to = clampView(dest);
    const from = { ...view };
    const dist = Math.hypot(to.x - from.x, to.y - from.y) + Math.abs(to.k - from.k) * 300;
    const dur = reduced() ? 0 : (duration ?? clamp(380 + dist * 0.35, 380, 900));
    if (dur === 0) {
      setView(to);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = clamp((now - t0) / dur, 0, 1);
      const e = ease(t);
      view = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e };
      emitNow();
      anim = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }

  function zoomAtPoint(px: number, py: number, factor: number, animated: boolean) {
    const k2 = clamp(view.k * factor, minK, maxK);
    const ratio = k2 / view.k;
    const dest = { k: k2, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
    if (animated) animateTo(dest, 260);
    else setView(dest);
  }

  const pointers = new Map<number, Point>();
  let drag: { sx: number; sy: number; vx: number; vy: number; moved: boolean } | null = null;
  let pinch: { dist: number; k: number; wx: number; wy: number } | null = null;
  let rect: DOMRect | null = null;
  let suppressClick = false;

  const rel = (e: { clientX: number; clientY: number }) => ({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });

  function getTwoPointers(): [Point, Point] | null {
    const all = [...pointers.values()];
    const a = all[0];
    const b = all[1];
    return a && b ? [a, b] : null;
  }

  function startPinch() {
    const two = getTwoPointers();
    if (!two) return;
    const [a, b] = two;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k, wx: (cx - view.x) / view.k, wy: (cy - view.y) / view.k };
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const stage = getStage();
    if (!stage) return;
    cancelAnim();
    rect = stage.getBoundingClientRect();
    pointers.set(e.pointerId, rel(e));
    if (pointers.size === 1) {
      drag = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    } else if (pointers.size === 2) {
      startPinch();
      if (drag) drag.moved = true;
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, rel(e));

    if (pointers.size >= 2 && pinch) {
      const two = getTwoPointers();
      if (!two) return;
      const [a, b] = two;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const k = clamp((pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist, minK, maxK);
      setView({ k, x: cx - pinch.wx * k, y: cy - pinch.wy * k });
      hooks.onUserMove?.();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      hooks.onUserMove?.();
    }
    setView({ k: view.k, x: drag.vx + dx, y: drag.vy + dy });
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.delete(e.pointerId)) return;
    const wasMoved = drag?.moved ?? false;
    const remaining = [...pointers.values()];
    const p = remaining[0];
    if (remaining.length === 1 && p) {
      drag = { sx: p.x + (rect?.left ?? 0), sy: p.y + (rect?.top ?? 0), vx: view.x, vy: view.y, moved: true };
      pinch = null;
    } else if (remaining.length === 0) {
      drag = null;
      pinch = null;
      if (wasMoved) {
        suppressClick = true;
        window.setTimeout(() => (suppressClick = false), 40);
      }
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const onClickCapture = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    cancelAnim();
    const stage = getStage();
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.h : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    const mouseWheel = e.deltaMode !== 0 || (dx === 0 && Number.isInteger(dy) && Math.abs(dy) >= 40);

    if (e.ctrlKey || mouseWheel) {
      zoomAtPoint(px, py, Math.exp(-clamp(dy, -120, 120) * (e.ctrlKey ? 0.01 : 0.0018)), false);
    } else {
      setView({ k: view.k, x: view.x - dx, y: view.y - dy });
    }
    hooks.onUserMove?.();
  }

  function attach(): () => void {
    const stage = getStage();
    if (!stage) return () => undefined;

    const measure = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h) return;
      if (!ready) {
        size = { w, h };
        computeLimits();
        ready = true;
        view = { k: 1.5, x: w / 2, y: h / 2 };
      } else {
        const wx = (size.w / 2 - view.x) / view.k;
        const wy = (size.h / 2 - view.y) / view.k;
        size = { w, h };
        computeLimits();
        const k = clamp(view.k, minK, maxK);
        view = { k, x: w / 2 - wx * k, y: h / 2 - wy * k };
      }
      emit();
    };

    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    measure();
    stage.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      ro.disconnect();
      stage.removeEventListener("wheel", onWheel);
      cancelAnim();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
  }

  return {
    attach,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture },
    subscribe(fn: Listener) {
      listeners.add(fn);
      if (ready) fn(view, lodFor(view.k));
      return () => {
        listeners.delete(fn);
      };
    },
    refresh: emit,
    getView: () => ({ ...view }),
    getMinK: () => minK,
    setInset(next: Inset) { inset = next; },
    jumpToWorld(wx: number, wy: number, k?: number) {
      const k2 = clamp(k ?? view.k, minK, maxK);
      const cx = inset.left + (size.w - inset.left - inset.right) / 2;
      const cy = inset.top + (size.h - inset.top - inset.bottom) / 2;
      setView({ k: k2, x: cx - wx * k2, y: cy - wy * k2 });
    },
    flyToWorld(wx: number, wy: number, k?: number) {
      const k2 = clamp(k ?? view.k, minK, maxK);
      const cx = inset.left + (size.w - inset.left - inset.right) / 2;
      const cy = inset.top + (size.h - inset.top - inset.bottom) / 2;
      animateTo({ k: k2, x: cx - wx * k2, y: cy - wy * k2 });
    },
    flyToView(v: View) {
      animateTo(v);
    },
    isComfortablyVisible(wx: number, wy: number) {
      const sx = wx * view.k + view.x;
      const sy = wy * view.k + view.y;
      return (
        sx > inset.left + 56 && sx < size.w - inset.right - 56 && sy > inset.top + 72 && sy < size.h - inset.bottom - 56
      );
    },
    zoomBy(factor: number) {
      zoomAtPoint(size.w / 2, size.h / 2, factor, true);
      hooks.onUserMove?.();
    },
    nudge(dx: number, dy: number) {
      animateTo({ ...view, x: view.x + dx, y: view.y + dy }, 180);
      hooks.onUserMove?.();
    },
    reset() {
      animateTo({ k: 1.5, x: size.w / 2, y: size.h / 2 });
      hooks.onUserMove?.();
    },
  };
}

export type MapController = ReturnType<typeof createMapController>;

export function useMapView(stageRef: React.RefObject<HTMLElement | null>, onUserMove: () => void): MapController {
  const hooks = useRef<Hooks>({ onUserMove });
  useEffect(() => {
    hooks.current.onUserMove = onUserMove;
  }, [onUserMove]);

  const controller = useMemo(() => createMapController(() => stageRef.current, hooks.current), [stageRef]);
  useEffect(() => controller.attach(), [controller]);
  return controller;
}