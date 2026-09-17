import { Header, Panel } from './Assets.jsx';

/**
 * C6 — per-asset audit trail: who opened it, when, from which device.
 *
 * TODO(C):
 *   - asset picker -> getAudit(assetId)
 *   - one row per decryption, each linking to Etherscan in a new tab
 *   - keep the hashed userRef in the chain column and the real name in the
 *     registry column, visually separated and labelled
 */
export default function Timeline() {
  return (
    <section>
      <Header title="Audit timeline" hint="C6" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
