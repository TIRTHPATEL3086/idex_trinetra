import { http, createConfig } from 'wagmi';
import { sepolia, hardhat } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http(),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
});

export const SEPOLIA_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
