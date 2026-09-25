import { useEffect, useRef, useState } from 'react';

import { detectLensCorners } from '../lib/api.js';

const LABELS = ['TL', 'TR', 'BR', 'BL'];

/**
 * Corner editor for the optical lens.
 *
 * Shows the photographed leak with four handles on the document's corners.
 * The server's detection places them first; the examiner drags any that are
 * off (mouse or touch) and traces with exactly those corners. Coordinates are
 * kept in the photo's own pixels, whatever size it is drawn at.
 */
export default function LensEditor({ file, onTrace, onCancel, busy }) {
  const [url, setUrl] = useState(null);
  const [size, setSize] = useState(null); // photo pixels {width, height}
  const [corners, setCorners] = useState(null);
  const [detected, setDetected] = useState(null);
  const [state, setState] = useState('detecting'); // detecting | ready | manual
  const svgRef = useRef(null);
  const dragging = useRef(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    let live = true;
    detectLensCorners(file)
      .then((r) => {
        if (!live) return;
        setSize({ width: r.width, height: r.height });
        // Default fallback targets the upper screen region (avoids laptop keyboards/desks)
        const fallback = [
          { x: Math.round(r.width * 0.08), y: Math.round(r.height * 0.12) },
          { x: Math.round(r.width * 0.92), y: Math.round(r.height * 0.12) },
          { x: Math.round(r.width * 0.92), y: Math.round(r.height * 0.58) },
          { x: Math.round(r.width * 0.08), y: Math.round(r.height * 0.58) },
        ];
        setDetected(r.corners);
        setCorners(r.corners || fallback);
        setState(r.corners ? 'ready' : 'manual');
      })
      .catch(() => live && setState('manual'));
    return () => {
      live = false;
      URL.revokeObjectURL(u);
    };
  }, [file]);

  function toPhoto(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return {
      x: Math.max(0, Math.min(size.width - 1, p.x)),
      y: Math.max(0, Math.min(size.height - 1, p.y)),
    };
  }

  const onMove = (e) => {
    if (dragging.current == null) return;
    e.preventDefault();
    const p = toPhoto(e);
    setCorners((cs) => cs.map((c, i) => (i === dragging.current ? p : c)));
  };
  const stop = () => {
    dragging.current = null;
  };

  const r = size ? Math.max(size.width, size.height) / 55 : 10; // handle radius in photo pixels

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">Optical forensic lens</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {state === 'detecting'
              ? 'Finding the document in the photo…'
              : state === 'ready'
                ? 'Corners found automatically. Drag any handle that is off, then trace.'
                : 'Corners could not be found automatically — drag the four handles onto the document’s corners.'}
          </p>
        </div>
        {detected && (
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            onClick={() => setCorners(detected)}
          >
            Reset to detected
          </button>
        )}
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs text-ink flex items-start gap-2.5">
        <span className="text-base select-none">🎯</span>
        <div className="leading-snug">
          <strong className="text-accent font-bold">Forensic Lens Alignment Tip:</strong> Drag the 4 corner handles onto the corners of the <strong>COMPUTER DISPLAY SCREEN ONLY</strong>. Exclude the laptop keyboard, bezels, and desk so the mathematical watermark grid lines up.
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-noir">
        {url && size && corners ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="block h-auto w-full touch-none select-none"
            onPointerMove={onMove}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
          >
            <image href={url} width={size.width} height={size.height} />
            <polygon
              points={corners.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="rgba(204,145,240,0.18)"
              stroke="#cc91f0"
              strokeWidth={r / 4}
              strokeLinejoin="round"
            />
            {corners.map((c, i) => (
              <g
                key={LABELS[i]}
                transform={`translate(${c.x} ${c.y})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.currentTarget.ownerSVGElement.setPointerCapture?.(e.pointerId);
                  dragging.current = i;
                }}
              >
                <circle r={r * 1.8} fill="transparent" />
                <circle r={r} fill="#fff8f8" stroke="#9e5ecf" strokeWidth={r / 3} />
                <text
                  y={-r * 1.6}
                  textAnchor="middle"
                  fontSize={r * 1.1}
                  fontWeight="700"
                  fill="#fff8f8"
                  stroke="#1f1a23"
                  strokeWidth={r / 6}
                  paintOrder="stroke"
                >
                  {LABELS[i]}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div className="grid aspect-video place-items-center text-xs text-white/60">
            Loading photo…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-accent flex-1"
          disabled={!corners || busy}
          onClick={() => onTrace(corners.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })))}
        >
          {busy ? 'Tracing…' : 'Trace with lens'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
