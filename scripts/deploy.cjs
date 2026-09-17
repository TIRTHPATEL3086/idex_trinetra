/**
 * Deploy DecryptionProvenance and print the address to paste into `.env`.
 *
 *   npm run chain:deploy:local     (after `npm run chain:node` in another shell)
 *   npm run chain:deploy:sepolia
 *
 * The address is also written to `deployments/<network>.json` so `chain.js`
 * can pick it up automatically when the env var is not set yet.
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const net = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log('─'.repeat(64));
  console.log(`  network   : ${net}`);
  console.log(`  deployer  : ${deployer.address}`);
  console.log(`  balance   : ${hre.ethers.formatEther(balance)} ETH`);
  console.log('─'.repeat(64));

  if (balance === 0n) {
    console.error('\n  Deployer has 0 ETH.');
    if (net === 'sepolia') {
      console.error('  Get Sepolia test ETH from a faucet (sepoliafaucet.com /');
      console.error('  Alchemy / Infura). Faucets rate-limit — do this a week early.\n');
    }
    process.exit(1);
  }

  const Factory = await hre.ethers.getContractFactory('DecryptionProvenance');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();

  console.log(`\n  DecryptionProvenance deployed`);
  console.log(`  address   : ${address}`);
  console.log(`  tx        : ${tx.hash}`);
  console.log(`  block     : ${receipt.blockNumber}`);
  console.log(`  gas used  : ${receipt.gasUsed.toString()}`);

  if (net === 'sepolia') {
    console.log(`\n  Etherscan : https://sepolia.etherscan.io/address/${address}`);
  }

  const envKey = net === 'sepolia' ? 'SEPOLIA_CONTRACT_ADDRESS' : 'LOCAL_CONTRACT_ADDRESS';
  console.log(`\n  >> Put this in .env:\n     ${envKey}=${address}\n`);

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${net}.json`),
    JSON.stringify(
      {
        network: net,
        address,
        deployer: deployer.address,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`  saved     : deployments/${net}.json`);

  if (net === 'sepolia' && process.env.ETHERSCAN_API_KEY) {
    console.log('\n  Verifying on Etherscan (waiting 5 blocks first)...');
    await tx.wait(5);
    try {
      await hre.run('verify:verify', { address, constructorArguments: [] });
      console.log('  verified.');
    } catch (err) {
      console.log(`  verify skipped: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
