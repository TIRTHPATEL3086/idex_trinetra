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
 * invisibility trade-off behind the chosen strength. Data comes from the
 * attack suite via /api/metrics.
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

  return (
    <section className="space-y-6">
      <Header
        title="Robustness"
        subtitle="Bits recovered out of 48 after each attack, and PSNR vs. QIM strength — the invisibility/robustness trade-off."
      />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !metrics && <Notice>Loading metrics…</Notice>}
      {notRun && (
        <Notice>
          No measurements yet. Run <span className="mono">npm run attack:suite</span> to generate
          them.
        </Notice>
      )}

      {metrics && !notRun && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink">Attack survival</h3>
            <p className="mb-4 text-xs text-ink-muted">Bits recovered out of 48 (target: 40+).</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={metrics.attacks} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecebe4" vertical={false} />
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
                  }}
                />
                <ReferenceLine y={40} stroke="#d99a1c" strokeDasharray="4 4" />
                <Bar dataKey="bitsRecovered" fill="#c9f24d" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink">PSNR vs. strength (Δ)</h3>
            <p className="mb-4 text-xs text-ink-muted">
              Higher Δ is more robust but less invisible. &gt;40 dB is imperceptible.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={metrics.psnrCurve} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ecebe4" vertical={false} />
                <XAxis
                  dataKey="delta"
                  tick={{ fontSize: 11, fill: '#6f7268' }}
                  label={{ value: 'Δ', position: 'insideBottom', offset: -2, fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6f7268' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #ecebe4', fontSize: 12 }}
                />
                <ReferenceLine y={40} stroke="#4d9d2a" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="psnrDb"
                  stroke="#141410"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#c9f24d', stroke: '#141410', strokeWidth: 1.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
