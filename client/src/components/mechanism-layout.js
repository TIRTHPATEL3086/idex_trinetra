/**
 * The gear trains behind the loader, in a 1600 x 1600 viewBox centred on the
 * origin (the lock sits over the middle).
 *
 * Every gear shares one tooth size (module M), so any two that touch can mesh:
 * a child is placed at exactly the meshing distance from its parent, and its
 * starting angle is phased so a tooth of one faces a gap of the other. When
 * they turn, each gear rotates by SPIN / teeth in alternating directions, which
 * keeps every pair in mesh — the small ones spin fast, the large ones slow.
 */

export const M = 7;
export const SPIN = 360 * 14; // degrees a 1-tooth gear would turn; a 20-tooth turns 252°

/** Each train: a root gear, and children placed at an angle from their parent. */
const TRAINS = [
  // left
  {
    n: 56,
    x: -520,
    y: -230,
    kids: [
      { n: 22, at: -10 },
      { n: 30, at: 200 },
      {
        n: 40,
        at: 100,
        kids: [
          {
            n: 60,
            at: 55,
            kids: [
              { n: 24, at: 10 },
              { n: 18, at: 150 },
            ],
          },
          { n: 20, at: 190 },
        ],
      },
    ],
  },
  // right
  {
    n: 60,
    x: 540,
    y: 180,
    kids: [
      {
        n: 26,
        at: -95,
        kids: [
          {
            n: 48,
            at: -50,
            kids: [
              { n: 20, at: -130, kids: [{ n: 36, at: -50 }] },
              { n: 22, at: 20 },
            ],
          },
        ],
      },
      { n: 24, at: 70, kids: [{ n: 44, at: 60 }] },
      { n: 18, at: 180 },
    ],
  },
  // top
  {
    n: 44,
    x: -60,
    y: -640,
    kids: [
      { n: 20, at: 0, kids: [{ n: 32, at: -30 }] },
      { n: 28, at: 170 },
    ],
  },
  // bottom
  {
    n: 50,
    x: 120,
    y: 640,
    kids: [
      { n: 22, at: 185 },
      { n: 30, at: -20 },
    ],
  },
];

/** A fainter layer behind the frame, filling the gaps for depth. */
const BACK_TRAINS = [
  { n: 64, x: -150, y: -330, kids: [{ n: 26, at: -150 }] },
  { n: 70, x: -230, y: 330, kids: [{ n: 30, at: 200 }] },
  { n: 56, x: 330, y: 330, kids: [{ n: 24, at: -100 }] },
  { n: 44, x: 360, y: -330 },
  { n: 36, x: -420, y: -40 },
];

export const pitchRadius = (n) => (M * n) / 2;
export const tipRadius = (n) => pitchRadius(n) + M;

function place(spec, parent, out) {
  let g;
  if (!parent) {
    g = { n: spec.n, x: spec.x, y: spec.y, phase: spec.phase ?? 0, dir: 1, parent: null };
  } else {
    const a = (spec.at * Math.PI) / 180;
    const dist = pitchRadius(parent.n) + pitchRadius(spec.n);
    // Where the contact point falls in the parent's tooth pattern (0 = tooth
    // centre); the child must present a gap there, i.e. the two sum to half a tooth.
    const uParent = ((spec.at - parent.phase) * parent.n) / 360;
    g = {
      n: spec.n,
      x: parent.x + dist * Math.cos(a),
      y: parent.y + dist * Math.sin(a),
      phase: spec.at + 180 - ((0.5 - uParent) * 360) / spec.n,
      dir: -parent.dir,
      parent,
    };
  }
  out.push(g);
  (spec.kids || []).forEach((k) => place(k, g, out));
  return out;
}

const finish = (trains, layer) =>
  trains
    .flatMap((t) => place(t, null, []))
    .map((g, i) => ({
      id: `${layer}${i}`,
      n: g.n,
      x: Math.round(g.x * 10) / 10,
      y: Math.round(g.y * 10) / 10,
      phase: Math.round(g.phase * 100) / 100,
      turn: Math.round(((g.dir * SPIN) / g.n) * 100) / 100,
      _ref: g,
    }));

export const GEARS = finish(TRAINS, 'f');
export const GEARS_BACK = finish(BACK_TRAINS, 'b');

/** Pairs in one layer that overlap without meshing — for checking the layout. */
export function collisions(list = GEARS) {
  const bad = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]._ref,
        b = list[j]._ref;
      if (a.parent === b || b.parent === a) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const gap = d - (tipRadius(a.n) + tipRadius(b.n));
      if (gap < 6) bad.push({ a: i, b: j, gap: Math.round(gap) });
    }
  }
  return bad;
}
