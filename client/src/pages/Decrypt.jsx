import { Header, Panel } from './Assets.jsx';

/**
 * Pick a document, an officer and a device, then release a watermarked copy.
 *
 * TODO:
 *   - selects populated from getAssets() and getUsers()
 *   - decryptAsset({ assetId, userId, deviceLabel })
 *   - receipt card with a prominent Etherscan link (target="_blank"),
 *     the PSNR value, and a download link for the marked file
 *   - loading state with words, not a bare spinner — embedding takes seconds:
 *       "Embedding invisible mark (Haar DWT, delta=12)…"
 *   - split the receipt into two labelled groups:
 *       "On-chain (hashed)" -> receiptId, userRef, txHash
 *       "Internal registry" -> officer name, department, device
 *     Never render a real name inside the on-chain group.
 *   - before/after comparison once a decrypt succeeds, captioned with the PSNR
 */
export default function Decrypt() {
  return (
    <section>
      <Header title="Decrypt a document" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
