import { GEARS, GEARS_BACK, M, pitchRadius, tipRadius } from './mechanism-layout.js';

/**
 * The clockwork behind the loader: meshing gears on a riveted frame, drawn in
 * the grey technical-illustration style of the reference artwork.
 *
 * Built as SVG rather than animated from the reference picture, because the
 * picture is one flat image — its gears overlap each other, the clock face and
 * the frame, so no gear can turn without dragging its neighbours with it.
 *
 * Every gear holds still until the lock opens, then the whole train spins up
 * together (see .mech-gear in Preloader.css).
 */
export default function Mechanism({ uid }) {
  return (
    <svg
      className="mech"
      viewBox="-800 -800 1600 1600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdfbfb" />
          <stop offset="0.55" stopColor="#ece6e7" />
          <stop offset="1" stopColor="#d6cfd1" />
        </linearGradient>
        <radialGradient id={`${uid}-hub`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#e3dcde" />
          <stop offset="1" stopColor="#b9b0b4" />
        </radialGradient>
        <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f3f3" />
          <stop offset="1" stopColor="#d9d2d4" />
        </linearGradient>
        <radialGradient id={`${uid}-vignette`} cx="0.5" cy="0.47" r="0.62">
          <stop offset="0.55" stopColor="#f5eeee" stopOpacity="0" />
          <stop offset="1" stopColor="#6e6472" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* A fainter layer behind the frame, for depth. */}
      <g className="mech-back">
        {GEARS_BACK.map((g) => (
          <Gear key={g.id} g={g} uid={uid} />
        ))}
      </g>

      <Frame uid={uid} />

      {GEARS.map((g) => (
        <Gear key={g.id} g={g} uid={uid} />
      ))}

      <rect x="-800" y="-800" width="1600" height="1600" fill={`url(#${uid}-vignette)`} />
    </svg>
  );
}

/* -- frame ------------------------------------------------------------------ */

const BEAMS = [
  // x, y, length, angle
  [-800, -455, 1600, 0],
  [-800, 470, 1600, 0],
  [-705, -800, 1600, 90],
  [705, -800, 1600, 90],
  [-705, -455, 560, 38],
  [705, 470, 560, 218],
];

function Frame({ uid }) {
  return (
    <g className="mech-frame">
      {BEAMS.map(([x, y, len, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          <rect y="-15" width={len} height="30" fill={`url(#${uid}-beam)`} />
          <path d={`M0 -15 H${len} M0 15 H${len} M0 -6 H${len}`} className="mech-line" />
          {Array.from({ length: Math.floor(len / 120) }, (_, k) => (
            <circle key={k} cx={60 + k * 120} cy="0" r="5" className="mech-bolt" />
          ))}
        </g>
      ))}
    </g>
  );
}

/* -- gears ------------------------------------------------------------------ */

/** Outline of a toothed wheel: trapezoidal teeth, tooth 0 centred on angle 0. */
function teethPath(n) {
  const ra = tipRadius(n);
  const rf = pitchRadius(n) - 1.25 * M;
  const step = (2 * Math.PI) / n;
  const pt = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  let d = `M${pt(rf, -0.27 * step)}`;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    d += ` L${pt(ra, a - 0.13 * step)} L${pt(ra, a + 0.13 * step)} L${pt(rf, a + 0.27 * step)}`;
    d += ` A${rf} ${rf} 0 0 1 ${pt(rf, a + 0.73 * step)}`;
  }
  return d + ' Z';
}

const ring = (r) => `M${r} 0 A${r} ${r} 0 1 0 ${-r} 0 A${r} ${r} 0 1 0 ${r} 0 Z`;

function Gear({ g, uid }) {
  const R = pitchRadius(g.n);
  const rf = R - 1.25 * M;
  const rim = rf - Math.max(10, R * 0.09);
  const hub = Math.max(16, R * 0.2);
  const spokes = g.n >= 50 ? 10 : g.n >= 36 ? 8 : g.n >= 26 ? 6 : 0;
  const spokeW = Math.max(9, R * 0.075);

  return (
    <g transform={`translate(${g.x} ${g.y}) rotate(${g.phase})`}>
      <g className="mech-gear" style={{ '--turn': `${g.turn}deg` }}>
        {spokes ? (
          <>
            {/* Toothed rim with the middle cut away, then spokes across it. */}
            <path
              d={`${teethPath(g.n)} ${ring(rim)}`}
              fillRule="evenodd"
              fill={`url(#${uid}-steel)`}
              className="mech-edge"
            />
            {Array.from({ length: spokes }, (_, k) => (
              <rect
                key={k}
                x={hub * 0.7}
                y={-spokeW / 2}
                width={rim - hub * 0.7 + 2}
                height={spokeW}
                transform={`rotate(${(k * 360) / spokes})`}
                fill={`url(#${uid}-steel)`}
                className="mech-edge"
              />
            ))}
            <circle r={rim} className="mech-line" fill="none" />
          </>
        ) : (
          <>
            {/* Small gears are solid discs with lightening holes. */}
            <path d={teethPath(g.n)} fill={`url(#${uid}-steel)`} className="mech-edge" />
            {Array.from({ length: 5 }, (_, k) => {
              const a = (k * 2 * Math.PI) / 5;
              const rr = (rim + hub) / 2;
              return (
                <circle
                  key={k}
                  cx={rr * Math.cos(a)}
                  cy={rr * Math.sin(a)}
                  r={Math.max(5, (rim - hub) * 0.28)}
                  className="mech-hole"
                />
              );
            })}
          </>
        )}

        <circle r={R} className="mech-pitch" fill="none" />
        <circle r={rf - 3} className="mech-line" fill="none" />

        {/* Hub, collar and bolts. */}
        <circle r={hub} fill={`url(#${uid}-hub)`} className="mech-edge" />
        <circle r={hub * 0.62} fill="none" className="mech-line" />
        {Array.from({ length: 6 }, (_, k) => {
          const a = (k * Math.PI) / 3;
          return (
            <circle
              key={k}
              cx={hub * 0.8 * Math.cos(a)}
              cy={hub * 0.8 * Math.sin(a)}
              r={Math.max(1.8, hub * 0.07)}
              className="mech-bolt"
            />
          );
        })}
        <circle r={hub * 0.3} fill={`url(#${uid}-hub)`} className="mech-edge" />
        <circle r={Math.max(2.5, hub * 0.1)} className="mech-axle" />
      </g>
    </g>
  );
}
