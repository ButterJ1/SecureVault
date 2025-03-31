const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SecureVault Contract", function () {
  let SecureVault;
  let secureVault;
  let owner;
  let user1;
  let user2;
  
  const MIN_PENALTY = ethers.parseEther("0.0001");
  const MIN_TIP = ethers.parseEther("0.00001");
  const LOCK_PERIOD = 3 * 24 * 60 * 60; // 3 days in seconds
  
  const testName = "Gmail";
  const testAccount = "test@gmail.com";
  const testEncryptedData = ethers.keccak256(ethers.toUtf8Bytes("encrypted-password-data"));
  const testHasCode = false;
  const testCost = ethers.parseEther("0.02"); // Min penalty * 2
  const incorrectAttempt = ethers.keccak256(ethers.toUtf8Bytes("incorrect-attempt"));
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    SecureVault = await ethers.getContractFactory("SecureVault");
    secureVault = await SecureVault.deploy();
    
    await secureVault.connect(user1).registerUser();
    await secureVault.connect(user2).registerUser();
  });
  
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await secureVault.owner()).to.equal(owner.address);
    });
  });
  
  describe("User Registration", function () {
    it("Should allow a user to register", async function () {
      const newUser = (await ethers.getSigners())[3];
      await secureVault.connect(newUser).registerUser();
      
      await expect(
        secureVault.connect(newUser).getPasswordNames()
      ).to.not.be.reverted;
    });
    
    it("Should not allow a user to register twice", async function () {
      await expect(
        secureVault.connect(user1).registerUser()
      ).to.be.revertedWith("User already registered");
    });
  });
  
  describe("Password Storage", function () {
    it("Should store a password entry", async function () {
      await secureVault.connect(user1).storePassword(
        testName,
        testAccount,
        testEncryptedData,
        testHasCode,
        testCost
      );
      
      const names = await secureVault.connect(user1).getPasswordNames();

      expect(names.length).to.equal(1);
      expect(names[0]).to.equal(testName);
      
      const details = await secureVault.connect(user1).getPasswordDetails(testName);

      expect(details.name).to.equal(testName);
      expect(details.account).to.equal(testAccount);
      expect(details.hasCode).to.equal(testHasCode);
      expect(details.cost).to.equal(testCost);
    });
    
    it("Should reject password entries with cost below minimum", async function () {
      const lowCost = ethers.parseEther("0.0001"); // Below MIN_PENALTY * 2
      
      await expect(
        secureVault.connect(user1).storePassword(
          testName,
          testAccount,
          testEncryptedData,
          testHasCode,
          lowCost
        )
      ).to.be.revertedWith("Cost must be at least minimum penalty * 2");
    });
  });
  
  describe("Password Retrieval Attempts", function () {
    beforeEach(async function () {
      await secureVault.connect(user1).storePassword(
        testName,
        testAccount,
        testEncryptedData,
        testHasCode,
        testCost
      );
    });
    
    it("Should succeed with correct encrypted data", async function () {
      const result = await secureVault.connect(user1).attemptPasswordRetrieval(
        testName,
        testEncryptedData,
        { value: testCost }
      );
      
      const txReceipt = await result.wait();
      const details = await secureVault.connect(user1).getPasswordDetails(testName);

      expect(details.attemptCount).to.equal(0);
      expect(details.openCount).to.equal(1);
    });
    
    it("Should apply penalty on failed attempt", async function () {
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      const tx = await secureVault.connect(user1).attemptPasswordRetrieval(
        testName,
        incorrectAttempt,
        { value: testCost }
      );
      
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const details = await secureVault.connect(user1).getPasswordDetails(testName);

      expect(details.attemptCount).to.equal(1);
      
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const expectedBalance = initialBalance - MIN_PENALTY - gasCost;
      const tolerance = ethers.parseEther("0.0001");

      expect(finalBalance).to.be.closeTo(expectedBalance, tolerance);
    });
    
    it("Should lock vault after 3 failed attempts", async function () {
      for (let i = 0; i < 3; i++) {
        await secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          incorrectAttempt,
          { value: testCost }
        );
      }
      
      const details = await secureVault.connect(user1).getPasswordDetails(testName);

      expect(details.isLocked).to.be.true;
      expect(details.attemptCount).to.equal(3);
      
      await expect(
        secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          testEncryptedData,
          { value: testCost }
        )
      ).to.be.revertedWith("Vault is locked");
    });
    
    it("Should automatically unlock vault after lock period", async function () {
      for (let i = 0; i < 3; i++) {
        await secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          incorrectAttempt,
          { value: testCost }
        );
      }
      
      await time.increase(LOCK_PERIOD);
      
      await expect(
        secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          testEncryptedData,
          { value: testCost }
        )
      ).to.not.be.reverted;
      
      const details = await secureVault.connect(user1).getPasswordDetails(testName);

      expect(details.isLocked).to.be.false;
    });
    
    it("Should increase penalty after each tier (3 attempts)", async function () {
      let balanceBefore = await ethers.provider.getBalance(user1.address);
      
      let tx = await secureVault.connect(user1).attemptPasswordRetrieval(
        testName,
        incorrectAttempt,
        { value: testCost }
      );
      
      let receipt = await tx.wait();
      let gasCost = receipt.gasUsed * receipt.gasPrice;
      let balanceAfter = await ethers.provider.getBalance(user1.address);
      
      const balanceDifference = balanceBefore - balanceAfter - gasCost;
      const tolerance = ethers.parseEther("0.0001");
      
      expect(balanceDifference).to.be.closeTo(MIN_PENALTY, tolerance);
      
      for (let i = 0; i < 2; i++) {
        await secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          incorrectAttempt,
          { value: testCost }
        );
      }
      
      await time.increase(LOCK_PERIOD);
      
      const costForSecondTier = ethers.parseEther("0.04");
      await secureVault.connect(user1).updateCost(testName, costForSecondTier);
      
      balanceBefore = await ethers.provider.getBalance(user1.address);
      tx = await secureVault.connect(user1).attemptPasswordRetrieval(
        testName,
        incorrectAttempt,
        { value: costForSecondTier }
      );
      
      receipt = await tx.wait();
      gasCost = receipt.gasUsed * receipt.gasPrice;
      balanceAfter = await ethers.provider.getBalance(user1.address);
      
      const secondTierBalanceDifference = balanceBefore - balanceAfter - gasCost;
      
      expect(secondTierBalanceDifference).to.be.closeTo(MIN_PENALTY * 2n, tolerance);
    });
  });
  
  describe("Vault Management", function () {
    beforeEach(async function () {
      await secureVault.connect(user1).storePassword(
        testName,
        testAccount,
        testEncryptedData,
        testHasCode,
        testCost
      );
      
      await secureVault.connect(user1).attemptPasswordRetrieval(
        testName,
        testEncryptedData,
        { value: testCost }
      );
    });
    
    it("Should reset vault counters", async function () {
      await secureVault.connect(user1).attemptPasswordRetrieval(
        testName,
        incorrectAttempt,
        { value: testCost }
      );
      
      let details = await secureVault.connect(user1).getPasswordDetails(testName);
      expect(details.attemptCount).to.equal(1);
      expect(details.openCount).to.equal(1);

      await secureVault.connect(user1).resetVault(testName);
  
      details = await secureVault.connect(user1).getPasswordDetails(testName);
      expect(details.attemptCount).to.equal(0);
      expect(details.openCount).to.equal(0);
    });
    
    it("Should update cost", async function () {
      const newCost = ethers.parseEther("0.05");
      
      await secureVault.connect(user1).updateCost(testName, newCost);
      
      const details = await secureVault.connect(user1).getPasswordDetails(testName);
      expect(details.cost).to.equal(newCost);
    });
  });
  
  describe("Balance Management", function () {
    beforeEach(async function () {
      await secureVault.connect(user1).storePassword(
        testName,
        testAccount,
        testEncryptedData,
        testHasCode,
        testCost
      );
    });
    
    it("Should secure balance after 3 failed attempts", async function () {
      for (let i = 0; i < 3; i++) {
        await secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          incorrectAttempt,
          { value: testCost }
        );
      }

      const balances = await secureVault.connect(user1).getUserBalances();

      expect(balances.securedBalance).to.be.gt(0);
      expect(balances.penaltyTotal).to.equal(MIN_PENALTY * 3n);
    });
    
    it("Should allow withdrawal of secured balance", async function () {
      for (let i = 0; i < 3; i++) {
        await secureVault.connect(user1).attemptPasswordRetrieval(
          testName,
          incorrectAttempt,
          { value: testCost }
        );
      }

      await time.increase(LOCK_PERIOD);
      const initialBalances = await secureVault.connect(user1).getUserBalances();
      
      expect(initialBalances.securedBalance).to.be.gt(0);

      const initialEthBalance = await ethers.provider.getBalance(user1.address);
      const tx = await secureVault.connect(user1).withdrawSecuredBalance();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalances = await secureVault.connect(user1).getUserBalances();

      expect(finalBalances.securedBalance).to.equal(0);
      
      const finalEthBalance = await ethers.provider.getBalance(user1.address);
      
      const expectedBalance = initialEthBalance + initialBalances.securedBalance - gasCost;
      const tolerance = ethers.parseEther("0.0001");
      
      expect(finalEthBalance).to.be.closeTo(expectedBalance, tolerance);
    });
    
    it("Should process tips correctly", async function () {
      const tipAmount = ethers.parseEther("0.001");
      const initialContractBalance = await ethers.provider.getBalance(secureVault.getAddress());
      
      await secureVault.connect(user1).giveTip({ value: tipAmount });
      const contractAddress = await secureVault.getAddress();
      const finalContractBalance = await ethers.provider.getBalance(contractAddress);
      
      expect(finalContractBalance).to.equal(initialContractBalance + tipAmount);
      
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const tx = await secureVault.connect(owner).withdrawTips();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);

      const expectedBalance = initialOwnerBalance + tipAmount - gasCost;
      const tolerance = ethers.parseEther("0.0001");
      
      expect(finalOwnerBalance).to.be.closeTo(expectedBalance, tolerance);
    });
  });
});