import { useEffect, useId, useRef, useState } from 'react';
import Mechanism from './Mechanism.jsx';
import './Preloader.css';

/**
 * Opening sequence shown in front of the landing page.
 *
 * The lock sits where a clock face would, in the middle of a clockwork of
 * gears. A key flies in, slides into the padlock, turns a quarter clockwise,
 * and the shackle springs open from its top-left — at which point the gears
 * behind start to turn. The wordmark rises in below, then the screen splits
 * along its middle: the top half lifts away and the bottom half drops,
 * uncovering the page. Four seconds end to end.
 *
 * The padlock is the supplied photograph, cut out into two transparent layers
 * and rendered as line art (public/loader) so the shackle can lift on its own.
 * The key is drawn as SVG, the gears in Mechanism.jsx.
 *
 * The split works by rendering the whole scene twice, each copy clipped to one
 * half of the screen. Both copies run the same CSS timeline from the same
 * mount, so they stay frame-identical until they part.
 *
 * The intro ends once the page has loaded and its fonts are ready, and
 * never waits on them for longer than READY_CAP_MS.
 */

const INTRO_MS = 3200; // length of the CSS timeline in Preloader.css
const SPLIT_MS = 800; // seam draw + halves parting
const REDUCED_MS = 600;
const READY_CAP_MS = INTRO_MS; // never hold the intro past 4 s in total
const WORD = 'IDEX TRINETRA';

export default function Preloader({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const readyRef = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minMs = reduce ? REDUCED_MS : INTRO_MS;
    const root = document.documentElement;
    root.classList.add('is-preloading');

    let cancelled = false;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    const loaded = new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });
    const ready = Promise.race([
      Promise.all([loaded, document.fonts?.ready]),
      new Promise((resolve) => later(resolve, READY_CAP_MS)),
    ]).then(() => {
      readyRef.current = true;
    });
    const minimum = new Promise((resolve) => later(resolve, minMs));

    // The counter tracks the timeline, and parks at 99 if the page is slower.
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min((now - start) / minMs, 1);
      const eased = 1 - Math.pow(1 - t, 2.2);
      const value = Math.round(eased * 100);
      setPct(value === 100 && !readyRef.current ? 99 : value);
      if (t < 1 || !readyRef.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    Promise.all([ready, minimum]).then(() => {
      if (cancelled) return;
      setPct(100);
      setLeaving(true);
      // Let the landing page begin its own entrance as the halves part.
      root.classList.remove('is-preloading');
      later(() => onDone?.(), reduce ? 450 : SPLIT_MS);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      root.classList.remove('is-preloading');
    };
  }, [onDone]);

  return (
    <div
      className={`pl ${leaving ? 'pl--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={leaving ? 'Loaded' : 'Loading IDEX Trinetra'}
    >
      <div className="pl-half pl-half--top">
        <Scene pct={pct} />
      </div>
      <div className="pl-half pl-half--bottom" aria-hidden="true">
        <Scene pct={pct} />
      </div>
      <div className="pl-seam" aria-hidden="true" />
    </div>
  );
}

function Scene({ pct }) {
  // Two copies of the scene share the page, so their SVG ids must not collide.
  const uid = 'pl' + useId().replace(/:/g, '');

  return (
    <div className="pl-scene" aria-hidden="true">
      <Mechanism uid={uid} />

      <div className="pl-center">
        <svg className="pl-stage" viewBox="-35 -45 360 490" role="img">
          <Defs uid={uid} />

          {/* The riveted plate that takes the clock face's place. Its rings of
              rivets and ticks turn with the gears once the lock opens. */}
          <g className="pl-plate" transform="translate(145 250)">
            <circle r="232" fill={`url(#${uid}-plate)`} className="pl-plate__edge" />
            <g className="pl-plate__spin">
              <circle r="214" className="pl-plate__rivets" />
              <circle r="198" className="pl-plate__line" />
              <circle r="192" className="pl-plate__line" />
              <circle r="198" className="pl-plate__ticks" />
            </g>
          </g>

          {/* The padlock: the supplied front-on drawing, cut into two layers
              so the shackle can lift on its own. */}
          <g className="pl-lock">
            <g className="pl-thud">
              <ellipse
                cx="145"
                cy="406"
                rx="96"
                ry="8"
                fill="#1f1a23"
                opacity="0.18"
                filter={`url(#${uid}-soft)`}
              />
              {/* Shackle sits behind the body; its pivot is the right leg's foot. */}
              <g transform={`translate(${PIVOT.join(' ')})`}>
                <g className="pl-shackle">
                  <image
                    href="/loader/lock-shackle.svg"
                    x={IMG.x - PIVOT[0]}
                    y={IMG.y - PIVOT[1]}
                    width={IMG.w}
                    height={IMG.h}
                  />
                </g>
              </g>
              <image
                href="/loader/lock-body.svg"
                x={IMG.x}
                y={IMG.y}
                width={IMG.w}
                height={IMG.h}
              />
            </g>
          </g>

          {/* Key: fly in, slide into the keyhole, turn. Everything below the
              keyhole in the key's own frame is clipped, so the blade looks
              like it disappears into the lock and stays hidden as it turns. */}
          <g transform={`translate(${KEYHOLE.join(' ')}) scale(${KEY_SCALE})`}>
            <g className="pl-key-fly">
              <g className="pl-key-turn">
                <g clipPath={`url(#${uid}-key-clip)`}>
                  <g className="pl-key-slide">
                    <Key uid={uid} />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>

        <div className="pl-caption">
          <div className="pl-word" aria-label={WORD}>
            {WORD.split('').map((ch, i) => (
              <span key={i} style={{ '--i': i }}>
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </div>
          <div className="pl-tag">decryption · watermark · receipt</div>
        </div>
      </div>

      <div className="pl-progress">
        <div className="pl-progress__track">
          <div className="pl-progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <span className="pl-progress__num">{String(pct).padStart(3, '0')}</span>
      </div>
    </div>
  );
}

// The lock drawing is a 117 x 167 vector frame (two SVG layers). It is placed on the
// stage at K units per source pixel; the points below are read off the source.
const K = 1.96;
const IMG = { x: 30, y: 84.5, w: 117 * K, h: 167 * K };
const at = (px, py) => [IMG.x + px * K, IMG.y + py * K];
const PIVOT = at(88.5, 57); // foot of the shackle's right leg
const KEYHOLE = at(57.5, 137.5); // round top of the keyhole
const KEY_SCALE = 0.5;

function Key({ uid }) {
  return (
    <g mask={`url(#${uid}-key-holes)`}>
      {/* Trefoil bow */}
      <circle cx="0" cy="-134" r="17" fill={`url(#${uid}-key)`} />
      <circle cx="-17" cy="-111" r="17" fill={`url(#${uid}-key)`} />
      <circle cx="17" cy="-111" r="17" fill={`url(#${uid}-key)`} />
      <circle cx="0" cy="-114" r="15" fill={`url(#${uid}-key)`} />
      <g fill="none" stroke="#1f1a23" strokeWidth="2.2">
        <circle cx="0" cy="-134" r="12.5" />
        <circle cx="-17" cy="-111" r="12.5" />
        <circle cx="17" cy="-111" r="12.5" />
      </g>

      {/* Collars */}
      <rect
        x="-10"
        y="-96"
        width="20"
        height="7"
        rx="3"
        fill={`url(#${uid}-key)`}
        stroke="#1f1a23"
        strokeWidth="1.8"
      />
      <rect
        x="-8"
        y="-86"
        width="16"
        height="5"
        rx="2.5"
        fill={`url(#${uid}-key)`}
        stroke="#1f1a23"
        strokeWidth="1.8"
      />

      {/* Shaft and bit */}
      <rect
        x="-4.5"
        y="-82"
        width="9"
        height="142"
        rx="4.5"
        fill={`url(#${uid}-key)`}
        stroke="#1f1a23"
        strokeWidth="1.8"
      />
      <path
        d="M4 30 H21 V38 H15 V43 H21 V58 H4 Z"
        fill={`url(#${uid}-key)`}
        stroke="#1f1a23"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line
        x1="-1.5"
        y1="-78"
        x2="-1.5"
        y2="50"
        stroke="#fff8f8"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
}

function Defs({ uid }) {
  return (
    <defs>
      <linearGradient id={`${uid}-key`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.5" stopColor="#c9ced6" />
        <stop offset="1" stopColor="#8b929b" />
      </linearGradient>
      <radialGradient id={`${uid}-plate`} cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#f1ebec" />
        <stop offset="1" stopColor="#dcd4d6" />
      </radialGradient>
      <filter id={`${uid}-soft`} x="-20%" y="-200%" width="140%" height="500%">
        <feGaussianBlur stdDeviation="6" />
      </filter>

      <clipPath id={`${uid}-key-clip`} clipPathUnits="userSpaceOnUse">
        <rect x="-400" y="-600" width="800" height="600" />
      </clipPath>

      <mask
        id={`${uid}-key-holes`}
        maskUnits="userSpaceOnUse"
        x="-60"
        y="-170"
        width="120"
        height="240"
      >
        <rect x="-60" y="-170" width="120" height="240" fill="#fff" />
        <circle cx="0" cy="-134" r="6.5" fill="#000" />
        <circle cx="-17" cy="-111" r="6.5" fill="#000" />
        <circle cx="17" cy="-111" r="6.5" fill="#000" />
      </mask>
    </defs>
  );
}
