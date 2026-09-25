import { useEffect, useState, useCallback } from 'react';
import { Header, Notice } from './Assets.jsx';
import { getUsers, shortHash } from '../lib/api.js';
import Select from '../components/Select.jsx';
import { useAuth } from '../lib/auth.jsx';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
} from '../components/icons.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

async function fetchGlobalAudit({ page = 1, limit = 50, userId, classification, from, to } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (userId) params.set('userId', userId);
  if (classification) params.set('classification', classification);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await fetch(`${BASE}/api/audit/global?${params}`, { credentials: 'include' });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error?.message || res.statusText);
  }
  return res.json();
}

/**
 * Global Audit History — every DecryptionEvent stored permanently in PostgreSQL.
 * Data NEVER resets on logout or server restart. Admin / Investigator only.
 */
export default function History() {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const EMPTY = { userId: '', classification: '', from: '', to: '' };
  const [filters, setFilters] = useState(EMPTY);
  const [officers, setOfficers] = useState([]);

  useEffect(() => {
    getUsers()
      .then(({ users }) => setOfficers(users))
      .catch(() => setOfficers([]));
  }, []);

  const load = useCallback(
    (p = page) => {
      setLoading(true);
      setError(null);
      const q = {
        page: p,
        limit: 50,
        ...(filters.userId ? { userId: Number(filters.userId) } : {}),
        ...(filters.classification ? { classification: filters.classification } : {}),
        ...(filters.from ? { from: new Date(filters.from).toISOString() } : {}),
        ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
      };
      fetchGlobalAudit(q)
        .then((d) => {
          setData(d);
          setPage(p);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [page, filters]
  );

  useEffect(() => {
    load(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('audit:read')) {
    return (
      <section className="space-y-6">
        <Header title="Audit History" />
        <Notice tone="error">Your role does not have access to the global audit history.</Notice>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Header eyebrow="Audit" title="Global Audit History" />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="card grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 block min-w-0 sm:col-span-1 lg:col-span-1">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Officer
          </span>
          <Select
            ariaLabel="Filter by officer"
            value={filters.userId}
            onChange={(v) => setFilters((f) => ({ ...f, userId: v }))}
            options={[
              { value: '', label: 'All officers' },
              ...officers.map((u) => ({
                value: String(u.userId),
                label: u.name,
                hint: u.dept || '',
              })),
            ]}
          />
        </div>
        <div className="col-span-2 block min-w-0 sm:col-span-1 lg:col-span-1">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Classification
          </span>
          <Select
            ariaLabel="Filter by document classification"
            value={filters.classification}
            onChange={(v) => setFilters((f) => ({ ...f, classification: v }))}
            options={[
              { value: '', label: 'All classifications' },
              { value: 'RESTRICTED', label: 'RESTRICTED' },
              { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL' },
              { value: 'SECRET', label: 'SECRET' },
            ]}
          />
        </div>
        <FilterField
          label="From"
          value={filters.from}
          onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
          type="date"
        />
        <FilterField
          label="To"
          value={filters.to}
          onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
          type="date"
        />
        <button className="btn-accent w-full" onClick={() => load(1)} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
        <button
          className="w-full rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-muted hover:text-ink"
          onClick={() => {
            setFilters(EMPTY);
          }}
        >
          Clear
        </button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total Events', value: data.total.toLocaleString() },
            { label: 'This Page', value: `${data.events.length} of ${data.limit}` },
            { label: 'Page', value: `${data.page} / ${data.pages || 1}` },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
              <div className="mt-1 text-lg font-bold text-ink">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {data && data.events.length === 0 && <Notice>No decryption events recorded yet.</Notice>}

      {data && data.events.length > 0 && (
        <>
          <div className="card overflow-x-auto scroll-slim shadow-sm">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line bg-noir/[0.02] text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {[
                    'When',
                    'Officer',
                    'Dept',
                    'Document',
                    'Device',
                    'Receipt',
                    'Tx Hash',
                    'PSNR',
                    'Sig',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data.events.map((e) => (
                  <tr key={e.id} className="hover:bg-line/25 transition-colors">
                    <td className="px-4 py-3.5 mono text-xs text-ink-muted whitespace-nowrap">
                      {new Date(e.at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm font-bold text-ink">
                      {e.userName}
                    </td>
                    <td className="px-4 py-3.5 text-ink-muted text-xs font-medium">
                      {e.department}
                    </td>
                    <td className="max-w-[180px] px-4 py-3.5 text-sm font-medium text-ink">
                      {/* Title truncates on its own line, so the badge is never the part cut off. */}
                      <span className="block truncate" title={e.assetTitle}>
                        {e.assetTitle}
                      </span>
                      {e.assetClassification && (
                        <span className="mt-1 inline-block rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                          {e.assetClassification}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 mono text-xs text-ink-muted">{e.device}</td>
                    <td className="px-4 py-3.5 mono text-xs text-ink-muted">
                      {shortHash(e.receiptId, 6, 4)}
                    </td>
                    <td className="px-4 py-3.5 mono text-xs">
                      {e.etherscanUrl ? (
                        <a
                          href={e.etherscanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-attributed hover:underline"
                        >
                          {shortHash(e.txHash, 6, 4)} <ExternalLinkIcon size={11} />
                        </a>
                      ) : (
                        <span className="text-ink-muted">{shortHash(e.txHash, 6, 4)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 mono text-xs font-semibold text-ink">
                      {e.psnrDb != null ? `${Number(e.psnrDb).toFixed(1)} dB` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      {e.signatureAlgorithm ? (
                        <span className="rounded-full bg-attributed-tint px-2.5 py-0.5 text-xs font-bold text-attributed-deep">
                          <CheckIcon size={11} /> PQC
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between">
              <button
                className="btn-dark"
                disabled={page <= 1 || loading}
                onClick={() => load(page - 1)}
              >
                <ChevronLeftIcon size={14} /> Previous
              </button>
              <span className="text-sm text-ink-muted">
                Page {data.page} of {data.pages} ({data.total} total)
              </span>
              <button
                className="btn-dark"
                disabled={page >= data.pages || loading}
                onClick={() => load(page + 1)}
              >
                Next <ChevronRightIcon size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FilterField({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <input
        type={type}
        className="input w-full min-w-0 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
