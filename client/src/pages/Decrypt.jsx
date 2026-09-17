import { Header, Notice } from './Assets.jsx';

/**
 * Pick a document, an officer and a device, then release a watermarked copy.
 *
 * TODO:
 *   - selects populated from getAssets() and getUsers()
 *   - decryptAsset({ assetId, userId, deviceLabel })
 *   - receipt card with a prominent Etherscan link, PSNR value, download link
 *   - split the receipt into two labelled groups:
 *       "On-chain (hashed)" -> receiptId, userRef, txHash
 *       "Internal registry" -> officer name, department, device
 *     Never render a real name inside the on-chain group.
 */
export default function Decrypt() {
  return (
    <section className="space-y-6">
      <Header
        title="Decrypt a document"
        subtitle="Releasing a copy writes an immutable receipt on-chain, then embeds an invisible watermark before the file leaves the system."
      />
      <Notice>This screen is under construction.</Notice>
    </section>
  );
}
