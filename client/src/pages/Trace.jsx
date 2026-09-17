import { Header, Notice } from './Assets.jsx';

/**
 * Upload a leaked file and show what the register can say about it.
 *
 * TODO:
 *   - dropzone -> traceFile(file)
 *   - verdict card colour-coded emerald / amber / slate. Never red.
 *   - confidence figure with reasons[] as a bulleted list. When match === null,
 *     the inconclusive state must look as finished as the attributed one.
 */
export default function Trace() {
  return (
    <section className="space-y-6">
      <Header
        title="Trace a leaked file"
        subtitle="The watermark says which receipt; the perceptual hashes say which file; the chain confirms both. The result is a confidence band, never a bare accusation."
      />
      <Notice>This screen is under construction.</Notice>
    </section>
  );
}
