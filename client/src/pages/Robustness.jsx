import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getMetrics } from '../lib/api.js';
import Select from '../components/Select.jsx';
import { Header, Notice } from './Assets.jsx';

/**
 * How many of the 48 watermark bits survive real-world damage, and the
 * invisibility trade-off behind the chosen strength.
 * Combines offline attack-suite empirical benchmarks with live production PSNR metrics.
 */
export default function Robustness() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  // Telemetry is drawn from real releases, so it can be read per
  // classification: whether the marks hold on SECRET material is a different
  // question from how they do on average.
  const [classification, setClassification] = useState('ALL');

  useEffect(() => {
    setError(null);
    getMetrics(classification)
      .then(setMetrics)
      .catch((e) => setError(e.message));
  }, [classification]);

  const notRun = metrics && (metrics.source === 'not-run' || metrics.attacks?.length === 0);
  const live = metrics?.live;

  return (
    <section className="space-y-3.5">
      <Header
        eyebrow="Metrics"
        title="Watermark Invisibility & Robustness"
        action={
          <label className="block">
            <span className="eyebrow mb-2 block">Classification</span>
            <Select
              className="w-56"
              ariaLabel="Filter telemetry by classification"
              value={classification}
              onChange={setClassification}
              options={[
                { value: 'ALL', label: 'All classifications' },
                { value: 'RESTRICTED', label: 'RESTRICTED' },
                { value: 'CONFIDENTIAL', label: 'CONFIDENTIAL' },
                { value: 'SECRET', label: 'SECRET' },
              ]}
            />
          </label>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !metrics && <Notice>Loading robustness telemetry…</Notice>}

      {/* Production Telemetry KPI Tiles */}
      {live && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="card p-3 sm:p-3.5 shadow-xs">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Live Decryptions
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              {live.totalDecryptions ?? 0}
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">Anchored & watermarked</p>
          </div>

          <div className="card p-5 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-accent-deep">
              Mean PSNR
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              {live.avgPsnr > 0 ? `${live.avgPsnr} dB` : '—'}
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">&gt;40 dB threshold: Imperceptible</p>
          </div>

          <div className="card p-3 sm:p-3.5 shadow-xs">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              PSNR Range
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              {live.minPsnr !== null ? `${live.minPsnr} – ${live.maxPsnr} dB` : '—'}
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">Min / Max observed</p>
          </div>

          <div className="card p-3 sm:p-3.5 shadow-xs">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              QIM Delta (Δ)
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              16 – 24
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">Adaptive DWT-DCT quantization</p>
          </div>
        </div>
      )}

      {/* Live Decryption PSNR History (if records exist) */}
      {live?.history?.length > 0 && (
        <div className="card p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-ink">
                Real-time Production Decryption Fidelity
              </h3>
              <p className="text-xs text-ink-muted">
                PSNR (dB) across the last {live.history.length} watermarked document decryptions in
                Postgres.
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={live.history} margin={{ left: -18, right: 8, top: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e7dde0"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 11, fill: '#6e6472' }}
                axisLine={{ stroke: '#e7dde0' }}
                tickLine={{ stroke: '#e7dde0' }}
                label={{ value: 'Event #', position: 'insideBottom', offset: -2, fontSize: 10 }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: '#6e6472' }}
                axisLine={{ stroke: '#e7dde0' }}
                tickLine={{ stroke: '#e7dde0' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #2a2430',
                  fontSize: 12,
                  backgroundColor: '#1f1a23',
                  color: '#fff',
                }}
                formatter={(val) => [`${val} dB`, 'PSNR']}
              />
              <ReferenceLine
                y={40}
                stroke="#2e8a2c"
                strokeDasharray="4 4"
                label={{ value: '40dB imperceptible', fill: '#2e8a2c', fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="psnrDb"
                stroke="#9e5ecf"
                strokeWidth={2}
                dot={{ r: 3, fill: '#9e5ecf' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attack Suite Benchmark Charts */}
      {metrics && !notRun ? (
        <div className="grid gap-3.5 grid-cols-1 xl:grid-cols-2">
          <div className="card p-3.5 sm:p-4">
            <h3 className="text-sm font-bold text-ink">Attack Survival (Empirical)</h3>
            <p className="mb-4 text-xs text-ink-muted">
              Bits recovered out of 48 (detection threshold: 40+).
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.attacks} margin={{ left: -18, right: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e7dde0"
                  opacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#6e6472' }}
                  axisLine={{ stroke: '#e7dde0' }}
                  tickLine={{ stroke: '#e7dde0' }}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                  interval={0}
                />
                <YAxis
                  domain={[0, 48]}
                  tick={{ fontSize: 11, fill: '#6e6472' }}
                  axisLine={{ stroke: '#e7dde0' }}
                  tickLine={{ stroke: '#e7dde0' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #2a2430',
                    fontSize: 12,
                    backgroundColor: '#1f1a23',
                    color: '#fff',
                  }}
                />
                {/* No inline label here: the bars run the full width and it collided
                    with them. The threshold is already named in the subtitle
                    above, which is the visible label the status line needs. */}
                <ReferenceLine y={40} stroke="#2e8a2c" strokeDasharray="5 4" />
                <Bar dataKey="bitsRecovered" fill="#9e5ecf" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-3.5 sm:p-4">
            <h3 className="text-sm font-bold text-ink">PSNR vs. Strength (Δ)</h3>
            <p className="mb-4 text-xs text-ink-muted">
              Higher Δ improves attack survivability at the cost of PSNR. &gt;40 dB is humanly
              imperceptible.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={metrics.psnrCurve} margin={{ left: -18, right: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e7dde0"
                  opacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="delta"
                  tick={{ fontSize: 11, fill: '#6e6472' }}
                  axisLine={{ stroke: '#e7dde0' }}
                  tickLine={{ stroke: '#e7dde0' }}
                  label={{ value: 'Δ', position: 'insideBottom', offset: -2, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6e6472' }}
                  axisLine={{ stroke: '#e7dde0' }}
                  tickLine={{ stroke: '#e7dde0' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #2a2430',
                    fontSize: 12,
                    backgroundColor: '#1f1a23',
                    color: '#fff',
                  }}
                />
                <ReferenceLine
                  y={40}
                  stroke="#2e8a2c"
                  strokeDasharray="5 4"
                  label={{
                    value: '40 dB · imperceptible',
                    position: 'insideBottomLeft',
                    fontSize: 10,
                    fill: '#2e8a2c',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="psnrDb"
                  stroke="#9e5ecf"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#9e5ecf', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white p-6 text-center">
          <h4 className="text-sm font-semibold text-ink">Full Empirical Attack Benchmarks</h4>
          <p className="mt-1 text-xs text-ink-muted max-w-lg mx-auto">
            The offline attack suite runs 8 destructive transformations (JPEG Q=30, Gaussian blur,
            10% crop, Poisson noise, 2° shear, 90° rotation, etc.).
          </p>
          <div className="mt-4">
            <span className="inline-block rounded-lg bg-noir/50 px-4 py-2 font-mono text-xs text-accent border border-line">
              npm run attack:suite
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
