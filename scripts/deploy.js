const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SecureVault contract...");

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();

  await secureVault.waitForDeployment();
  
  const address = await secureVault.getAddress();
  console.log(`SecureVault deployed to: ${address}`);
  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contract:", error);
    process.exit(1);
  });