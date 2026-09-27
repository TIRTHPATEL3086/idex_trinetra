/**
 * PDF releases made before PDFs were measured carry no PSNR. This measures
 * each of them once — the original is decrypted from escrow and its pages
 * compared with the stored released copy, exactly as a new release is — and
 * saves the figure, so the register shows a real number for every copy.
 *
 * Runs in the background after the server starts, one release at a time with
 * pauses between, so it never holds up requests; anything it cannot measure
 * (a missing file, a key that no longer opens) is left as it was.
 */
import { prisma } from './prisma.js';
import { readCipher, readMarked } from './files.js';
import { recoverContentKey } from './keyring.js';
import { decrypt as aesDecrypt } from '../core/crypto.js';
import { isPdf } from '../core/index.js';
import { pdfPsnr } from '../core/pdfpreview.js';

export async function backfillPdfPsnr(log = () => {}) {
  const events = await prisma.decryptionEvent.findMany({
    where: {
      psnrDb: { lte: 0 },
      asset: { mimeType: 'application/pdf' },
    },
    include: { asset: true },
    orderBy: { id: 'asc' },
  });
  if (!events.length) return 0;

  let done = 0;
  const originals = new Map(); // assetId -> plaintext, decrypted once
  for (const event of events) {
    // One release at a time, with a pause between, so a slow server keeps
    // answering people while this catches up.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      let original = originals.get(event.assetId);
      if (original === undefined) {
        const key = await recoverContentKey(event.assetId);
        const cipher = key ? await readCipher(event.asset) : null;
        original =
          key && cipher
            ? aesDecrypt(cipher, key, Buffer.from(event.asset.iv), Buffer.from(event.asset.authTag))
            : null;
        originals.set(event.assetId, original);
      }
      const copy = original ? await readMarked(event) : null;
      if (!copy || !isPdf(copy)) continue;
      const db = await pdfPsnr(original, copy);
      if (!Number.isFinite(db)) continue;
      await prisma.decryptionEvent.update({ where: { id: event.id }, data: { psnrDb: db } });
      done++;
    } catch {
      // Leave this one unmeasured; the rest still get their figure.
    }
  }
  log(`[psnr] measured ${done} of ${events.length} earlier PDF release(s)`);
  return done;
}
