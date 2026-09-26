import { useEffect, useState } from 'react';

import { getAssets, getReleases, inspectRelease, shortHash } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';
import Select from '../components/Select.jsx';
import { CheckIcon, WarningIcon } from '../components/icons.jsx';

/**
 * Watermark inspection — the registry administrator's view of what actually
 * went out.
 *
 * The mark is invisible by construction and nothing here changes that: this
 * reads a stored copy and runs the same extraction a trace would, then sets
 * the recovered bits against the bits embedded at release.
 *
 * Agreement is reported as a count, never as a verdict. A copy that has been
 * compressed or resized loses bits, and the number of bits lost is exactly
 * what a reviewer needs in order to decide what the result is worth. A screen
 * that said only "match" would be hiding the one figure that matters.
 */
export default function Inspect() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [releases, setReleases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAssets()
      .then((d) => {
        const list = d.assets || [];
        setAssets(list);
        // Open on a document that has something to inspect, rather than
        // greeting the page with an empty state.
        const withCopies = list.find((a) => (a.decryptCount || 0) > 0);
        if (list.length) setAssetId(String((withCopies || list[0]).assetId));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!assetId) return;
    setReleases([]);
    setSelected(null);
    setReport(null);
    getReleases(assetId)
      .then((d) => setReleases(d.releases || []))
      .catch((e) => setError(e.message));
  }, [assetId]);

  async function inspect(receiptId) {
    setSelected(receiptId);
    setReport(null);
    setError(null);
    setLoading(true);
    try {
      setReport(await inspectRelease(receiptId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <Header eyebrow="Forensics" title="Watermark Inspection" />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full sm:w-auto">
          <span className="eyebrow mb-2 block">Document</span>
          <Select
            className="w-full sm:w-72"
            ariaLabel="Document"
            value={assetId}
            onChange={setAssetId}
            options={assets.map((a) => ({
              value: String(a.assetId),
              label: a.title,
              hint: a.decryptCount ? `${a.decryptCount} released` : 'none released',
            }))}
          />
        </label>
      </div>

      {releases.length === 0 ? (
        <Notice>No copies of this document have been released yet.</Notice>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <span className="eyebrow">Released copies ({releases.length})</span>
            </div>
            <ul className="divide-y divide-line/60">
              {releases.map((r) => (
                <li key={r.receiptId}>
                  <button
                    type="button"
                    onClick={() => inspect(r.receiptId)}
                    disabled={!r.hasMarkedFile}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition
                      ${selected === r.receiptId ? 'bg-accent-tint' : 'hover:bg-muted'}
                      disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {r.recipient}
                      </span>
                      {r.dept && (
                        <span className="block truncate text-xs text-ink-muted">{r.dept}</span>
                      )}
                      <span className="mono mt-0.5 block text-[11px] text-ink-faint">
                        {shortHash(r.receiptId, 10, 6)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="mono block text-[11px] text-ink-muted">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                      <span className="mono block text-[11px] text-ink-faint">
                        {r.psnrDb > 0 ? `${r.psnrDb.toFixed(1)} dB` : '—'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5 lg:p-6">
            {loading && <p className="text-sm text-ink-muted">Extracting the watermark…</p>}
            {!loading && !report && (
              <p className="text-sm text-ink-muted">
                Choose a released copy to recover its watermark.
              </p>
            )}
            {report && <Report report={report} />}
          </div>
        </div>
      )}
    </section>
  );
}

function Report({ report }) {
  const { bitsMatching: matching, bitsTotal: total } = report;
  const pct = total ? Math.round((matching / total) * 100) : 0;
  const intact = matching === total;

  return (
    <div className="space-y-5">
      <div>
        <span className="eyebrow">Recovered from the stored copy</span>
        <h3 className="font-display-sm mt-1.5 text-2xl text-ink">{report.asset?.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Released to <span className="font-semibold text-ink">{report.recipient?.name}</span>
          {report.deviceLabel && <span className="mono text-xs"> · {report.deviceLabel}</span>}
        </p>
      </div>

      {/* The headline figure: how much of the mark survived. */}
      <div
        className={`rounded-2xl border p-4 ${
          intact ? 'border-attributed/30 bg-attributed-tint' : 'border-probable/30 bg-probable-tint'
        }`}
      >
        <div className="flex items-center gap-2">
          {intact ? <CheckIcon size={15} /> : <WarningIcon size={15} />}
          <span className="text-sm font-bold text-ink">
            {matching} of {total} bits recovered ({pct}%)
          </span>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          {intact
            ? 'Every embedded bit came back. This copy has not been altered since release.'
            : 'Some bits were lost, which is what compression, resizing or a photograph of a screen does. The receipt below is still the one this copy carries.'}
        </p>
      </div>

      <MarkedPreview key={report.receiptId} report={report} />
    </div>
  );
}

/**
 * The released copy, with a visible stamp naming who holds it.
 *
 * The stamp is drawn over the image in this page and nowhere else. The file on
 * disk — and the copy the officer has — carries only the invisible mark, which
 * is the whole point: a visible stamp can be cropped off, so it is an aid for
 * the person reviewing here, never the evidence. The evidence is the extraction
 * above.
 */
/**
 * The same released copy twice: what the administrator sees, and what the
 * officer holds.
 *
 * Putting them side by side is the point of the section. The stamp is
 * composited on request for this screen only; the file on disk is the one on
 * the right, and it looks untouched — which is exactly what an invisible mark
 * has to do. Seeing the pair makes that concrete in a way a single image or a
 * sentence does not.
 */
function MarkedPreview({ report }) {
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const short = String(report.receiptId).replace(/^0x/, '').slice(0, 16);
  const isImage = (report.asset?.mimeType || '').startsWith('image/');
  // A PDF is shown page by page, each page rendered as a picture.
  const pages = report.pageCount || 0;
  const base = `/api/files/marked/${short}`;
  const pageQ = pages ? `&page=${page}` : '';

  if ((!isImage && !pages) || failed) {
    return (
      <div>
        <span className="eyebrow">The released copy</span>
        <p className="mt-2 rounded-2xl border border-line bg-muted px-4 py-3 text-[13px] text-ink-muted">
          {failed
            ? 'That copy could not be previewed here.'
            : 'This copy cannot be previewed — download it to view it.'}
        </p>
        <a
          href={base}
          className="mt-2 inline-block text-[11px] font-semibold text-ink-muted underline-offset-2 hover:text-accent-deep hover:underline"
        >
          Download original
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">The released copy, both ways</span>
        {pages > 1 && (
          <div className="flex items-center gap-2" role="group" aria-label="Page">
            <button
              type="button"
              className="btn-ghost !px-3 !py-1.5 !text-xs"
              disabled={page <= 1}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
            >
              ‹ Prev
            </button>
            <span className="mono text-xs text-ink-muted">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              className="btn-ghost !px-3 !py-1.5 !text-xs"
              disabled={page >= pages}
              onClick={() => setPage((n) => Math.min(pages, n + 1))}
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Pane
          title="Admin view"
          note="Stamped on request for this screen."
          src={`${base}?inline=1&stamped=1${pageQ}`}
          href={`${base}?stamped=1${pageQ}`}
          alt={`${report.asset?.title}, stamped for review`}
          onError={() => setFailed(true)}
          badge="admin only"
        />
        <Pane
          title={`As ${report.recipient?.name || 'the officer'} sees it`}
          note="The file on disk. The mark is there, and invisible."
          src={`${base}?inline=1${pageQ}`}
          href={pages ? `${base}?page=${page}` : base}
          alt={`${report.asset?.title}, as released`}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}

/** One side of the comparison, held to a fixed height so the pair stays level. */
function Pane({ title, note, src, href, alt, onError, badge }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-muted">
      <figcaption className="flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-ink">
          {title}
        </span>
        {badge && <span className="pill bg-noir text-[9px] text-canvas">{badge}</span>}
      </figcaption>

      {/* A fixed frame rather than the image's own height: a tall scan would
          otherwise push the whole report off the screen. */}
      <div className="grid h-52 place-items-center overflow-hidden bg-white p-2">
        <img
          src={src}
          alt={alt}
          onError={onError}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <span className="text-[10px] leading-snug text-ink-muted">{note}</span>
        <a
          href={href}
          className="shrink-0 text-[10px] font-semibold text-ink-muted underline-offset-2 hover:text-accent-deep hover:underline"
        >
          Download
        </a>
      </div>
    </figure>
  );
}
