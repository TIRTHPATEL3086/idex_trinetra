import { Header, Panel } from './Assets.jsx';

/**
 * Upload a leaked file and show what the register can say about it.
 *
 * TODO:
 *   - dropzone -> traceFile(file)
 *   - progress text for the real steps: hashing, searching the register,
 *     extracting the watermark, cross-checking the chain
 *   - verdict card colour-coded emerald / amber / slate. Never red: the system
 *     reports a likelihood, it does not accuse anyone.
 *   - confidence figure with reasons[] as a bulleted list underneath. The
 *     sentences are what make a score reviewable; a bare percentage is not.
 *   - when match === null, the inconclusive state must look as finished as the
 *     attributed one. Reporting "not known" confidently is a feature.
 */
export default function Trace() {
  return (
    <section>
      <Header title="Trace a leaked file" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
