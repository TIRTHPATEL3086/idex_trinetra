import { useEffect, useRef, useState } from 'react';

/**
 * The curtain shown before the landing page.
 *
 * A key arrives, seats in the keyhole and turns half a revolution; the shackle
 * springs open from its left hinge; the wordmark rises beneath; then the
 * curtain parts, top half up and bottom half down, onto the page.
 *
 * It is drawn rather than filmed. A video of the same thing would be orders of
 * magnitude heavier, would not match the palette if the palette changed, could
 * not part down the middle to reveal what is behind it, and would soften on a
 * high-density screen. As SVG it is a few kilobytes, sharp at any size, and
 * the same tokens drive it as drive the rest of the interface.
 *
 * It plays once per page load: a module-level flag survives client-side
 * navigation, so moving between screens never replays it, while a refresh —
 * which resets the module — shows it again, as asked.
 */

const TOTAL_MS = 2750; // sequence, before the curtain begins to part
const PART_MS = 850; // the parting itself

let playedThisLoad = false;

/** Someone who has asked for less motion gets the page, not the show. */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function IntroCurtain({ onDone }) {
  // Decided before the first render, not in an effect: an effect runs after
  // paint, so deciding there would flash a black screen at exactly the person
  // who asked not to be flashed at.
  const [phase, setPhase] = useState(() =>
    playedThisLoad || prefersReducedMotion() ? 'gone' : 'playing'
  );
  // Held in a ref so the schedule below never depends on the parent's render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const timers = useRef([]);

  // The whole schedule is set once, on mount. Depending on `phase` here would
  // be the obvious thing to write and would quietly break it: entering
  // `parting` would tear the effect down, clear the timer that removes the
  // curtain, and start the pair again — so the panels would slide away on cue,
  // the page would look right, and `overflow: hidden` would stay on the body
  // with a dead layer still mounted over it.
  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const finish = () => {
      clear();
      document.body.style.overflow = '';
      setPhase('gone');
      onDoneRef.current?.();
    };

    if (phase === 'gone') {
      // Nothing to play — reduced motion, or a second mount this page load.
      if (!playedThisLoad) {
        playedThisLoad = true;
        onDoneRef.current?.();
      }
      return undefined;
    }

    playedThisLoad = true;
    document.body.style.overflow = 'hidden';

    const part = () => {
      clear();
      setPhase('parting');
      timers.current.push(setTimeout(finish, PART_MS));
    };

    timers.current.push(setTimeout(part, TOTAL_MS));

    // Skipping cuts to the parting rather than snapping the page in: a curtain
    // that vanishes is a flash, one that opens early is still an opening.
    window.addEventListener('keydown', part);
    window.addEventListener('pointerdown', part);

    return () => {
      clear();
      window.removeEventListener('keydown', part);
      window.removeEventListener('pointerdown', part);
      document.body.style.overflow = '';
    };
    // Mount-only by design — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className={`intro ${phase === 'parting' ? 'intro--parting' : ''}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className="intro-panel intro-panel--top" />
      <div className="intro-panel intro-panel--bottom" />

      <div className="intro-stage">
        {/* Overflowing on purpose: the release pulse grows past the viewBox and
            the key starts well outside it. Clipped to the box, the pulse gains
            four straight edges and the key appears out of nothing at the
            margin instead of flying in. */}
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none" overflow="visible">
          <defs>
            <linearGradient id="introShield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cc91f0" />
              <stop offset="100%" stopColor="#9e5ecf" />
            </linearGradient>
            <radialGradient id="introGlow">
              <stop offset="0%" stopColor="#cc91f0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#cc91f0" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* the release pulse */}
          <circle className="intro-glow" cx="100" cy="120" r="78" fill="url(#introGlow)" />

          <g className="intro-lock">
            {/* shield */}
            <path
              d="M100 24 40 46v46c0 38 26 66 60 78 34-12 60-40 60-78V46L100 24Z"
              fill="#1f1a23"
              stroke="url(#introShield)"
              strokeWidth="3"
            />

            {/* the shackle, hinged at its left leg */}
            <path
              className="intro-shackle"
              d="M76 98V80a24 24 0 0 1 48 0v18"
              stroke="#cc91f0"
              strokeWidth="9"
              strokeLinecap="round"
            />

            {/* body */}
            <rect x="58" y="96" width="84" height="62" rx="14" fill="url(#introShield)" />

            {/* keyhole */}
            <circle cx="100" cy="124" r="8" fill="#1f1a23" />
            <path d="M96 130h8l3 16H93l3-16Z" fill="#1f1a23" />
          </g>

          {/* the key: bow, shaft and bit, arriving from the right */}
          <g className="intro-key" stroke="#fff8f8" strokeWidth="3" strokeLinecap="round">
            <circle cx="150" cy="126" r="11" fill="none" />
            <circle cx="150" cy="126" r="4" fill="#fff8f8" stroke="none" />
            <path d="M139 126h-36" />
            <path d="M112 126v9M120 126v7" />
          </g>
        </svg>

        <div className="intro-word wordmark text-[26px] leading-none text-canvas">
          Provenance<span className="text-accent">.</span>
        </div>
      </div>
    </div>
  );
}
