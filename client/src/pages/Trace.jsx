import { Header, Panel } from './Assets.jsx';

/**
 * C5 — drop a leaked file, watch the analysis, read the verdict.
 * THE MOST IMPORTANT SCREEN IN THE DEMO.
 *
 * TODO(C):
 *   - dropzone -> traceFile(file)
 *   - analysis animation with real step text (hashing → searching register →
 *     extracting watermark → cross-checking chain)
 *   - verdict card, colour-coded: ATTRIBUTED emerald / PROBABLE amber /
 *     INCONCLUSIVE slate. NEVER red — we are not accusing anyone.
 *   - confidence ring + reasons[] as a bulleted list underneath. Explainability
 *     beats a bare percentage; the jury reads the sentences.
 *   - when match === null, render the INCONCLUSIVE state just as polished as
 *     the ATTRIBUTED one, with the line: "System guess nahi karta."
 *     This is step 7 of the demo and it is what separates a team that
 *     understands forensic responsibility from one that built a matcher.
 *   - dev switch calling traceFile(file, 'probable' | 'inconclusive') so all
 *     three states can be built before the real pipeline exists.
 */
export default function Trace() {
  return (
    <section>
      <Header title="Trace a leaked file" hint="C5" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
