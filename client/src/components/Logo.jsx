/**
 * Brand mark for Provenance.
 *
 * The mark is the supplied artwork — a marked document behind a lock, ringed
 * by fingerprint ridges — cropped square from the source logo.
 *
 * The source is a flattened app icon, so the tile behind the artwork is keyed
 * out by luminance — the tile sits around 34 and the artwork starts near 120,
 * which leaves plenty of air between them. The mark therefore floats on every
 * surface with no badge behind it.
 *
 * The wordmark stays live text rather than part of the image, so it keeps its
 * edges at every size and can invert for the dark panel.
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
      <img
        src="/logo-mark-transparent.png"
        alt=""
        aria-hidden="true"
        width={tile}
        height={tile}
        className="shrink-0"
        style={{ width: tile, height: tile }}
      />

      {!iconOnly && (
        <span
          className={`wordmark leading-none ${onDark ? 'text-white' : 'text-ink'}`}
          style={{ fontSize: word }}
        >
          provenance
          <span className={onDark ? 'text-accent' : 'text-accent-deep'}>.</span>
        </span>
      )}
    </div>
  );
}
