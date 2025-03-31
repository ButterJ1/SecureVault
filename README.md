# Blockchain Vault

Blockchain Vault is a decentralized application that enables secure storage of encrypted messages and passwords on the Ethereum blockchain. The application uses end-to-end encryption where only the intended recipient or owner can access the information using their wallet credentials and private keys.

## Project Description

This project creates a trustless system for storing sensitive information on the blockchain. When sending messages, users connect their wallet (e.g., MetaMask) and specify a recipient address. Messages are encrypted client-side before being stored on the blockchain, ensuring that only the intended recipient can decrypt and read them. Users can save contacts with friendly names for easier address management.

For password storage, the application implements a multi-factor security system using wallet authentication, a core password, and private keys. A unique security feature includes an ETH deposit requirement after failed decryption attempts to prevent brute force attacks. After three failed attempts, the account is locked for one hour, and the penalty amount doubles. The contract owner cannot access stored passwords, maintaining complete privacy.

## Current Status

This project is currently under development. The front-end interface has been created and the smart contract has been developed, but contract deployment and integration testing are still pending. Security testing and auditing will be required before production use.