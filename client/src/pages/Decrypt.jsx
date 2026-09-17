import { Header, Panel } from './Assets.jsx';

/**
 * C3 — pick asset + officer + device, hit Decrypt, render the receipt card.
 *
 * TODO(C):
 *   - dropdowns from getAssets() and getUsers()
 *   - decryptAsset({ assetId, userId, deviceLabel })
 *   - receipt card with a PROMINENT Etherscan link (target="_blank") — the
 *     jury will click it
 *   - PSNR value + download link for the marked file
 *   - loading copy with words, never a bare spinner:
 *       "Embedding invisible mark (Haar DWT, Δ=12)…"
 *   - split the card into two labelled panels:
 *       "On-chain (hashed)"   -> receiptId, userRef, txHash
 *       "Internal registry"   -> officer name, department, device
 *     Never render a real name next to a blockchain field (§7.2 rule 5).
 *
 * C4 (before/after slider) also lives on this screen once a decrypt succeeds.
 */
export default function Decrypt() {
  return (
    <section>
      <Header title="Decrypt a document" hint="C3" />
      <Panel title="">Not built yet — see the TODO block in this file.</Panel>
    </section>
  );
}
