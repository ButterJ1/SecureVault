import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './BlockchainApp.css';
import SecureVaultABI from '../contracts/SecureVault.json';

const CONTRACT_ADDRESS = "0xFA8d8e24cC6CFbA51f76f6670B1938f970Bc3260";
const MIN_PENALTY = ethers.parseEther("0.0001");

const BlockchainApp = () => {
  const [activeTab, setActiveTab] = useState('store');
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [passwordName, setPasswordName] = useState('');
  const [accountValue, setAccountValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [cost, setCost] = useState('0.0002');
  const [corePassword, setCorePassword] = useState('');
  const [savedNonce, setSavedNonce] = useState('');

  const [retrieveName, setRetrieveName] = useState('');
  const [retrieveNonce, setRetrieveNonce] = useState('');
  const [retrieveCorePassword, setRetrieveCorePassword] = useState('');
  const [retrievedPassword, setRetrievedPassword] = useState(null);

  const [passwordEntries, setPasswordEntries] = useState([]);
  const [userBalances, setUserBalances] = useState({ securedBalance: "0", penaltyTotal: "0" });

  const connectWallet = async () => {
    try {
      setIsLoading(true);
      setStatusMessage("Connecting to wallet...");

      if (!window.ethereum) {
        throw new Error("MetaMask not detected. Please install MetaMask.");
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];

      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner = await newProvider.getSigner();

      setAccount(account);
      setProvider(newProvider);
      setSigner(newSigner);
      setIsConnected(true);

      try {
        console.log("Initializing contract at address:", CONTRACT_ADDRESS);
        console.log("ABI:", SecureVaultABI.abi);

        const newContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          SecureVaultABI.abi,
          newSigner
        );

        setContract(newContract);
        setIsInitialized(true);
        setStatusMessage("Connected successfully!");

        try {
          await newContract.getPasswordNames();
        } catch (error) {
          console.log("Registering new user...");
          const tx = await newContract.registerUser();
          await tx.wait();
          setStatusMessage("Registered as a new user!");
        }

        await loadUserData(newContract);
      } catch (error) {
        console.error("Contract initialization error:", error);
        setStatusMessage(`Contract error: ${error.message}`);
      }
    } catch (error) {
      console.error("Connection Error:", error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async (contractInstance) => {
    try {
      const contractToUse = contractInstance || contract;
      if (!contractToUse) {
        setStatusMessage("Contract not initialized. Please reconnect your wallet.");
        return;
      }

      setIsLoading(true);
      setStatusMessage("Loading your data...");

      const names = await contractToUse.getPasswordNames();
      const entries = [];

      for (const name of names) {
        const details = await contractToUse.getPasswordDetails(name);
        entries.push({
          name: details.name,
          account: details.account,
          hasCode: details.hasCode,
          cost: details.cost,
          attemptCount: details.attemptCount.toString(),
          openCount: details.openCount.toString(), 
          isLocked: details.isLocked,
          timeUntilUnlock: details.timeUntilUnlock.toString(),
        });
      }

      setPasswordEntries(entries);

      const balances = await contractToUse.getUserBalances();
      setUserBalances({
        securedBalance: ethers.formatEther(balances.securedBalance),
        penaltyTotal: ethers.formatEther(balances.penaltyTotal)
      });

      setStatusMessage("Data loaded successfully!");
    } catch (error) {
      console.error("Data Loading Error:", error);
      setStatusMessage(`Error loading data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const validateContract = () => {
    if (!isConnected) {
      setStatusMessage("Please connect your wallet first");
      return false;
    }

    if (!contract) {
      setStatusMessage("Contract not initialized. Please reconnect your wallet.");
      return false;
    }

    if (!isInitialized) {
      setStatusMessage("Contract initialization is still in progress. Please wait a moment.");
      return false;
    }

    return true;
  };

  const storePassword = async () => {
    if (!validateContract()) return;

    try {
      setIsLoading(true);
      setStatusMessage("Preparing to store password...");

      const nonce = Math.random().toString(36).substring(2, 15);
      const encryptedHash = await encryptPassword(passwordValue, nonce, corePassword, account);
      const costWei = ethers.parseEther(cost.toString());

      setStatusMessage("Storing password on the blockchain...");
      const tx = await contract.storePassword(
        passwordName,
        accountValue,
        encryptedHash,
        hasCode,
        costWei
      );

      await tx.wait();

      setSavedNonce(nonce);
      setStatusMessage(`Password stored successfully! Your nonce is: ${nonce} - SAVE THIS!`);
      setPasswordName('');
      setAccountValue('');
      setPasswordValue('');
      setCorePassword('');
      setHasCode(false);

      await loadUserData();
    } catch (error) {
      console.error("Store Password Error:", error);
      setStatusMessage(`Error storing password: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const retrievePassword = async () => {
    if (!contract) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage("Retrieving password details...");

      const details = await contract.getPasswordDetails(retrieveName);
      const costWei = details.cost;

      setStatusMessage("Attempting to retrieve password...");
      const attemptedHash = await encryptPassword("dummy", retrieveNonce, retrieveCorePassword, account);

      const tx = await contract.attemptPasswordRetrieval(
        retrieveName,
        attemptedHash,
        { value: costWei }
      );

      const receipt = await tx.wait();

      const entryDetails = await contract.getPasswordDetails(retrieveName);
      if (entryDetails.openCount > 0) {
        const decryptedData = await decryptPassword(attemptedHash, account);
        setRetrievedPassword(decryptedData.password);
        setStatusMessage("Password retrieved successfully!");
      } else {
        setStatusMessage("Failed to retrieve password. Incorrect nonce or core password.");
      }

      await loadUserData();
    } catch (error) {
      console.error("Retrieve Password Error:", error);

      if (error.message.includes("Vault is locked")) {
        setStatusMessage("This vault is currently locked due to too many failed attempts.");
      } else {
        setStatusMessage(`Error retrieving password: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetVault = async (name) => {
    if (!contract) return;

    try {
      setIsLoading(true);
      setStatusMessage(`Resetting vault for ${name}...`);

      const tx = await contract.resetVault(name);
      await tx.wait();

      setStatusMessage("Vault reset successfully!");
      await loadUserData();
    } catch (error) {
      console.error("Reset Vault Error:", error);
      setStatusMessage(`Error resetting vault: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCost = async (name, newCost) => {
    if (!contract) return;

    try {
      setIsLoading(true);
      setStatusMessage(`Updating cost for ${name}...`);

      const newCostWei = ethers.parseEther(newCost.toString());
      const tx = await contract.updateCost(name, newCostWei);
      await tx.wait();

      setStatusMessage("Cost updated successfully!");
      await loadUserData();
    } catch (error) {
      console.error("Update Cost Error:", error);
      setStatusMessage(`Error updating cost: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const withdrawBalance = async () => {
    if (!contract) return;

    try {
      setIsLoading(true);
      setStatusMessage("Withdrawing secured balance...");

      const tx = await contract.withdrawSecuredBalance();
      await tx.wait();

      setStatusMessage("Balance withdrawn successfully!");
      await loadUserData();
    } catch (error) {
      console.error("Withdraw Balance Error:", error);
      setStatusMessage(`Error withdrawing balance: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const giveTip = async () => {
    if (!contract) return;

    try {
      const tipAmount = prompt("Enter tip amount in ETH:", "0.00001");
      if (!tipAmount || isNaN(tipAmount)) return;

      setIsLoading(true);
      setStatusMessage("Sending tip...");

      const tipWei = ethers.parseEther(tipAmount.toString());
      const tx = await contract.giveTip({ value: tipWei });
      await tx.wait();

      setStatusMessage("Tip sent successfully. Thank you!");
    } catch (error) {
      console.error("Give Tip Error:", error);
      setStatusMessage(`Error sending tip: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const encryptPassword = async (password, nonce, corePassword, account) => {
    const messageData = {
      password: password,
      nonce: nonce,
      corePassword: corePassword
    };
    const message = JSON.stringify(messageData);
  
    try {
      const encryptionPublicKey = await window.ethereum.request({
        method: 'eth_getEncryptionPublicKey',
        params: [account]
      });
  
      const encryptedMessage = await window.ethereum.request({
        method: 'eth_encrypt',
        params: [message, encryptionPublicKey]
      });
      
      const encryptedHash = ethers.keccak256(ethers.toUtf8Bytes(encryptedMessage));
      localStorage.setItem(`encryptedData_${account}_${encryptedHash}`, encryptedMessage);
      
      return encryptedHash;
    } catch (error) {
      console.error('Error encrypting password:', error);
      
      if (error.message.includes("eth_encrypt") || error.message.includes("undefined")) {
        console.log("Falling back to simple encryption");
  
        const dataToEncrypt = message + "_" + account + "_" + corePassword + "_" + nonce;
        const encryptedHash = ethers.keccak256(ethers.toUtf8Bytes(dataToEncrypt));
        localStorage.setItem(`encryptedData_${account}_${encryptedHash}`, btoa(JSON.stringify(messageData)));
        
        return encryptedHash;
      }
      
      throw error;
    }
  };
  
  const decryptPassword = async (encryptedHash, account) => {
    try {
      const encryptedData = localStorage.getItem(`encryptedData_${account}_${encryptedHash}`);
      if (!encryptedData) {
        throw new Error('Encrypted data not found in local storage');
      }
  
      if (encryptedData.startsWith('0x')) {
        const decryptedMessage = await window.ethereum.request({
          method: 'eth_decrypt',
          params: [encryptedData, account]
        });
        
        return JSON.parse(decryptedMessage);
      } else {
        try {
          const decodedData = atob(encryptedData);
          return JSON.parse(decodedData);
        } catch (e) {
          console.error("Error parsing decoded data:", e);
          throw new Error("Failed to decrypt the password");
        }
      }
    } catch (error) {
      console.error('Error decrypting password:', error);
      throw error;
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum && isConnected && signer && !contract) {
        try {
          const newContract = new ethers.Contract(
            CONTRACT_ADDRESS,
            SecureVaultABI.abi,
            signer
          );
          setContract(newContract);
          setIsInitialized(true);
        } catch (error) {
          console.error("Failed to initialize contract on reload:", error);
          setIsInitialized(false);
        }
      }
    };

    checkConnection();
  }, [isConnected, signer]);

  return (
    <div className="blockchain-app">
      <header>
        <div className="container">
          <div className="header-content">
            <h1>Blockchain Password Vault</h1>
            <p>Securely store your passwords with blockchain technology</p>

            {!isConnected ? (
              <button className="btn-primary" onClick={connectWallet} disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <div className="wallet-info">
                <p>Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
                <div className="balance-info">
                  <p>Secured Balance: {userBalances.securedBalance} ETH</p>
                  <p>Penalty Total: {userBalances.penaltyTotal} ETH</p>
                  {parseFloat(userBalances.securedBalance) > 0 && (
                    <button className="btn-secondary" onClick={withdrawBalance}>
                      Withdraw Balance
                    </button>
                  )}
                </div>
              </div>
            )}

            {statusMessage && (
              <div className={`status-message ${statusMessage.includes("Error") ? "error" : "success"}`}>
                {statusMessage}
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {!isConnected ? (
          <div className="card">
            <div className="content">
              <h2>Welcome to Blockchain Password Vault</h2>
              <p>Connect your wallet to start using the secure password vault.</p>
              <p>This application uses smart contracts to securely store your passwords.</p>
              <p>Features:</p>
              <ul>
                <li>Encrypt your passwords using your own wallet's keys</li>
                <li>Secure storage with penalty mechanisms to prevent unauthorized access</li>
                <li>Automatic vault locking after multiple failed attempts</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="card">
            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab-button ${activeTab === 'store' ? 'active' : ''}`}
                onClick={() => setActiveTab('store')}
              >
                Store Password
              </button>
              <button
                className={`tab-button ${activeTab === 'retrieve' ? 'active' : ''}`}
                onClick={() => setActiveTab('retrieve')}
              >
                Retrieve Password
              </button>
              <button
                className={`tab-button ${activeTab === 'manage' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('manage');
                  if (isInitialized && contract) {
                    loadUserData();
                  } else {
                    setStatusMessage("Please connect your wallet to manage your vault");
                  }
                }}
              >
                Manage Vault
              </button>
            </div>

            {/* Content area */}
            <div className="content">
              {activeTab === 'store' && (
                <div className="form-group">
                  <h3 className="section-title">Store New Password</h3>

                  <div className="form-section">
                    <div className="grid form-grid">
                      <div>
                        <label>Password Name</label>
                        <input
                          type="text"
                          value={passwordName}
                          onChange={(e) => setPasswordName(e.target.value)}
                          placeholder="e.g., Gmail, Twitter"
                        />
                      </div>
                      <div>
                        <label>Account</label>
                        <input
                          type="text"
                          value={accountValue}
                          onChange={(e) => setAccountValue(e.target.value)}
                          placeholder="e.g., user@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid form-grid">
                      <div>
                        <label>Password</label>
                        <input
                          type="password"
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                          placeholder="Enter password to store"
                        />
                      </div>
                      <div>
                        <label>Core Password</label>
                        <input
                          type="password"
                          value={corePassword}
                          onChange={(e) => setCorePassword(e.target.value)}
                          placeholder="Core password for encryption"
                        />
                      </div>
                    </div>

                    <div className="grid form-grid">
                      <div>
                        <label>Cost (ETH) - Min: 0.0002</label>
                        <input
                          type="number"
                          value={cost}
                          onChange={(e) => setCost(e.target.value)}
                          min="0.0002"
                          step="0.0001"
                        />
                      </div>
                      <div className="checkbox-container">
                        <label>
                          <input
                            type="checkbox"
                            checked={hasCode}
                            onChange={(e) => setHasCode(e.target.checked)}
                          />
                          Has verification code
                        </label>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                      <button
                        className="btn-primary"
                        onClick={storePassword}
                        disabled={isLoading || !passwordName || !accountValue || !passwordValue || !corePassword}
                      >
                        {isLoading ? "Storing..." : "Encrypt & Store Password"}
                      </button>
                    </div>

                    {savedNonce && (
                      <div className="nonce-display">
                        <p>Your generated nonce: <strong>{savedNonce}</strong></p>
                        <p className="warning">IMPORTANT: Save this nonce securely. You will need it to retrieve your password.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'retrieve' && (
                <div className="form-group">
                  <h3 className="section-title">Retrieve Password</h3>

                  <div className="form-section">
                    <div className="grid form-grid">
                      <div>
                        <label>Password Name</label>
                        <select
                          value={retrieveName}
                          onChange={(e) => setRetrieveName(e.target.value)}
                        >
                          <option value="">Select a password</option>
                          {passwordEntries.map((entry) => (
                            <option key={entry.name} value={entry.name} disabled={entry.isLocked}>
                              {entry.name} {entry.isLocked ? "(Locked)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Nonce</label>
                        <input
                          type="text"
                          value={retrieveNonce}
                          onChange={(e) => setRetrieveNonce(e.target.value)}
                          placeholder="Enter your saved nonce"
                        />
                      </div>
                    </div>

                    <div>
                      <label>Core Password</label>
                      <input
                        type="password"
                        value={retrieveCorePassword}
                        onChange={(e) => setRetrieveCorePassword(e.target.value)}
                        placeholder="Enter your core password"
                      />
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                      <button
                        className="btn-primary"
                        onClick={retrievePassword}
                        disabled={isLoading || !retrieveName || !retrieveNonce || !retrieveCorePassword}
                      >
                        {isLoading ? "Retrieving..." : "Retrieve Password"}
                      </button>
                    </div>

                    {retrievedPassword && (
                      <div className="retrieved-password">
                        <h4>Retrieved Password:</h4>
                        <p className="password-value">{retrievedPassword}</p>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(retrievedPassword);
                            setStatusMessage("Password copied to clipboard!");
                          }}
                        >
                          Copy to Clipboard
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'manage' && (
                <div className="form-group">
                  <h3 className="section-title">Manage Your Vault</h3>

                  {passwordEntries.length === 0 ? (
                    <p className="empty-message">No passwords stored yet</p>
                  ) : (
                    <div className="item-list">
                      {passwordEntries.map((entry) => (
                        <div key={entry.name} className={`vault-item ${entry.isLocked ? 'locked' : ''}`}>
                          <div className="vault-item-header">
                            <h4>{entry.name}</h4>
                            {entry.isLocked && <span className="lock-icon">🔒</span>}
                          </div>

                          <div className="vault-item-details">
                            <p>Account: {entry.account}</p>
                            <p>Cost: {ethers.formatEther(entry.cost)} ETH</p>
                            <p>Attempts: {entry.attemptCount}</p>
                            <p>Opens: {entry.openCount}</p>
                            {entry.isLocked && (
                              <p className="lock-message">
                                Locked until: {new Date(Date.now() + Number(entry.timeUntilUnlock) * 1000).toLocaleString()}
                              </p>
                            )}
                          </div>

                          <div className="vault-item-actions">
                            {!entry.isLocked && Number(entry.openCount) > 0 && (
                              <button
                                className="btn-secondary"
                                onClick={() => resetVault(entry.name)}
                              >
                                Reset Vault
                              </button>
                            )}
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                const newCost = prompt(
                                  "Enter new cost (ETH):",
                                  ethers.formatEther(entry.cost)
                                );
                                if (newCost && !isNaN(newCost) && parseFloat(newCost) >= 0.0002) {
                                  updateCost(entry.name, newCost);
                                } else if (newCost) {
                                  setStatusMessage("Cost must be at least 0.0002 ETH");
                                }
                              }}
                            >
                              Update Cost
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="tip-section">
                    <button className="btn-primary" onClick={giveTip}>
                      Give Tip to Developer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer>
        <div className="container">
          <div className="footer-content">
            <p>Blockchain Password Vault • Secure Storage with Smart Contracts</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlockchainApp;