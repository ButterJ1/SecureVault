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

## How It Works

### Storing Passwords

1. Connect your MetaMask wallet
2. Enter your password details:
   - Name (e.g., "Gmail")
   - Account (e.g., "user@gmail.com")
   - Password (e.g., "MySecureP@ssw0rd")
   - Core Password (your master encryption key)
   - Cost (minimum 0.02 ETH) - the security deposit required
   - Has verification code (check if the account uses 2FA)
3. Click "Encrypt & Store Password"
4. Save the generated nonce (you'll need this to retrieve your password later)

**Example:**
```
Name: Gmail
Account: user@gmail.com
Password: MySecureP@ssw0rd
Core Password: MasterKey123
Cost: 0.05 ETH
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

Let's say you stored a Gmail password with a cost of 0.1 ETH (penalty fee 0.05 ETH):

1. **Correct attempt**: You enter the right nonce and core password → Password revealed, no fee charged
2. **First failed attempt**: 0.05 ETH penalty, remaining 0.05 ETH returned
3. **Second failed attempt**: Another 0.05 ETH penalty
4. **Third failed attempt**: Vault locks for 3 days

After 3 days, the vault unlocks, but penalties double for the next set of attempts (0.1 ETH per attempt).

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
- **Encryption**: MetaMask's eth-sig-util

## Security Considerations

1. **Keep your nonce safe**: Without the correct nonce, you cannot retrieve your passwords
2. **Remember your core password**: There is no recovery mechanism
3. **Set appropriate costs**: Higher costs mean higher security but also higher penalties
4. **Secured Balance**: If your vault locks, your remaining balance is secured until unlocking

## Installation & Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Configure your `.env` file with your private key
4. Deploy the contract with `npx hardhat run scripts/deploy.js --network zircuit`
5. Update the contract address in the frontend
6. Start the application with `npm start`

## Contribution

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.