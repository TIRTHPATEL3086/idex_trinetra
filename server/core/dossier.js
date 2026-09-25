import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Forensic Examination Report — the court dossier for one investigation, on a
 * single A4 page, laid out the way an expert's report on electronic evidence
 * is filed:
 *
 *   letterhead · title · reference strip · title of the matter · finding
 *   I   particulars of the matter        II  on-chain receipt and signature
 *   III chain of custody (SHA-256)       IV  forensic analysis
 *   V   opinion of the examiner          VI  certificate under Section 63, BSA
 *   signatures, seal and the examiner's digital stamp
 *
 * A scales-of-justice seal marks the letterhead, and the Provenance seal the
 * signature block, and also sits large and faint behind the page as its
 * visible watermark (server/assets/dossier).
 *
 * Every value is the recorded one or says it is not recorded; a person is named
 * only when the verdict and the release record both support it.
 *
 * Letterhead lines come from DOSSIER_AUTHORITY ("|"-separated). An emblem is
 * printed only when the deploying authority supplies one through
 * EMBLEM_IMAGE_PATH: the State Emblem of India, and court emblems that carry
 * it, may be used only as the State Emblem of India (Prohibition of Improper
 * Use) Act, 2005 permits, so this project does not ship one.
 */

const A4 = [595.28, 841.89];

const INK = rgb(0.08, 0.09, 0.12);
const MUTED = rgb(0.36, 0.38, 0.44);
const RULE = rgb(0.72, 0.74, 0.78);
const SHADE = rgb(0.95, 0.95, 0.96);
// A court filing is printed and photocopied: the report is black on white,
// with emphasis carried by weight and rules rather than colour.
const NAVY = rgb(0, 0, 0);
const RED = rgb(0, 0, 0);
const GREEN = rgb(0, 0, 0);
const AMBER = rgb(0, 0, 0);

const NR = 'Not recorded';

/** The standard PDF fonts are WinAnsi; map the few typographic characters used. */
function t(v) {
  return String(v ?? '')
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/×/g, 'x')
    .replace(/[^ -~]/g, '');
}

function wrap(text, font, size, maxWidth) {
  const out = [];
  for (const para of t(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      let w = word;
      // Break unbroken strings (hashes) that are wider than the column.
      while (font.widthOfTextAtSize(w, size) > maxWidth) {
        let n = w.length;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > maxWidth) n--;
        if (line) out.push(line);
        out.push(w.slice(0, n));
        line = '';
        w = w.slice(n);
      }
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

const ist = (d) =>
  d
    ? `${new Date(d).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })} IST`
    : NR;

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'dossier');
const readAsset = (name) => {
  try {
    return fs.readFileSync(path.join(ASSETS, name));
  } catch {
    return null;
  }
};

/**
 * One A4 page. Every size is multiplied by `k`; if the content of a particular
 * case does not fit at full size, the page is laid out again a little smaller
 * until it does, so the report never runs onto a second page.
 */
export async function generateDossier(input) {
  for (const k of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]) {
    const out = await renderOnePage(input, k);
    if (out.fits || k === 0.7) return out.buffer;
  }
  return null; // unreachable
}

async function renderOnePage(
  {
    investigation,
    event,
    verdict,
    confidence,
    reasons = [],
    txHash,
    blockNumber,
    signatureCommit,
    signatureAlgorithm,
    chainMode = 'off',
    contractAddress = null,
    chainVerified = false,
    blockTimestamp = null,
    bitsMatched = null,
    tamper = null,
    lens = null,
    custody = null,
    examiner = null,
    stamp = null,
  },
  k
) {
  const doc = await PDFDocument.create();
  const F = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const page = doc.addPage(A4);
  const L = 30;
  const R = A4[0] - 30;
  const W = R - L;
  const BOTTOM = 48;
  let y = A4[1] - 30;
  const s = (v) => v * k;

  // ---- facts ---------------------------------------------------------------
  const invNo = `INV-${String(investigation?.id ?? 0).padStart(5, '0')}`;
  const reportNo = `PRV/FOR/${new Date().getFullYear()}/${invNo}`;
  const issuedAt = stamp?.evidence?.generatedAt || new Date().toISOString();
  const isAttributed = verdict === 'ATTRIBUTED';
  const isProbable = verdict === 'PROBABLE';
  const hasTarget = (isAttributed || isProbable) && Boolean(event?.user);
  const pct = Math.round(Number(confidence ?? 0) * 1000) / 10;
  const classification = event?.asset?.classification || 'RESTRICTED';
  const docTitle = event?.asset?.title;
  const authority = (
    process.env.DOSSIER_AUTHORITY ||
    'GOVERNMENT OF INDIA|MINISTRY OF DEFENCE|Weapons & Electronics Systems Engineering Establishment (WESEE)|Directorate of Forensic Cyber Intelligence'
  )
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
  const networkLabel =
    chainMode === 'sepolia'
      ? 'Ethereum Sepolia testnet (11155111)'
      : chainMode === 'local'
        ? 'Local Hardhat network (air-gapped)'
        : 'Chain disabled';
  const activeBlock =
    blockNumber ?? (event?.blockNumber != null ? Number(event.blockNumber) : null);
  const verdictColor = isAttributed ? GREEN : isProbable ? AMBER : MUTED;

  const text = (str, x, yy, size, font, color = INK) =>
    page.drawText(t(str), { x, y: yy, size, font, color });
  const centre = (str, yy, size, font, color = INK) =>
    text(str, (A4[0] - font.widthOfTextAtSize(t(str), size)) / 2, yy, size, font, color);

  // ---- visible watermark: the Provenance seal, large and faint --------------
  const wmBytes = readAsset('provenance-seal.png');
  if (wmBytes) {
    const wm = await doc.embedPng(wmBytes);
    const size = 400;
    page.drawImage(wm, {
      x: (A4[0] - size) / 2,
      y: (A4[1] - size) / 2 - 10,
      width: size,
      height: size,
      opacity: 0.08,
    });
  }

  // ---- classification marking + frame ---------------------------------------
  centre(classification, A4[1] - 20, 8, F.sansBold, RED);
  centre(classification, 14, 8, F.sansBold, RED);
  page.drawRectangle({
    x: 22,
    y: 24,
    width: A4[0] - 44,
    height: A4[1] - 50,
    borderColor: NAVY,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: 25,
    y: 27,
    width: A4[0] - 50,
    height: A4[1] - 56,
    borderColor: RULE,
    borderWidth: 0.4,
  });
  y -= 6;

  // ---- letterhead ------------------------------------------------------------
  const head = y;
  const sealBytes = readAsset('scales-seal.png');
  const emblemPath = process.env.EMBLEM_IMAGE_PATH;
  const sealSize = s(58);
  // The deploying authority's emblem, when it supplies one (see the header).
  let emblem = null;
  if (emblemPath && fs.existsSync(emblemPath)) {
    const b = fs.readFileSync(emblemPath);
    emblem = /\.png$/i.test(emblemPath) ? await doc.embedPng(b) : await doc.embedJpg(b);
    const w = (emblem.width / emblem.height) * sealSize;
    page.drawImage(emblem, { x: L + 6, y: head - sealSize, width: w, height: sealSize });
  }
  const seal = sealBytes ? await doc.embedPng(sealBytes) : null;
  if (seal) {
    page.drawImage(seal, {
      x: R - sealSize - 6,
      y: head - sealSize,
      width: sealSize,
      height: sealSize,
    });
    if (!(emblemPath && fs.existsSync(emblemPath))) {
      page.drawImage(seal, { x: L + 6, y: head - sealSize, width: sealSize, height: sealSize });
    }
  }
  authority.forEach((line, i) => {
    const size = s(i === 0 ? 12.5 : i === 1 ? 11 : 8.5);
    const f = i < 2 ? F.serifBold : F.serif;
    y -= size + s(3);
    centre(line, y, size, f, i < 2 ? INK : MUTED);
  });
  y = Math.min(y, head - sealSize) - s(8);
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1.3, color: NAVY });
  page.drawLine({
    start: { x: L, y: y - 2.5 },
    end: { x: R, y: y - 2.5 },
    thickness: 0.4,
    color: NAVY,
  });
  y -= s(20);
  centre('FORENSIC EXAMINATION REPORT', y, s(15), F.serifBold, NAVY);
  y -= s(12);
  centre(
    'Electronic record certified under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023',
    y,
    s(8.5),
    F.serifItalic,
    MUTED
  );
  y -= s(10);

  // ---- reference strip ---------------------------------------------------------
  const refH = s(16);
  page.drawRectangle({
    x: L,
    y: y - refH,
    width: W,
    height: refH,
    color: SHADE,
    borderColor: RULE,
    borderWidth: 0.5,
  });
  const refs = [
    `Report No. ${reportNo}`,
    `Date: ${ist(issuedAt)}`,
    `Examiner: ${examiner ? `${examiner.name} (${examiner.role})` : NR}`,
  ];
  refs.forEach((r, i) => text(r, L + 6 + (i * W) / 3, y - refH + s(5), s(7.2), F.sansBold, MUTED));
  y -= refH + s(8);

  // ---- matter -------------------------------------------------------------------
  const paraAt = (str, x, width, size, font, color = INK, lh = 1.3) => {
    for (const line of wrap(str, font, size, width)) {
      y -= size * lh;
      text(line, x, y, size, font, color);
    }
  };
  const mTop = y;
  y -= s(3);
  text('IN THE MATTER OF:', L + 8, y - s(9), s(8.5), F.serifBold);
  y -= s(9);
  paraAt(
    docTitle
      ? `Unauthorised disclosure of the protected document "${docTitle}" (${classification}), and forensic examination of the electronic record SHA-256 ${custody?.leakSha || NR} submitted in investigation ${invNo}.`
      : `Forensic examination of the electronic record SHA-256 ${custody?.leakSha || NR}, submitted in investigation ${invNo} as a possible leak of a protected document.`,
    L + 8,
    W - 16,
    s(8.5),
    F.serif
  );
  y -= s(5);
  page.drawRectangle({ x: L, y, width: W, height: mTop - y, borderColor: INK, borderWidth: 0.7 });
  y -= s(8);

  // ---- finding --------------------------------------------------------------------
  const fH = s(34);
  page.drawRectangle({
    x: L,
    y: y - fH,
    width: W,
    height: fH,
    color: SHADE,
    borderColor: verdictColor,
    borderWidth: 1.2,
  });
  text('FINDING', L + 14, y - s(11), s(7), F.sansBold, MUTED);
  text(`${verdict} - ${pct}% confidence`, L + 14, y - s(26), s(13), F.serifBold, verdictColor);
  const fNote = hasTarget
    ? `Attributed to the release made to ${event.user.name} (Account #${event.user.id}${event.user.dept ? `, ${event.user.dept}` : ''}).`
    : 'No person is identified by this examination.';
  const fNoteW = F.serif.widthOfTextAtSize(t(fNote), s(9));
  text(fNote, R - 10 - Math.min(fNoteW, W * 0.52), y - s(22), s(9), F.serif, INK);
  y -= fH + s(10);

  // ---- section helper ---------------------------------------------------------------
  const heading = (roman, title, x = L, w = W) => {
    const h = s(13);
    text(`${roman}.  ${title.toUpperCase()}`, x + 1, y - h + s(3.8), s(8.2), F.serifBold, INK);
    page.drawLine({
      start: { x, y: y - h },
      end: { x: x + w, y: y - h },
      thickness: 0.9,
      color: INK,
    });
    y -= h + s(4);
  };
  /** Key/value rows in a column; returns the bottom y. */
  const kv = (rows, x, w, labelW, { mono = [] } = {}) => {
    for (const [key, v] of rows) {
      const isMono = mono.includes(key);
      const vf = isMono ? F.mono : F.serif;
      const vs = s(isMono ? 6.6 : 7.8);
      const lines = wrap(v ?? NR, vf, vs, w - labelW - 6);
      const h = lines.length * vs * 1.25 + s(3.5);
      page.drawLine({
        start: { x, y: y - h },
        end: { x: x + w, y: y - h },
        thickness: 0.35,
        color: RULE,
      });
      text(key, x + 2, y - s(8.5), s(6.8), F.sansBold, MUTED);
      lines.forEach((line, i) =>
        text(line, x + labelW, y - s(8.5) - i * vs * 1.25, vs, vf, v ? INK : MUTED)
      );
      y -= h;
    }
    return y;
  };

  // ---- I & III side by side ----------------------------------------------------------
  const colW = (W - 12) / 2;
  const top2 = y;
  heading('I', 'Particulars of the matter', L, colW);
  const leftEnd = kv(
    hasTarget
      ? [
          ['Document', `${docTitle || NR} [${classification}]`],
          ['Recipient', `${event.user.name} - Account #${event.user.id}, ${event.user.role}`],
          ['Department', event.user.dept || NR],
          ['Released on', ist(event.createdAt)],
          ['Terminal', event.deviceLabel || NR],
          [
            'Receipt ID',
            event.receiptId ? `0x${Buffer.from(event.receiptId).toString('hex')}` : NR,
          ],
          [
            'Fidelity',
            event.psnrDb ? `${Number(event.psnrDb).toFixed(1)} dB PSNR vs original` : NR,
          ],
        ]
      : [
          ['Document', 'Not identified'],
          ['Recipient', 'None'],
          ['Reason', 'No release in the register is linked to this file by the evidence.'],
        ],
    L,
    colW,
    s(62),
    { mono: ['Receipt ID'] }
  );
  y = top2;
  heading('II', 'On-chain receipt & signature', L + colW + 12, colW);
  const rightEnd = kv(
    [
      ['Network', networkLabel],
      ['Contract', contractAddress],
      ['Tx hash', txHash || null],
      [
        'Block',
        activeBlock != null
          ? `#${activeBlock}${blockTimestamp ? ` - ${ist(blockTimestamp * 1000)}` : ''}`
          : null,
      ],
      [
        'Status',
        !event
          ? 'No release identified'
          : chainVerified
            ? 'Receipt verified on-chain'
            : 'NOT verified on-chain',
      ],
      [
        'Signature',
        signatureAlgorithm ? `${signatureAlgorithm} (NIST FIPS 204)` : 'No signature on record',
      ],
      ['Sig. commit', signatureCommit || null],
    ],
    L + colW + 12,
    colW,
    s(52),
    { mono: ['Contract', 'Tx hash', 'Sig. commit'] }
  );
  y = Math.min(leftEnd, rightEnd) - s(8);

  // ---- III custody -------------------------------------------------------------------
  heading('III', 'Chain of custody (SHA-256)');
  kv(
    [
      ['1. Original', custody?.originalSha || null],
      ['2. Released copy', custody?.releasedSha || null],
      ['3. Leaked file', custody?.leakSha || null],
      ['4. This report', custody?.evidenceDigest || null],
    ],
    L,
    W,
    s(82),
    { mono: ['1. Original', '2. Released copy', '3. Leaked file', '4. This report'] }
  );
  y -= s(8);

  // ---- IV analysis --------------------------------------------------------------------
  heading('IV', 'Forensic analysis');
  const obs = reasons.length ? reasons : ['No observations were recorded for this investigation.'];
  obs.slice(0, 7).forEach((r, i) => {
    const lines = wrap(r, F.serif, s(7.8), W - 16);
    lines.forEach((line, j) => {
      y -= s(7.8) * 1.28;
      if (j === 0) text(`${i + 1}.`, L + 2, y, s(7.8), F.serif);
      text(line, L + 14, y, s(7.8), F.serif);
    });
  });
  y -= s(4);
  const tamperText = !tamper
    ? 'Not applicable'
    : tamper.status === 'intact'
      ? 'INTACT - not altered since release'
      : tamper.status === 'tampered'
        ? `ALTERED - ${tamper.failed}/${tamper.blocks} blocks changed${
            tamper.regions?.length
              ? ` at (x,y,w,h) ${tamper.regions
                  .slice(0, 3)
                  .map((r) => `(${r.x},${r.y},${r.w},${r.h})`)
                  .join(' ')}`
              : ''
          }`
        : 'Not assessable (copy re-encoded or resized)';
  kv(
    [
      [
        'Watermark',
        bitsMatched != null
          ? `${bitsMatched}/48 bits agree with the identified receipt`
          : 'Not applicable',
      ],
      ['Tamper check', tamperText],
      [
        'Optical lens',
        lens?.applied
          ? `Applied (${lens.autoDetected ? 'auto' : 'examiner'} corners, ${lens.moirePeaks} moire peaks removed)`
          : 'Not applied',
      ],
    ],
    L,
    W,
    s(62)
  );
  y -= s(8);

  // ---- V opinion ------------------------------------------------------------------------
  heading('V', 'Opinion of the examiner');
  const opinion = hasTarget
    ? `The submitted file is a copy of "${docTitle}" released to ${event.user.name} on ${ist(event.createdAt)}. Finding: ${verdict}, ${pct}% confidence; the receipt ${chainVerified ? 'was verified on-chain' : 'could NOT be verified on-chain'}. ${
        tamper?.status === 'tampered'
          ? 'The copy was ALTERED after release in the regions stated; its contents there must not be relied on.'
          : tamper?.status === 'intact'
            ? 'Its contents are exactly as released.'
            : 'Whether its contents were altered cannot be determined from this copy.'
      } ${isProbable ? 'A PROBABLE finding is a lead and must be corroborated before action against any person.' : 'This concerns the provenance of the copy, not by itself who disclosed it or why.'}`
    : 'The submitted file is NOT attributed to any release in the register, and this report must not be relied on to identify any person.';
  paraAt(opinion, L + 2, W - 4, s(8), F.serif);
  y -= s(8);

  // ---- VI certificate ---------------------------------------------------------------------
  heading('VI', 'Certificate under Section 63, BSA, 2023');
  paraAt(
    `Part A: I certify that the electronic record in item 3 of Part III, and this report, were produced by the Provenance decryption-register system in its regular use; that the system was operating properly throughout; and that the SHA-256 digests above were computed by it at the stages stated.`,
    L + 2,
    W - 4,
    s(7.6),
    F.serif
  );
  paraAt(
    `Part B: I have examined that record with the system's forensic engine; Parts II and IV set out the evidence and Part V my opinion.${stamp ? ' I have signed the evidence digest (item 4) with my ML-DSA-65 key.' : ''}`,
    L + 2,
    W - 4,
    s(7.6),
    F.serif
  );
  y -= s(26);

  // Signatures and seal.
  const sigW = s(170);
  const sig = (x, role, who) => {
    page.drawLine({ start: { x, y }, end: { x: x + sigW, y }, thickness: 0.6, color: INK });
    text(role, x, y - s(9), s(7), F.sansBold, MUTED);
    text(who || 'Name & designation:', x, y - s(18), s(7.4), F.serif, who ? INK : MUTED);
  };
  sig(L + 2, 'Part A - Person in charge of the system', null);
  sig(R - sigW - 2, 'Part B - Expert', examiner ? `${examiner.name} (${examiner.role})` : null);
  // Centre of the signature block: the authority's emblem when supplied,
  // otherwise the project's own Provenance seal.
  const projectSealBytes = readAsset('provenance-seal.png');
  const projectSeal = projectSealBytes ? await doc.embedPng(projectSealBytes) : null;
  const centreMark = emblem || projectSeal || seal;
  if (centreMark) {
    const h = s(62);
    const w = (centreMark.width / centreMark.height) * h;
    page.drawImage(centreMark, {
      x: (A4[0] - w) / 2,
      y: y - h / 2 - s(4),
      width: w,
      height: h,
      opacity: 1,
    });
  }
  y -= s(40); // clear the seal before the stamp line
  if (stamp) {
    const stampLine = `Examiner's digital stamp: ML-DSA-65 over sha256:${stamp.digest} - signature sha256 ${stamp.signatureSha.slice(0, 24)}... - verify at /api/trace/${investigation?.id}/dossier/verify`;
    paraAt(stampLine, L + 2, W - 4, s(6.4), F.mono, MUTED, 1.25);
  }

  // Footer.
  const fits = y >= BOTTOM + 10;
  page.drawLine({ start: { x: L, y: 44 }, end: { x: R, y: 44 }, thickness: 0.5, color: RULE });
  text(`Forensic Examination Report - ${reportNo}`, L, 34, 6.8, F.sans, MUTED);
  const pn = 'Certified under Section 63, BSA, 2023 - Page 1 of 1';
  text(pn, R - F.sans.widthOfTextAtSize(pn, 6.8), 34, 6.8, F.sans, MUTED);

  return { fits, buffer: Buffer.from(await doc.save()) };
}
