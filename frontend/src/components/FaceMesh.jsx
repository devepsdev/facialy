import { useMemo } from "react";

// Generador pseudoaleatorio determinista: la malla es idéntica en cada render/SSR
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Puntos y aristas de una cabeza estilizada (contorno, ojos, nariz, boca). */
function buildMesh() {
  const rand = mulberry32(7);
  const pts = [];
  // Anillos concéndricos del óvalo facial
  [[1, 26], [0.78, 20], [0.56, 14], [0.34, 8]].forEach(([k, n]) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.15;
      pts.push([200 + Math.cos(a) * 118 * k + (rand() - 0.5) * 6, 240 + Math.sin(a) * 158 * k + (rand() - 0.5) * 6]);
    }
  });
  // Rasgos: ojos, cejas, nariz, boca
  const feature = (cx, cy, rx, ry, n) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
  };
  feature(150, 215, 22, 9, 8);
  feature(250, 215, 22, 9, 8);
  for (let i = 0; i < 6; i++) {
    pts.push([128 + i * 9, 188 - Math.sin((i / 5) * Math.PI) * 8]);
    pts.push([228 + i * 9, 188 - Math.sin((i / 5) * Math.PI) * 8]);
  }
  for (let i = 0; i < 6; i++) pts.push([200 + (i % 2 ? 9 : -9) * (i > 3 ? 1.6 : 1), 220 + i * 14]);
  feature(200, 318, 34, 10, 12);

  const edges = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => [j, Math.hypot(p[0] - q[0], p[1] - q[1])])
      .filter(([j, d]) => j > i && d < 52)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
    near.forEach(([j]) => edges.push([i, j]));
  });
  return { pts, edges };
}

export default function FaceMesh({ className }) {
  const { pts, edges } = useMemo(() => buildMesh(), []);
  return (
    <svg viewBox="0 0 400 480" className={className} role="img" aria-label="Malla facial estilizada con puntos de referencia">
      <defs>
        <linearGradient id="mesh-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="mesh-glow" cx="50%" cy="48%" r="55%">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.28" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <clipPath id="mesh-clip">
          <ellipse cx="200" cy="240" rx="150" ry="195" />
        </clipPath>
      </defs>
      <ellipse cx="200" cy="240" rx="190" ry="225" fill="url(#mesh-glow)" />
      <g stroke="url(#mesh-line)" strokeWidth="0.9" strokeOpacity="0.55">
        {edges.map(([a, b], i) => (
          <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} />
        ))}
      </g>
      <g>
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 7 === 0 ? 3 : 1.8} fill={i % 7 === 0 ? "#67e8f9" : "#a5f3fc"} opacity={i % 7 === 0 ? 1 : 0.75}>
            {i % 5 === 0 && <animate attributeName="opacity" values="0.3;1;0.3" dur={`${2 + (i % 4) * 0.7}s`} repeatCount="indefinite" />}
          </circle>
        ))}
      </g>
      {/* Línea de escaneo recortada al óvalo */}
      <g clipPath="url(#mesh-clip)">
        <rect x="40" width="320" height="46" fill="url(#mesh-line)" opacity="0.28">
          <animate attributeName="y" values="30;440;30" dur="4.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
        </rect>
      </g>
      <g fill="none" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round">
        <path d="M30 80V40q0-10 10-10h40" />
        <path d="M370 80V40q0-10-10-10h-40" />
        <path d="M30 400v40q0 10 10 10h40" />
        <path d="M370 400v40q0 10-10 10h-40" />
      </g>
    </svg>
  );
}
