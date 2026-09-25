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
