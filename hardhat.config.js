require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",

  networks:{
    zircuit: {
      url: `https://mainnet.zircuit.com`,
      chainId: 48900,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 1000000000,
    }
  }
};