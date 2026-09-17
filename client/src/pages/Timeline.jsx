import { Header, Panel } from './Assets.jsx';

/**
 * Per-asset audit trail: who opened a document, when, and from which device.
 *
 * TODO:
 *   - asset picker -> getAudit(assetId)
 *   - one row per decryption, each linking to Etherscan in a new tab
 *   - keep the hashed userRef in the chain column and the real name in the
 *     registry column, visually separated and labelled
 */
export default function Timeline() {
  return (
    <section>
      <Header title="Audit timeline" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
