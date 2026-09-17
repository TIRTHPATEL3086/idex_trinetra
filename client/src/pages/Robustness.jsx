import { Header, Panel } from './Assets.jsx';

/**
 * C7 — the two charts that prove the watermark actually works.
 *
 * TODO(C): Recharts against getMetrics()
 *   - bar chart: 8 attacks x bits recovered (out of 48), with the target line
 *   - line chart: PSNR vs DELTA — the invisibility/robustness trade-off
 *
 * /api/metrics returns `source: "fixture"` until Person A's attack suite has
 * run. Badge that state honestly — never present targets as measurements.
 */
export default function Robustness() {
  return (
    <section>
      <Header title="Robustness" hint="C7" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
