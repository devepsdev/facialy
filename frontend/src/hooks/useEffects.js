import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Escribe el scroll (px) en --sy de <html> para los efectos .parallax (rAF, sin re-renders). */
export function useScrollParallax() {
  useEffect(() => {
    if (reducedMotion()) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      root.style.setProperty("--sy", String(Math.min(window.scrollY, 2400)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--sy");
    };
  }, []);
}

/** Devuelve un ref; escribe --mx/--my (-1..1) según la posición del puntero sobre el elemento. */
export function useMouseParallax() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    };
    const onLeave = () => {
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return ref;
}

/** Añade la clase "in" a los .reveal cuando entran en pantalla. `dep` relanza el efecto si el contenido llega tarde. */
export function useRevealOnScroll(dep) {
  useEffect(() => {
    const items = document.querySelectorAll(".reveal");
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

/** Número que cuenta desde 0 hasta `value` cuando el elemento es visible. */
export function useCountUp(value, { duration = 1400 } = {}) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(0);
  const target = Number(value) || 0;
  const reduced = reducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        setDisplay(Math.round(target * (1 - Math.pow(1 - t, 4))));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, duration, reduced]);

  return [ref, reduced ? target : display];
}

/** Ejecuta `fn` de forma secuencial (sin solapar peticiones) cada `interval` ms mientras `active`. */
export function useLoop(fn, active, interval) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      const started = performance.now();
      try {
        await fnRef.current();
      } catch {
        /* los errores puntuales de red no deben parar el bucle */
      }
      if (!stopped) timer = setTimeout(tick, Math.max(0, interval - (performance.now() - started)));
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, interval]);
}
