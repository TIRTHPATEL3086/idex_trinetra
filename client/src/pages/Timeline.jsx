import { Header, Notice } from './Assets.jsx';

/**
 * Per-asset audit trail: who opened a document, when, and from which device.
 *
 * TODO:
 *   - asset picker -> getAudit(assetId)
 *   - one row per decryption, each linking to Etherscan in a new tab
 *   - hashed userRef in the chain column, real name in the registry column
 */
export default function Timeline() {
  return (
    <section className="space-y-6">
      <Header
        title="Audit timeline"
        subtitle="Every decryption of a document, in order — who, when, from which device, and the transaction that proves it."
      />
      <Notice>This screen is under construction.</Notice>
    </section>
  );
}
