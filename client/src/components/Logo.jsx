/**
 * Brand mark for IDEX Trinetra.
 *
 * The mark is the supplied artwork — three watching eyes set in a triangle,
 * the trinetra — cut from the source logo with its navy backdrop keyed out
 * and recoloured to the site: its blues become the accent purple, shade for
 * shade, and its white strokes the ink (or white, on a dark surface). It
 * stands on the page itself, with no tile behind it.
 *
 * The wordmark stays live text rather than part of the image, so it keeps its
 * edges at every size and can invert for the dark panel. It follows the logo:
 * IDEX wide and heavy with the X in the accent purple, TRINETRA spaced out
 * beneath it.
 *
 * @param {'sm'|'md'} size
 * @param {boolean} iconOnly  render just the mark (for tight spaces)
 * @param {boolean} onDark    white strokes and wordmark, for a dark surface
 */
export default function Logo({ size = 'md', iconOnly = false, onDark = false }) {
  const mark = size === 'sm' ? 38 : 46;
  const word = size === 'sm' ? 17 : 21;

  return (
    <div className="flex select-none items-center gap-2">
      <img
        src={onDark ? '/logo-mark-dark.png' : '/logo-mark.png'}
        alt=""
        aria-hidden="true"
        width={mark}
        height={mark}
        className="shrink-0"
        style={{ width: mark, height: mark }}
      />

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
