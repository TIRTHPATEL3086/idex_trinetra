require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const {
  LOCAL_RPC_URL = 'http://127.0.0.1:8545',
  LOCAL_PRIVATE_KEY,
  SEPOLIA_RPC_URL,
  SEPOLIA_PRIVATE_KEY,
  ETHERSCAN_API_KEY = '',
} = process.env;

/**
 * Hardhat is CommonJS even though the rest of the repo is ESM — that is why
 * this one file uses `require`. Do not "fix" it.
 *
 * Networks:
 *   hardhat   — in-process, used by `npx hardhat test`
 *   localhost — `npx hardhat node` in another terminal. Use this at the venue;
 *               it never depends on Wi-Fi or a faucet.
 *   sepolia   — the public testnet that gives the jury a clickable Etherscan
 *               link. Needs test ETH. GET IT A WEEK EARLY.
 */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: LOCAL_RPC_URL,
      chainId: 31337,
      // When LOCAL_PRIVATE_KEY is unset, Hardhat uses the node's own unlocked
      // accounts, which is what you want for `npx hardhat node`.
      accounts: LOCAL_PRIVATE_KEY ? [LOCAL_PRIVATE_KEY] : undefined,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || '',
      chainId: 11155111,
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: { sepolia: ETHERSCAN_API_KEY },
  },
  paths: {
    sources: './contracts',
    tests: './test/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};
