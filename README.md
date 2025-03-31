# SecureVault - Blockchain Password Manager

A secure, decentralized password vault built on blockchain technology. Store your credentials with advanced protection mechanisms to prevent unauthorized access.

![SecureVault Interface](https://dino-vault.vercel.app/)

## Overview

SecureVault is a blockchain-based password manager that leverages smart contracts to securely store your passwords with several unique security features:

- **Encryption**: All passwords are encrypted using MetaMask's built-in encryption
- **Penalty System**: Failed access attempts incur a cost, deterring brute force attacks
- **Auto-Locking**: Multiple failed attempts automatically lock your vault
- **Secured Balance**: Funds are protected when a vault is locked
- **Customizable Security**: Set your own security cost for each password

## ⚠️ Known Issues and Limitations

When using the demo version, you may encounter the following errors in the console:

```
ERROR
subscriber not running
    at PollingBlockSubscriber.stop (http://localhost:3000/static/js/bundle.js:15358:13)
    at BrowserProvider.off (http://localhost:3000/static/js/bundle.js:11292:24)
```

**Important notes for demo users:**

1. **These errors are related to ethers.js v6 and MetaMask integration**. They occur when the application tries to clean up event listeners that may not be fully initialized.

2. **The core functionality still works despite these errors**. You can still encrypt and store passwords successfully.

3. **Browser console may show errors**, but these don't prevent the application from functioning. The password encryption and retrieval processes remain intact.

4. **For optimal experience**, refresh the page after connecting your wallet before performing any operations.

5. **If the application freezes**, disconnect and reconnect your wallet, then try your operation again.

## How It Works

### Storing Passwords

1. Connect your MetaMask wallet
2. Enter your password details:
   - Name (e.g., "Gmail")
   - Account (e.g., "user@gmail.com")
   - Password (e.g., "MySecureP@ssw0rd")
   - Core Password (your master encryption key)
   - Cost (minimum 0.0002 ETH) - the security deposit required
   - Has verification code (check if the account uses 2FA)
3. Click "Encrypt & Store Password"
4. Save the generated nonce (you'll need this to retrieve your password later)

**Example:**
```
Name: Gmail
Account: user@gmail.com
Password: MySecureP@ssw0rd
Core Password: MasterKey123
Cost: 0.0005 ETH
Has verification code: ✓ (checked if Gmail uses 2FA)
```

After storing, you'll receive a nonce like: `j8f92ndk4`

### Retrieving Passwords

1. Select the password name from your stored passwords
2. Enter your saved nonce
3. Enter your core password
4. Submit the form

**If successful**: Your password will be decrypted and displayed
**If failed**: A penalty fee (half of the cost) will be deducted from your deposit

**Example:**
```
Password Name: Gmail
Nonce: j8f92ndk4
Core Password: MasterKey123
```

### Security Mechanism Example

Let's say you stored a Gmail password with a cost of 0.0004 ETH (penalty fee 0.0002 ETH):

1. **Correct attempt**: You enter the right nonce and core password → Password revealed, no fee charged
2. **First failed attempt**: 0.0002 ETH penalty, remaining 0.0002 ETH returned
3. **Second failed attempt**: Another 0.0002 ETH penalty
4. **Third failed attempt**: Vault locks for 3 days

After 3 days, the vault unlocks, but penalties double for the next set of attempts (0.0004 ETH per attempt).

## Demo Cautions and Tips

1. **Use small amounts for testing**: When using the demo, set the minimum cost (0.0002 ETH) to avoid unnecessary expenses if errors occur.

2. **Save your nonce immediately**: The nonce is crucial for retrieving your password. Copy and store it in a safe place as soon as it's generated.

3. **MetaMask connection issues**: If MetaMask doesn't connect properly:
   - Refresh the page
   - Ensure MetaMask is unlocked
   - Try disconnecting and reconnecting your wallet

4. **Local storage dependency**: The app uses browser local storage to temporarily store encrypted data. Clearing your browser cache will make password retrieval impossible.

5. **Network selection**: Ensure MetaMask is connected to the Zircuit Network before interacting with the application.

6. **Error handling**: If you receive a transaction error, check the MetaMask details before confirming:
   - Gas price
   - Network congestion
   - Contract interactions

## Smart Contract Architecture

The system is powered by a Solidity smart contract with these key components:

### Data Structures

```solidity
struct PasswordEntry {
    string name;
    string account;
    bool hasCode;
    bytes32 encryptedData;
    uint256 cost;
    uint256 attemptCount;
    uint256 openCount;
    uint256 lastFailedTime;
    bool isLocked;
}

struct User {
    mapping(string => PasswordEntry) passwords;
    string[] passwordNames;
    uint256 securedBalance;
    uint256 penaltyTotal;
}
```

### Key Functions

- **storePassword**: Store encrypted password with security deposit
- **attemptPasswordRetrieval**: Try to access a password
- **resetVault**: Reset attempt counters after successful retrieval
- **withdrawSecuredBalance**: Withdraw your secured balance after unlocking

## Technologies Used

- **Blockchain**: Zircuit Network
- **Smart Contract**: Solidity 0.8.28
- **Frontend**: React.js
- **Web3 Integration**: ethers.js v6
- **Wallet Connection**: MetaMask
- **Encryption**: MetaMask's built-in encryption

## Security Considerations

1. **Keep your nonce safe**: Without the correct nonce, you cannot retrieve your passwords
2. **Remember your core password**: There is no recovery mechanism
3. **Set appropriate costs**: Higher costs mean higher security but also higher penalties
4. **Secured Balance**: If your vault locks, your remaining balance is secured until unlocking
5. **Browser storage**: Encrypted data is stored in your browser's local storage, so don't clear cache if you have active vaults

## Installation & Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Configure your `.env` file with your private key
4. Deploy the contract with `npx hardhat run scripts/deploy.js --network zircuit`
5. Update the contract address in the frontend
6. Start the application with `npm start`

## Troubleshooting Common Issues

### "Subscriber not running" Errors
- These are related to ethers.js event handling and can be safely ignored for demo purposes
- For production, consider implementing a more robust cleanup mechanism

### MetaMask Transaction Errors
- Ensure you have enough ETH for gas fees plus the password cost
- Check that you're connected to the correct network (Zircuit Network)
- Try increasing gas limit if transactions are failing

### Password Retrieval Issues
- Verify you're using the exact nonce that was provided
- Core password must match exactly what was used for storage
- Check that you haven't cleared your browser's local storage

## Contribution

Contributions are welcome! Please feel free to submit a Pull Request.