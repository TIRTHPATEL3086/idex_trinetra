/**
 * Brand mark for Provenance.
 *
 * The glyph is a fingerprint — the app's whole idea is that every released copy
 * carries a unique, invisible mark that identifies exactly who opened it, so a
 * fingerprint is the literal metaphor. It sits in a chunky, rounded coral tile
 * to echo the bold rounded logo style of the reference design; the wordmark is
 * set in Bricolage Grotesque with a single coral dot.
 *
 * Our own mark — nothing is copied from another product.
 *
 * @param {'sm'|'md'} size
 * @param {boolean} iconOnly  render just the tile (for tight spaces)
 * @param {boolean} onDark    invert the wordmark for a dark surface
 */
export default function Logo({ size = 'md', iconOnly = false, onDark = false }) {
  const tile = size === 'sm' ? 34 : 40;
  const word = size === 'sm' ? 20 : 24;

  return (
    <div className="flex select-none items-center gap-2.5">
      <span
        className="grid shrink-0 place-items-center rounded-[30%] bg-accent shadow-[0_6px_18px_-6px_rgba(255,116,72,0.85)]"
        style={{ width: tile, height: tile }}
      >
        <Fingerprint size={Math.round(tile * 0.62)} />
      </span>

      {!iconOnly && (
        <span
          className={`font-display leading-none ${onDark ? 'text-white' : 'text-ink'}`}
          style={{ fontSize: word, fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Provenance
          <span className={onDark ? 'text-accent' : 'text-accent-deep'}>.</span>
        </span>
      )}
    </div>
  );
}

/** Nested fingerprint ridges + a solid core, drawn in near-black on the coral tile. */
function Fingerprint({ size = 24 }) {
  const p = {
    fill: 'none',
    stroke: '#0f151d',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* outer ridges, opening top and bottom like a real print */}
      <path d="M4.5 13.2A7.5 7.5 0 0 1 19 10.5" {...p} />
      <path d="M19.6 13.5A7.6 7.6 0 0 1 18.9 17" {...p} />
      <path d="M7 12.4A5 5 0 0 1 16.9 12.1c0 1.6-.15 3.1-.5 4.6" {...p} />
      <path d="M7.2 15.8c.35 1.5.4 2.4.3 3.4" {...p} />
      <path d="M9.6 12a2.5 2.5 0 0 1 4.9.6c0 2.3-.3 4.6-1 6.8" {...p} />
      <path d="M10.7 19.9c.3-.9.5-1.7.7-2.6" {...p} />
      {/* core */}
      <circle cx="12" cy="12.3" r="1.15" fill="#0f151d" />
    </svg>
  );
}
