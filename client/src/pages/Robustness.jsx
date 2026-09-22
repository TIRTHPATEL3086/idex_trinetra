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
import { Header, Notice } from './Assets.jsx';

/**
 * How many of the 48 watermark bits survive real-world damage, and the
 * invisibility trade-off behind the chosen strength.
 * Combines offline attack-suite empirical benchmarks with live production PSNR metrics.
 */
export default function Robustness() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch((e) => setError(e.message));
  }, []);

  const notRun = metrics && (metrics.source === 'not-run' || metrics.attacks?.length === 0);
  const live = metrics?.live;

  return (
    <section className="space-y-6">
      <Header
        title="Watermark Invisibility & Robustness"
        subtitle="Empirical bit-survival under 8 signal degradation attacks, alongside real-time production PSNR telemetry from Postgres."
      />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !metrics && <Notice>Loading robustness telemetry…</Notice>}

      {/* Production Telemetry KPI Tiles */}
      {live && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Live Decryptions
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {live.totalDecryptions ?? 0}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Anchored & watermarked</p>
          </div>

          <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-lime-400">
              Mean PSNR
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {live.avgPsnr > 0 ? `${live.avgPsnr} dB` : '—'}
            </div>
            <p className="mt-1 text-xs text-ink-muted">&gt;40 dB threshold: Imperceptible</p>
          </div>

          <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              PSNR Range
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {live.minPsnr !== null ? `${live.minPsnr} – ${live.maxPsnr} dB` : '—'}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Min / Max observed</p>
          </div>

          <div className="rounded-xl border border-edge bg-card/60 p-5 backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              QIM Delta (Δ)
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
              16 – 24
            </div>
            <p className="mt-1 text-xs text-ink-muted">Adaptive DWT-DCT quantization</p>
          </div>
        </div>
      )}

      {/* Live Decryption PSNR History (if records exist) */}
      {live?.history?.length > 0 && (
        <div className="rounded-xl border border-edge bg-card p-5">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink">Real-time Production Decryption Fidelity</h3>
              <p className="text-xs text-ink-muted">
                PSNR (dB) across the last {live.history.length} watermarked document decryptions in Postgres.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-500/10 px-2.5 py-1 text-xs font-medium text-lime-400 ring-1 ring-lime-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse" />
              Live DB Telemetry
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={live.history} margin={{ left: -18, right: 8, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ecebe4" opacity={0.3} vertical={false} />
              <XAxis dataKey="index" tick={{ fontSize: 11, fill: '#6f7268' }} label={{ value: 'Event #', position: 'insideBottom', offset: -2, fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#6f7268' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #ecebe4', fontSize: 12, backgroundColor: '#181916', color: '#fff' }}
                formatter={(val) => [`${val} dB`, 'PSNR']}
              />
              <ReferenceLine y={40} stroke="#4d9d2a" strokeDasharray="4 4" label={{ value: '40dB imperceptible', fill: '#4d9d2a', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="psnrDb"
                stroke="#c9f24d"
                strokeWidth={2}
                dot={{ r: 3, fill: '#c9f24d' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attack Suite Benchmark Charts */}
      {metrics && !notRun ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink">Attack Survival (Empirical)</h3>
            <p className="mb-4 text-xs text-ink-muted">Bits recovered out of 48 (detection threshold: 40+).</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.attacks} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecebe4" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#6f7268' }}
                  angle={-25}
                  textAnchor="end"
                  height={54}
                  interval={0}
                />
                <YAxis domain={[0, 48]} tick={{ fontSize: 11, fill: '#6f7268' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #ecebe4',
                    fontSize: 12,
                    backgroundColor: '#181916',
                    color: '#fff',
                  }}
                />
                <ReferenceLine y={40} stroke="#d99a1c" strokeDasharray="4 4" />
                <Bar dataKey="bitsRecovered" fill="#c9f24d" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink">PSNR vs. Strength (Δ)</h3>
            <p className="mb-4 text-xs text-ink-muted">
              Higher Δ improves attack survivability at the cost of PSNR. &gt;40 dB is humanly imperceptible.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={metrics.psnrCurve} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecebe4" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="delta"
                  tick={{ fontSize: 11, fill: '#6f7268' }}
                  label={{ value: 'Δ', position: 'insideBottom', offset: -2, fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6f7268' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #ecebe4', fontSize: 12, backgroundColor: '#181916', color: '#fff' }}
                />
                <ReferenceLine y={40} stroke="#4d9d2a" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="psnrDb"
                  stroke="#c9f24d"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#c9f24d', stroke: '#141410', strokeWidth: 1.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-edge bg-card/40 p-6 text-center">
          <h4 className="text-sm font-semibold text-ink">Full Empirical Attack Benchmarks</h4>
          <p className="mt-1 text-xs text-ink-muted max-w-lg mx-auto">
            The offline attack suite runs 8 destructive transformations (JPEG Q=30, Gaussian blur, 10% crop, Poisson noise, 2° shear, 90° rotation, etc.).
          </p>
          <div className="mt-4">
            <span className="inline-block rounded-lg bg-night/50 px-4 py-2 font-mono text-xs text-lime-400 border border-edge">
              npm run attack:suite
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
