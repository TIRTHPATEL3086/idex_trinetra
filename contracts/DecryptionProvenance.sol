// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  DecryptionProvenance
 * @notice Immutable register of "who decrypted what, when".
 *
 *         Design rule: NO personal data ever reaches this contract. The only
 *         identity that exists here is keccak256(userId || salt). Real names
 *         live in PostgreSQL, off-chain, private.
 *
 *         Each receipt is 5 x bytes32 + a uint64 timestamp. That is deliberately
 *         tiny: gas is paid per receipt, and anything that is merely *useful*
 *         (names, hashes for search, quality metrics) belongs in the database.
 *         Only facts that become worthless if someone can edit them live here.
 */
contract DecryptionProvenance is AccessControl {
    /// @notice Only holders of this role may write receipts.
    bytes32 public constant LOGGER_ROLE = keccak256("LOGGER_ROLE");

    struct Receipt {
        bytes32 assetRef; // keccak256(assetId || salt)
        bytes32 userRef; // keccak256(userId  || salt)  <- privacy
        bytes32 contentSha; // SHA-256 of the exact bytes released
        bytes32 payloadCommit; // keccak256(payloadBits || salt)
        uint64 timestamp; // block-anchored; cannot be back-dated
        bool exists;
    }

    mapping(bytes32 => Receipt) private receipts; // receiptId -> Receipt
    mapping(bytes32 => bytes32[]) private byAsset; // assetRef  -> receiptIds

    uint256 public totalReceipts;

    event DecryptionLogged(
        bytes32 indexed receiptId,
        bytes32 indexed assetRef,
        bytes32 indexed userRef,
        bytes32 contentSha,
        bytes32 payloadCommit,
        uint64 timestamp
    );

    /// @notice Stretch goal: 50 receipts anchored by one Merkle root, one tx.
    event BatchLogged(bytes32 indexed merkleRoot, uint32 count, uint64 timestamp);

    error ReceiptExists(bytes32 receiptId);
    error UnknownReceipt(bytes32 receiptId);
    error ZeroReceiptId();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LOGGER_ROLE, msg.sender);
    }

    /**
     * @notice Write one decryption receipt. Called by the backend the moment a
     *         file is decrypted — BEFORE the watermarked copy is handed over.
     *         If this reverts, no marked file ever leaves the system.
     */
    function logDecryption(
        bytes32 receiptId,
        bytes32 assetRef,
        bytes32 userRef,
        bytes32 contentSha,
        bytes32 payloadCommit
    ) external onlyRole(LOGGER_ROLE) {
        if (receiptId == bytes32(0)) revert ZeroReceiptId();
        if (receipts[receiptId].exists) revert ReceiptExists(receiptId);

        receipts[receiptId] = Receipt({
            assetRef: assetRef,
            userRef: userRef,
            contentSha: contentSha,
            payloadCommit: payloadCommit,
            timestamp: uint64(block.timestamp),
            exists: true
        });

        byAsset[assetRef].push(receiptId);
        unchecked {
            totalReceipts++;
        }

        emit DecryptionLogged(
            receiptId,
            assetRef,
            userRef,
            contentSha,
            payloadCommit,
            uint64(block.timestamp)
        );
    }

    /// @notice Read one receipt back. Used by /api/trace to cross-check a match.
    function getReceipt(bytes32 receiptId) external view returns (Receipt memory) {
        if (!receipts[receiptId].exists) revert UnknownReceipt(receiptId);
        return receipts[receiptId];
    }

    /// @notice Cheap existence probe — never reverts.
    function hasReceipt(bytes32 receiptId) external view returns (bool) {
        return receipts[receiptId].exists;
    }

    /// @notice Every receipt ever issued for one document. Powers the timeline.
    function receiptsOfAsset(bytes32 assetRef) external view returns (bytes32[] memory) {
        return byAsset[assetRef];
    }

    function receiptCountOfAsset(bytes32 assetRef) external view returns (uint256) {
        return byAsset[assetRef].length;
    }

    /**
     * @notice STRETCH (§10): anchor N receipts with a single Merkle root so one
     *         transaction covers a whole batch — ~50x gas reduction.
     *         Only the root is stored; individual proofs are verified off-chain
     *         against it. Ship this only after Hour 28 and only if frozen.
     */
    function logBatch(bytes32 merkleRoot, uint32 count) external onlyRole(LOGGER_ROLE) {
        emit BatchLogged(merkleRoot, count, uint64(block.timestamp));
    }

    /// @notice Admin grants a backend wallet permission to write receipts.
    function grantLogger(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(LOGGER_ROLE, account);
    }
}
