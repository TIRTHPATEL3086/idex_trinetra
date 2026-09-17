import { Header, Notice } from './Assets.jsx';

/**
 * Evidence that the watermark survives real-world damage.
 *
 * TODO: Recharts against getMetrics()
 *   - bar chart: eight attacks x bits recovered (out of 48), with target line
 *   - line chart: PSNR vs delta — the invisibility/robustness trade-off
 *   /api/metrics returns source:"not-run" until the attack suite has run.
 */
export default function Robustness() {
  return (
    <section className="space-y-6">
      <Header
        title="Robustness"
        subtitle="How many of the 48 watermark bits survive JPEG compression, resizing, cropping and screenshots — and the invisibility trade-off behind the chosen strength."
      />
      <Notice>Run the attack suite to populate this screen.</Notice>
    </section>
  );
}
