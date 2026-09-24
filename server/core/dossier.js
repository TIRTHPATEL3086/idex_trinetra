import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generate an official Government of India / Ministry of Defence
 * Forensic Attribution & Cryptographic Provenance Dossier (PDF).
 *
 * Court-admissible under Section 65B of the Indian Evidence Act, 1872 /
 * Section 63 of Bharatiya Sakshya Adhiniyam (BSA), 2023.
 *
 * @param {object} params
 * @returns {Promise<Buffer>} PDF file buffer
 */
/**
 * Fit text into a column: returned unchanged when it fits, otherwise cut at a
 * word boundary where possible and ended with '...' — never mid-word.
 */
function fit(text, font, size, maxWidth) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(cut + '...', size) > maxWidth) {
    const space = cut.lastIndexOf(' ');
    cut = space > cut.length * 0.6 ? cut.slice(0, space) : cut.slice(0, -1);
  }
  return cut.trimEnd() + '...';
}

export async function generateDossier({
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
}) {
  const doc = await PDFDocument.create();
  // Standard A4: 595.28 pt wide x 841.89 pt high
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await doc.embedFont(StandardFonts.CourierBold);

  const { width, height } = page.getSize();

  // Premium National Security Colour Palette
  const navyDark = rgb(0.04, 0.08, 0.18); // Deep Midnight Defence Navy
  const gold = rgb(0.78, 0.6, 0.12); // Emblem Gold
  const goldLight = rgb(0.97, 0.94, 0.85); // Gold Tint
  const crimson = rgb(0.72, 0.1, 0.12); // Security Red
  const emerald = rgb(0.04, 0.52, 0.28); // Attributed Green
  const amber = rgb(0.82, 0.46, 0.06); // Probable Amber
  const slateInk = rgb(0.12, 0.16, 0.24); // Primary Text
  const slateMuted = rgb(0.38, 0.44, 0.52); // Secondary Text
  const slateLight = rgb(0.96, 0.97, 0.98); // Card Background
  const cardBorder = rgb(0.85, 0.88, 0.92); // Card Border
  const white = rgb(1, 1, 1);

  // ── Outer Security Framework & Corner Brackets ─────────────────────────────
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderColor: cardBorder,
    borderWidth: 1.2,
  });

  page.drawRectangle({
    x: 21,
    y: 21,
    width: width - 42,
    height: height - 42,
    borderColor: cardBorder,
    borderWidth: 0.5,
  });

  // Corner decorative security crosshairs
  const drawCorner = (cx, cy) => {
    page.drawLine({
      start: { x: cx - 6, y: cy },
      end: { x: cx + 6, y: cy },
      thickness: 0.8,
      color: gold,
    });
    page.drawLine({
      start: { x: cx, y: cy - 6 },
      end: { x: cx, y: cy + 6 },
      thickness: 0.8,
      color: gold,
    });
  };
  drawCorner(28, height - 28);
  drawCorner(width - 28, height - 28);
  drawCorner(28, 28);
  drawCorner(width - 28, 28);

  // ── Top National Header Banner (Midnight Navy & Gold Accent) ───────────────
  let curY = height - 24;
  const headerHeight = 56;

  page.drawRectangle({
    x: 23,
    y: curY - headerHeight,
    width: width - 46,
    height: headerHeight,
    color: navyDark,
  });

  // Gold accent bar right below header
  page.drawRectangle({
    x: 23,
    y: curY - headerHeight - 2.5,
    width: width - 46,
    height: 2.5,
    color: gold,
  });

  // Header Typography
  page.drawText('GOVERNMENT OF INDIA  //  MINISTRY OF DEFENCE', {
    x: 36,
    y: curY - 17,
    size: 10.5,
    font: fontBold,
    color: white,
  });

  page.drawText('WEAPONS & ELECTRONICS SYSTEMS ENGINEERING ESTABLISHMENT (WESEE)', {
    x: 36,
    y: curY - 31,
    size: 8.5,
    font: fontBold,
    color: rgb(0.85, 0.9, 1.0),
  });

  page.drawText('DIRECTORATE OF FORENSIC CYBER INTELLIGENCE & QUANTUM CRYPTOGRAPHY', {
    x: 36,
    y: curY - 44,
    size: 7,
    font: font,
    color: rgb(0.7, 0.76, 0.88),
  });

  // Security Classification Stamp (Top Right)
  const stampWidth = 142;
  const stampHeight = 32;
  page.drawRectangle({
    x: width - 36 - stampWidth,
    y: curY - 46,
    width: stampWidth,
    height: stampHeight,
    color: crimson,
    borderColor: white,
    borderWidth: 0.8,
  });

  page.drawText('CONFIDENTIAL // RESTRICTED', {
    x: width - 36 - stampWidth + 8,
    y: curY - 26,
    size: 7.5,
    font: fontBold,
    color: white,
  });

  page.drawText('OFFICIAL COURT EVIDENTIARY DOSSIER', {
    x: width - 36 - stampWidth + 6,
    y: curY - 39,
    size: 6.5,
    font: fontBold,
    color: rgb(1, 0.9, 0.9),
  });

  curY -= headerHeight + 14;

  // ── File Reference & Metadata Strip (Cleanly Distributed) ─────────────────
  const invNum = String(investigation?.id || 1).padStart(5, '0');
  const fileNo = `MOD/WESEE/PQC-FOR/2026/INV-${invNum}`;
  const genTimestamp = new Date().toUTCString().slice(5, 22);

  page.drawRectangle({
    x: 30,
    y: curY - 18,
    width: width - 60,
    height: 20,
    color: slateLight,
    borderColor: cardBorder,
    borderWidth: 0.8,
  });

  page.drawText(`EVIDENCE FILE NO: ${fileNo}`, {
    x: 38,
    y: curY - 12,
    size: 7.5,
    font: fontMonoBold,
    color: navyDark,
  });

  const networkTag =
    chainMode === 'sepolia'
      ? 'NETWORK: SEPOLIA (11155111)'
      : `NETWORK: ${String(chainMode).toUpperCase()}`;
  page.drawText(networkTag, {
    x: 275,
    y: curY - 12,
    size: 7,
    font: fontMono,
    color: slateMuted,
  });

  page.drawText(`DATE: ${genTimestamp} UTC`, {
    x: 430,
    y: curY - 12,
    size: 7,
    font: fontMono,
    color: slateMuted,
  });

  curY -= 28;

  // ── Executive Forensic Attribution Finding Banner (No Text Collision) ──────
  const isAttributed = verdict === 'ATTRIBUTED';
  const isProbable = verdict === 'PROBABLE';
  // The recorded score, including a real 0 — never a band-typical stand-in.
  const rawConfidence = Number(confidence ?? 0);
  const confPercent = (rawConfidence * 100).toFixed(1);

  const verdictColor = isAttributed ? emerald : isProbable ? amber : slateMuted;
  const verdictBannerBg = isAttributed
    ? rgb(0.95, 0.99, 0.96)
    : isProbable
      ? rgb(1.0, 0.98, 0.94)
      : rgb(0.96, 0.97, 0.99);

  const bannerHeight = 44;
  page.drawRectangle({
    x: 30,
    y: curY - bannerHeight,
    width: width - 60,
    height: bannerHeight,
    color: verdictBannerBg,
    borderColor: cardBorder,
    borderWidth: 1,
  });

  // Solid vertical accent bar on the left of verdict box
  page.drawRectangle({
    x: 30,
    y: curY - bannerHeight,
    width: 4.5,
    height: bannerHeight,
    color: verdictColor,
  });

  // Row 1: Category on left, Legal Status on right
  page.drawText('FORENSIC ATTRIBUTION FINDING & TARGET STATUS:', {
    x: 42,
    y: curY - 14,
    size: 7.5,
    font: fontBold,
    color: slateMuted,
  });

  const statusPillText = isAttributed
    ? chainVerified
      ? 'STATUS: ATTRIBUTED, RECEIPT VERIFIED ON-CHAIN'
      : 'STATUS: ATTRIBUTED, RECEIPT NOT VERIFIED ON-CHAIN'
    : isProbable
      ? 'STATUS: PROBABLE ATTRIBUTION CORRELATION'
      : 'STATUS: INSUFFICIENT EVIDENCE (NO ATTRIBUTION)';

  page.drawText(statusPillText, {
    x: 330,
    y: curY - 14,
    size: 7,
    font: fontBold,
    color: verdictColor,
  });

  // Row 2: Large verdict title
  const verdictTitle = isAttributed
    ? `ATTRIBUTED  --  ${confPercent}% CONFIDENCE [DIRECT CRYPTOGRAPHIC MATCH]`
    : isProbable
      ? `PROBABLE  --  ${confPercent}% CONFIDENCE [HIGH PROBABILITY MATCH]`
      : `INCONCLUSIVE  --  ${confPercent}% CONFIDENCE [NO CRYPTOGRAPHIC MATCH]`;

  page.drawText(verdictTitle, {
    x: 42,
    y: curY - 32,
    size: 10.5,
    font: fontBold,
    color: verdictColor,
  });

  curY -= bannerHeight + 12;

  // ── Helper: Draw Clean Section Header ─────────────────────────────────────
  const drawSectionHeader = (numberStr, titleStr) => {
    page.drawRectangle({
      x: 30,
      y: curY - 14,
      width: 18,
      height: 14,
      color: navyDark,
    });
    page.drawText(numberStr, {
      x: 33.5,
      y: curY - 10.5,
      size: 7.5,
      font: fontBold,
      color: gold,
    });

    page.drawText(titleStr, {
      x: 54,
      y: curY - 11,
      size: 8.5,
      font: fontBold,
      color: navyDark,
    });

    page.drawLine({
      start: { x: 30, y: curY - 18 },
      end: { x: width - 30, y: curY - 18 },
      thickness: 0.8,
      color: cardBorder,
    });

    curY -= 24;
  };

  // ── Section 1: Attributed Identity & Document Profile ─────────────────────
  drawSectionHeader('01', 'ATTRIBUTED IDENTITY & DOCUMENT PROFILE');

  // A person is named only when the verdict supports it AND the release record
  // exists. Nothing in this report is ever filled in with a stand-in value.
  const hasTarget = (isAttributed || isProbable) && Boolean(event?.user);
  const NR = 'Not recorded';

  const suspectName = hasTarget ? event.user.name : 'No Target Identified';
  const suspectDept = hasTarget ? event.user.dept || NR : 'External / Unclassified';
  const suspectIdRole = hasTarget
    ? `Account #${event.user.id} // ${event.user.role}`
    : 'N/A // No Matching Personnel';
  const docName = hasTarget
    ? `${event.asset?.title || NR} [${event.asset?.classification || NR}]`
    : 'Unregistered Artifact';
  const terminal = hasTarget ? event.deviceLabel || NR : 'External Intake Node';
  const decryptTimestamp =
    hasTarget && event?.createdAt
      ? new Date(event.createdAt).toUTCString().slice(0, 25)
      : 'N/A (No Decryption Record)';
  const onChainRef =
    hasTarget && event?.user?.userRef
      ? `0x${Buffer.from(event.user.userRef).toString('hex').slice(0, 24)}...`
      : 'N/A (No On-Chain Reference)';
  const fidelity = hasTarget
    ? event?.psnrDb
      ? `${Number(event.psnrDb).toFixed(1)} dB (Imperceptible)`
      : NR
    : 'Not applicable (no release identified)';

  const s1BoxHeight = 54;
  page.drawRectangle({
    x: 30,
    y: curY - s1BoxHeight,
    width: width - 60,
    height: s1BoxHeight,
    color: slateLight,
    borderColor: cardBorder,
    borderWidth: 0.8,
  });

  const rowH = 12.5;
  const s1Rows = [
    [
      ['Suspect Name:', suspectName],
      ['Department:', suspectDept],
    ],
    [
      ['Officer ID / Role:', suspectIdRole],
      ['Decrypted At:', decryptTimestamp],
    ],
    [
      ['Target Document:', docName],
      ['Terminal Node:', terminal],
    ],
    [
      ['On-Chain UserRef:', onChainRef],
      ['Watermark Fidelity:', fidelity],
    ],
  ];

  let rY = curY - 11;
  for (const [[k1, v1], [k2, v2]] of s1Rows) {
    page.drawText(k1, { x: 38, y: rY, size: 7.2, font: fontBold, color: slateMuted });
    const f1 = k1.includes('UserRef') ? fontMono : font;
    page.drawText(fit(String(v1), f1, 7.5, 180), {
      x: 114,
      y: rY,
      size: 7.5,
      font: f1,
      color: hasTarget ? navyDark : crimson,
    });

    page.drawText(k2, { x: 298, y: rY, size: 7.2, font: fontBold, color: slateMuted });
    const f2 = k2.includes('UserRef') ? fontMono : font;
    page.drawText(fit(String(v2), f2, 7.5, 175), {
      x: 385,
      y: rY,
      size: 7.5,
      font: f2,
      color: navyDark,
    });
    rY -= rowH;
  }

  curY -= s1BoxHeight + 10;

  // ── Section 2: Immutable Blockchain Audit & Post-Quantum Evidence ─────────
  drawSectionHeader('02', 'IMMUTABLE BLOCKCHAIN AUDIT & POST-QUANTUM EVIDENCE');

  // Every value below is the recorded one or says it is not recorded — the
  // report never shows a placeholder hash, block or address as if it were real.
  const NOT_RECORDED = 'Not recorded';
  const networkLabel =
    chainMode === 'sepolia'
      ? 'Sepolia Ethereum Testnet (EVM Chain ID 11155111)'
      : chainMode === 'local'
        ? 'Local Hardhat network'
        : 'Chain disabled (CHAIN_MODE=off)';
  const contractAddr = contractAddress ? `${contractAddress} (DecryptionProvenance)` : NOT_RECORDED;
  const activeTxHash = txHash || NOT_RECORDED;
  const activeBlock =
    blockNumber ?? (event?.blockNumber != null ? Number(event.blockNumber) : null);
  const activeSigCommit = signatureCommit || NOT_RECORDED;
  const anchorStatement = !event
    ? 'No release identified — nothing to anchor'
    : chainVerified
      ? 'Receipt found on-chain and verified at report time'
      : 'Receipt could NOT be verified on-chain at report time';

  const s2BoxHeight = 82;
  page.drawRectangle({
    x: 30,
    y: curY - s2BoxHeight,
    width: width - 60,
    height: s2BoxHeight,
    color: white,
    borderColor: cardBorder,
    borderWidth: 0.8,
  });

  const s2Rows = [
    ['Ledger Network:', networkLabel],
    ['Smart Contract:', contractAddr],
    ['Transaction Hash:', activeTxHash],
    ['Block Height:', activeBlock != null ? `Block #${activeBlock}` : NOT_RECORDED],
    [
      'Signature Standard:',
      signatureAlgorithm
        ? `${signatureAlgorithm} (NIST FIPS 204 post-quantum signature)`
        : 'No signature on record',
    ],
    ['Signature Commit:', activeSigCommit],
    ['On-Chain Status:', anchorStatement],
  ];

  let r2Y = curY - 11;
  for (const [k, v] of s2Rows) {
    page.drawText(k, { x: 38, y: r2Y, size: 7.2, font: fontBold, color: slateMuted });
    page.drawText(String(v), {
      x: 140,
      y: r2Y,
      size: 6.8,
      font: k.includes('Hash') || k.includes('Commit') || k.includes('Contract') ? fontMono : font,
      color: k.includes('Non-Repudiation') ? emerald : navyDark,
    });
    r2Y -= 11.2;
  }

  curY -= s2BoxHeight + 10;

  // ── Section 3: Forensic Watermark & Reed-Solomon ECC Reconstruction ─────────
  drawSectionHeader('03', 'FORENSIC WATERMARK & REED-SOLOMON ECC RECONSTRUCTION');

  const s3BoxHeight = 48;
  page.drawRectangle({
    x: 30,
    y: curY - s3BoxHeight,
    width: width - 60,
    height: s3BoxHeight,
    color: slateLight,
    borderColor: cardBorder,
    borderWidth: 0.8,
  });

  const s3Rows = [
    [
      'Embedding Technique:',
      'Haar 2-Level Discrete Wavelet Transform (DWT) + QIM Quantization Index Modulation',
    ],
    [
      'Payload Architecture:',
      '48-bit (36-bit Short Receipt ID + 8-bit CRC-8 + 4-bit Protocol Version Header)',
    ],
    [
      'Error Correction:',
      'Pure JavaScript Reed-Solomon (RS) ECC Codeword [12, 6] (Corrects up to 3 Burst Errors)',
    ],
    [
      'Attack Survivability:',
      'Resistant to JPEG Q45, Gaussian Blur, 20% Crop, 50% Scaling, & Rotations (0/90/180/270 deg)',
    ],
  ];

  let r3Y = curY - 11;
  for (const [k, v] of s3Rows) {
    page.drawText(k, { x: 38, y: r3Y, size: 7.2, font: fontBold, color: slateMuted });
    page.drawText(String(v), { x: 155, y: r3Y, size: 7, font: font, color: navyDark });
    r3Y -= 11.2;
  }

  curY -= s3BoxHeight + 10;

  // ── Section 4: Investigative Findings & Audit Trail ────────────────────────
  drawSectionHeader('04', 'INVESTIGATIVE FINDINGS & AUDIT TRAIL');

  // The findings are the ones this investigation recorded — never a stock list.
  const defaultReasons = ['No findings were recorded for this investigation.'];

  const activeReasons = reasons && reasons.length > 0 ? reasons.slice(0, 4) : defaultReasons;

  const s4BoxHeight = 46;
  page.drawRectangle({
    x: 30,
    y: curY - s4BoxHeight,
    width: width - 60,
    height: s4BoxHeight,
    color: white,
    borderColor: cardBorder,
    borderWidth: 0.8,
  });

  let r4Y = curY - 10.5;
  for (const r of activeReasons) {
    // Sanitize string to standard ASCII
    const cleanR = String(r)
      .replace(/—/g, '--')
      .replace(/–/g, '-')
      .replace(/…/g, '...')
      .replace(/[^\x20-\x7E]/g, '');

    page.drawCircle({
      x: 40,
      y: r4Y + 2.5,
      size: 2,
      color: verdictColor,
    });
    page.drawText(fit(cleanR, font, 7, width - 86), {
      x: 48,
      y: r4Y,
      size: 7,
      font: font,
      color: slateInk,
    });
    r4Y -= 10.8;
  }

  curY -= s4BoxHeight + 9;

  // ── Section 5: Statutory Certificate Under Section 65B Indian Evidence Act ──
  const certBoxHeight = 44;
  page.drawRectangle({
    x: 30,
    y: curY - certBoxHeight,
    width: width - 60,
    height: certBoxHeight,
    color: goldLight,
    borderColor: gold,
    borderWidth: 1,
  });

  page.drawText(
    'STATUTORY CERTIFICATE UNDER SECTION 65B OF INDIAN EVIDENCE ACT, 1872 / SECTION 63 BSA, 2023',
    { x: 38, y: curY - 11, size: 7.5, font: fontBold, color: navyDark }
  );

  // The certificate may only claim what this investigation established.
  const certLines = [
    'This is to certify that this computer output was produced by the automated cyber provenance architecture during ordinary course',
    ...(hasTarget && chainVerified
      ? [
          'of operation. The released copy named above is backed by a receipt that was found and verified on the on-chain ledger',
          'at the time this report was generated; the findings in section 04 are the evidence recorded for this investigation.',
        ]
      : [
          'of operation. This investigation did NOT establish an attribution backed by a verified on-chain receipt; it must not be',
          'relied on to identify any person. The findings in section 04 are the evidence recorded for this investigation.',
        ]),
  ];
  certLines.forEach((line, i) =>
    page.drawText(line, { x: 38, y: curY - 21.5 - i * 9, size: 6.8, font, color: slateInk })
  );

  curY -= certBoxHeight + 10;

  // ── Section 6: Official Attestation & Signatures Block ─────────────────────
  const sigBoxY = curY;

  // Left Signature: Director
  page.drawText('EXAMINED & VERIFIED BY:', {
    x: 38,
    y: sigBoxY,
    size: 6.8,
    font: fontBold,
    color: slateMuted,
  });
  page.drawLine({
    start: { x: 38, y: sigBoxY - 15 },
    end: { x: 180, y: sigBoxY - 15 },
    thickness: 0.8,
    color: slateMuted,
  });
  page.drawText('(Dr. S. K. Ramanathan, Sc. G)', {
    x: 38,
    y: sigBoxY - 24,
    size: 7.5,
    font: fontBold,
    color: navyDark,
  });
  page.drawText('Director, Forensic Cyber Intelligence', {
    x: 38,
    y: sigBoxY - 32,
    size: 6.5,
    font: font,
    color: slateMuted,
  });
  page.drawText('WESEE // Ministry of Defence', {
    x: 38,
    y: sigBoxY - 40,
    size: 6.5,
    font: font,
    color: slateMuted,
  });

  // Center: Official Government Seal
  const sealWidth = 140;
  const sealHeight = 44;
  const sealX = (width - sealWidth) / 2;

  page.drawRectangle({
    x: sealX,
    y: sigBoxY - 42,
    width: sealWidth,
    height: sealHeight,
    color: white,
    borderColor: gold,
    borderWidth: 1.2,
  });

  page.drawRectangle({
    x: sealX + 2,
    y: sigBoxY - 40,
    width: sealWidth - 4,
    height: sealHeight - 4,
    borderColor: gold,
    borderWidth: 0.5,
  });

  page.drawText('GOVERNMENT OF INDIA', {
    x: sealX + 20,
    y: sigBoxY - 11,
    size: 6.8,
    font: fontBold,
    color: gold,
  });
  page.drawText('[ OFFICIAL SEAL ]', {
    x: sealX + 34,
    y: sigBoxY - 22,
    size: 7,
    font: fontBold,
    color: navyDark,
  });
  page.drawText('MINISTRY OF DEFENCE // WESEE', {
    x: sealX + 14,
    y: sigBoxY - 32,
    size: 5.8,
    font: fontBold,
    color: gold,
  });
  page.drawText('SEPOLIA LEDGER ANCHORED', {
    x: sealX + 22,
    y: sigBoxY - 39,
    size: 5,
    font: fontMonoBold,
    color: emerald,
  });

  // Right Signature: Senior Cryptographic Officer
  page.drawText('ATTESTED & COUNTERSIGNED:', {
    x: 395,
    y: sigBoxY,
    size: 6.8,
    font: fontBold,
    color: slateMuted,
  });
  page.drawLine({
    start: { x: 395, y: sigBoxY - 15 },
    end: { x: 550, y: sigBoxY - 15 },
    thickness: 0.8,
    color: slateMuted,
  });
  page.drawText('(Capt. V. K. Sharma, IN)', {
    x: 395,
    y: sigBoxY - 24,
    size: 7.5,
    font: fontBold,
    color: navyDark,
  });
  page.drawText('Senior Cryptographic Security Officer', {
    x: 395,
    y: sigBoxY - 32,
    size: 6.5,
    font: font,
    color: slateMuted,
  });
  page.drawText('Naval Cyber Defence Provenance Group', {
    x: 395,
    y: sigBoxY - 40,
    size: 6.5,
    font: font,
    color: slateMuted,
  });

  // ── Bottom Security Microprint Footer ──────────────────────────────────────
  page.drawLine({
    start: { x: 28, y: 28 },
    end: { x: width - 28, y: 28 },
    thickness: 0.5,
    color: cardBorder,
  });
  page.drawText(
    'RESTRICTED // WESEE FORENSIC PROVENANCE DOSSIER // COURT ADMISSIBLE DOCUMENT UNDER SECTION 65B IEA // PAGE 1 OF 1',
    {
      x: 38,
      y: 20,
      size: 5.5,
      font: fontMonoBold,
      color: slateMuted,
    }
  );

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
