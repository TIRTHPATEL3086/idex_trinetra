import { Header, Panel } from './Assets.jsx';

/**
 * Evidence that the watermark survives real-world damage.
 *
 * TODO: Recharts against getMetrics()
 *   - bar chart: eight attacks x bits recovered (out of 48), with target line
 *   - line chart: PSNR vs delta — the invisibility/robustness trade-off
 *
 * /api/metrics returns `source: "not-run"` and empty arrays until the attack
 * suite has been run. Render an empty state for that rather than placeholder
 * numbers — a chart of invented robustness figures is worse than no chart.
 */
export default function Robustness() {
  return (
    <section>
      <Header title="Robustness" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
