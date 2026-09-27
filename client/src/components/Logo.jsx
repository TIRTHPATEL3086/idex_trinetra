/**
 * Brand mark for IDEX Trinetra.
 *
 * The mark is the supplied artwork — three watching eyes set in a triangle,
 * the trinetra — cut from the source logo with its navy backdrop keyed out.
 * Its strokes are white and blue, so on a light surface it sits on a tile of
 * the logo's own navy, the way the source presents it; on a dark surface it
 * stands alone.
 *
 * The wordmark stays live text rather than part of the image, so it keeps its
 * edges at every size and can invert for the dark panel. It follows the logo:
 * IDEX wide and heavy with the X in the mark's blue, TRINETRA spaced out
 * beneath it.
 *
 * @param {'sm'|'md'} size
 * @param {boolean} iconOnly  render just the mark (for tight spaces)
 * @param {boolean} onDark    drop the tile and invert the wordmark for a dark surface
 */
export default function Logo({ size = 'md', iconOnly = false, onDark = false }) {
  const tile = size === 'sm' ? 36 : 44;
  const word = size === 'sm' ? 17 : 21;

  return (
    <div className="flex select-none items-center gap-2.5">
      <span
        className={`grid shrink-0 place-items-center ${onDark ? '' : 'rounded-[10px] bg-brand-navy shadow-sm'}`}
        style={{ width: tile, height: tile }}
      >
        <img
          src="/logo-mark-transparent.png"
          alt=""
          aria-hidden="true"
          width={tile}
          height={tile}
          style={{ width: onDark ? tile : tile * 0.84, height: onDark ? tile : tile * 0.84 }}
        />
      </span>

      {!iconOnly && (
        <span className="flex flex-col leading-none" aria-label="IDEX Trinetra">
          <span
            className={`brand-idex ${onDark ? 'text-white' : 'text-ink'}`}
            style={{ fontSize: word }}
            aria-hidden="true"
          >
            IDE<span className="brand-x">X</span>
          </span>
          <span
            className={`brand-trinetra ${onDark ? 'text-white/70' : 'text-ink/60'}`}
            style={{ fontSize: Math.round(word * 0.5) }}
            aria-hidden="true"
          >
            TRINETRA
          </span>
        </span>
      )}
    </div>
  );
}
