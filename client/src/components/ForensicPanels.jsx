/**
 * Result panels for the Trace page: the tamper heatmap from the fragile
 * watermark layer, and what the optical lens did to a photographed leak.
 */

const TAMPER = {
  intact: {
    label: 'Contents intact',
    chip: 'bg-attributed-tint text-attributed-deep',
    blurb: 'Every block of the fragile layer verifies: not one pixel has changed since release.',
  },
  tampered: {
    label: 'Contents altered',
    chip: 'bg-danger-tint text-danger-deep',
    blurb: 'The fragile layer is broken in the red regions — this copy was edited after release.',
  },
  unassessable: {
    label: 'Cannot assess edits',
    chip: 'bg-muted text-ink-muted',
    blurb: 'The copy was re-encoded or resized, which erases the fragile layer everywhere.',
  },
};

export function TamperPanel({ tamper }) {
  if (!tamper) return null;
  const t = TAMPER[tamper.status] || TAMPER.unassessable;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-5 py-3.5">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Tamper heatmap · fragile watermark layer
          </div>
        </div>
        <span className={`pill text-xs font-bold ${t.chip}`}>{t.label}</span>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {tamper.heatmap ? (
          <div className="min-w-0">
            <img
              src={tamper.heatmap}
              alt="Tamper heatmap: green blocks verify, red blocks were altered"
              className="w-full rounded-2xl border border-line"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-attributed" /> authentic
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-danger" /> altered after release
              </span>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[8rem] place-items-center rounded-2xl border border-dashed border-line bg-surface p-4 text-center text-xs text-ink-muted">
            No heatmap — the fragile layer did not survive in this copy.
          </div>
        )}
        <div className="min-w-0 space-y-3 text-sm">
          <p className="text-ink-muted">{t.blurb}</p>
          <p className="text-ink">{tamper.reason}</p>
          {tamper.regions?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Altered regions
              </div>
              <ul className="mono mt-1.5 space-y-1 text-xs text-danger-deep">
                {tamper.regions.slice(0, 6).map((r, i) => (
                  <li key={i}>
                    x {r.x}–{r.x + r.w}, y {r.y}–{r.y + r.h} ({r.w}×{r.h} px)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * How a photo or screenshot was read: the released page was found inside the
 * upload and put back on its own pixel grid before the mark was read.
 */
export function CapturePanel({ capture }) {
  if (!capture) return null;
  const photo = capture.method === 'quad';
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-surface px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
        {photo ? 'Phone photo' : 'Screenshot or crop'} · how it was read
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
        <dt className="text-ink-muted">Found</dt>
        <dd className="text-ink">
          {photo
            ? 'The page’s corners were detected and the perspective straightened'
            : 'The released page was located inside the image'}
        </dd>
        <dt className="text-ink-muted">Scale</dt>
        <dd className="text-ink">{Math.round(capture.scale * 100)}% of the released size</dd>
        <dt className="text-ink-muted">In view</dt>
        <dd className="text-ink">
          {Math.round(capture.visibleShare * 100)}% of the page — the mark was read from that part
        </dd>
        <dt className="text-ink-muted">Registered</dt>
        <dd className="text-ink">Aligned to the released copy to within a pixel, tones matched</dd>
      </dl>
    </div>
  );
}

export function LensPanel({ lens }) {
  if (!lens) return null;
  if (!lens.applied) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        Optical lens: {lens.reason}
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-surface px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
        Optical forensic lens · what was corrected
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <img
          src={lens.preview}
          alt="The photo after perspective correction and moire removal"
          className="w-full min-w-0 rounded-2xl border border-line"
        />
        <dl className="grid content-start grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Corners</dt>
          <dd className="text-ink">
            {lens.autoDetected ? 'Detected automatically' : 'Placed by the examiner'}
          </dd>
          <dt className="text-ink-muted">Perspective</dt>
          <dd className="text-ink">
            Flattened to {lens.size.width}×{lens.size.height} px
          </dd>
          <dt className="text-ink-muted">Moiré</dt>
          <dd className="text-ink">
            {lens.moirePeaks
              ? `${lens.moirePeaks} interference peak${lens.moirePeaks === 1 ? '' : 's'} notched out`
              : 'None found'}
          </dd>
          <dt className="text-ink-muted">Exposure</dt>
          <dd className="text-ink">Tones matched to the released copy before reading the mark</dd>
        </dl>
      </div>
    </div>
  );
}

/**
 * The reads a trace makes, in the order it makes them, and which one
 * recovered the mark. Passes 0-3 are the rescaled reads — each a different way
 * of lining a photo's pixels back up with the released copy's.
 */
const READS = [
  {
    key: 'as-uploaded',
    title: 'Read as uploaded',
    body: 'The file itself — or the page straightened by the lens — read at its own size.',
  },
  {
    key: 'direct',
    title: 'Pass 0 · Direct read',
    body: "At the photo's own size, so no upscaling blur, at the release's own strength and 12 and 14.",
  },
  {
    key: 'scaled',
    title: 'Pass 1 · Scaled read',
    body: "Scaled back to the released copy's exact size, at strengths up to 16.",
  },
  {
    key: 'tones',
    title: 'Pass 2 · Tone-matched read',
    body: "The camera's exposure and white balance matched to the released copy first.",
    lensOnly: true,
  },
  {
    key: 'topcrop',
    title: 'Pass 3 · Top-crop read',
    body: 'The upper 55% only — for a laptop photographed with its keyboard in the frame.',
  },
  {
    key: 'capture',
    title: 'Capture recovery',
    body: 'The released page located inside a larger photo or screenshot, and read from the part in view.',
  },
];

export function ReadPassesPanel({ extraction }) {
  if (!extraction) return null;
  const pass = extraction.pass === 'straightened' ? 'as-uploaded' : extraction.pass;

  if (pass === 'document') {
    return (
      <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        How the mark was read: from the PDF&apos;s own document layers — no rescaled read needed.
      </div>
    );
  }

  const foundAt = extraction.found ? READS.findIndex((r) => r.key === pass) : -1;
  const status = (r, i) => {
    if (r.lensOnly && !extraction.tones) return { text: 'Lens photos only', tone: 'muted' };
    if (i === foundAt) return { text: 'Found the mark', tone: 'found' };
    if (foundAt >= 0 && i > foundAt) return { text: 'Not needed', tone: 'muted' };
    return { text: foundAt >= 0 ? 'Tried' : 'Tried — no mark', tone: 'tried' };
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-5 py-3.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          How the mark was read
        </span>
        <span className="text-xs text-ink-faint">
          {foundAt >= 0
            ? `Recovered by: ${READS[foundAt].title}`
            : 'No read recovered a mark that names a recipient'}
        </span>
      </div>
      <ol className="divide-y divide-line">
        {READS.map((r, i) => {
          const s = status(r, i);
          return (
            <li
              key={r.key}
              className={`flex items-start gap-3 px-5 py-3 ${s.tone === 'found' ? 'bg-accent/10' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  s.tone === 'found'
                    ? 'bg-accent-deep'
                    : s.tone === 'tried'
                      ? 'bg-ink-muted'
                      : 'bg-line'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-bold ${s.tone === 'muted' ? 'text-ink-muted' : 'text-ink'}`}
                >
                  {r.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  {r.body}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  s.tone === 'found'
                    ? 'bg-accent-deep text-white'
                    : s.tone === 'tried'
                      ? 'bg-surface text-ink'
                      : 'bg-surface text-ink-faint'
                }`}
              >
                {s.text}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
