/**
 * Contract tests — `npm run chain:test`.
 * These must pass before the contract is deployed anywhere.
 */
const { expect } = require('chai');
const { ethers } = require('hardhat');

const id = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe('DecryptionProvenance', function () {
  let contract, admin, logger, outsider;

  beforeEach(async function () {
    [admin, logger, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('DecryptionProvenance');
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it('grants admin and logger roles to the deployer', async function () {
    const LOGGER_ROLE = await contract.LOGGER_ROLE();
    expect(await contract.hasRole(LOGGER_ROLE, admin.address)).to.equal(true);
  });

  it('stores a receipt and emits DecryptionLogged', async function () {
    const receiptId = id('receipt-1');
    const assetRef = id('asset-12');
    const userRef = id('user-17');
    const contentSha = id('content');
    const payloadCommit = id('payload');

    await expect(contract.logDecryption(receiptId, assetRef, userRef, contentSha, payloadCommit))
      .to.emit(contract, 'DecryptionLogged')
      .withArgs(receiptId, assetRef, userRef, contentSha, payloadCommit, anyUint64);

    const r = await contract.getReceipt(receiptId);
    expect(r.assetRef).to.equal(assetRef);
    expect(r.userRef).to.equal(userRef);
    expect(r.contentSha).to.equal(contentSha);
    expect(r.payloadCommit).to.equal(payloadCommit);
    expect(r.exists).to.equal(true);
    expect(await contract.totalReceipts()).to.equal(1n);
  });

  it('refuses a duplicate receiptId', async function () {
    const receiptId = id('receipt-dup');
    await contract.logDecryption(receiptId, id('a'), id('u'), id('c'), id('p'));
    await expect(
      contract.logDecryption(receiptId, id('a'), id('u'), id('c'), id('p'))
    ).to.be.revertedWithCustomError(contract, 'ReceiptExists');
  });

  it('refuses a zero receiptId', async function () {
    await expect(
      contract.logDecryption(ethers.ZeroHash, id('a'), id('u'), id('c'), id('p'))
    ).to.be.revertedWithCustomError(contract, 'ZeroReceiptId');
  });

  it('rejects writes from an address without LOGGER_ROLE', async function () {
    await expect(
      contract.connect(outsider).logDecryption(id('r2'), id('a'), id('u'), id('c'), id('p'))
    ).to.be.reverted;
  });

  it('lets an admin grant LOGGER_ROLE to the backend wallet', async function () {
    await contract.grantLogger(logger.address);
    await expect(
      contract.connect(logger).logDecryption(id('r3'), id('a'), id('u'), id('c'), id('p'))
    ).to.emit(contract, 'DecryptionLogged');
  });

  it('lists every receipt of one asset (powers the audit timeline)', async function () {
    const assetRef = id('asset-99');
    await contract.logDecryption(id('r-a'), assetRef, id('u1'), id('c'), id('p'));
    await contract.logDecryption(id('r-b'), assetRef, id('u2'), id('c'), id('p'));

    const list = await contract.receiptsOfAsset(assetRef);
    expect(list).to.have.lengthOf(2);
    expect(await contract.receiptCountOfAsset(assetRef)).to.equal(2n);
  });

  it('reverts on an unknown receipt but hasReceipt() stays safe', async function () {
    await expect(contract.getReceipt(id('nope'))).to.be.revertedWithCustomError(
      contract,
      'UnknownReceipt'
    );
    expect(await contract.hasReceipt(id('nope'))).to.equal(false);
  });
});

// helper: block timestamps are not predictable, so match any uint64
const anyUint64 = (value) => typeof value === 'bigint' && value > 0n;
