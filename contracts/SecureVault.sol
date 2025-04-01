// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract SecureVault {
    address public owner;
    uint256 public constant MIN_PENALTY = 0.0001 ether;
    uint256 public constant MIN_TIP = 0.00001 ether;
    uint256 public constant LOCK_PERIOD = 3 days;
    
    struct PasswordEntry {
        string name;
        string account;
        bool hasCode;
        bytes32 encryptedData; // Will store keccak256(password + nonce + corePassword)
        uint256 cost; // Cost to open (penalty * 2)
        uint256 attemptCount;
        uint256 openCount;
        uint256 lastFailedTime;
        bool isLocked;
    }
    
    struct User {
        mapping(string => PasswordEntry) passwords; // name => PasswordEntry
        string[] passwordNames;
        uint256 securedBalance;
        uint256 penaltyTotal;
    }
    
    mapping(address => User) private users;
    mapping(address => bool) private registeredUsers;
    
    event PasswordStored(address indexed user, string name);
    event PasswordRetrievalAttempt(address indexed user, string name, bool success);
    event VaultLocked(address indexed user, uint256 lockedUntil);
    event VaultUnlocked(address indexed user);
    event BalanceSecured(address indexed user, uint256 amount);
    event PenaltyApplied(address indexed user, uint256 amount);
    event TipReceived(address indexed user, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyRegistered() {
        require(registeredUsers[msg.sender], "User not registered");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function registerUser() external {
        require(!registeredUsers[msg.sender], "User already registered");
        registeredUsers[msg.sender] = true;
    }
    
    function storePassword(
        string memory _name,
        string memory _account,
        bytes32 _encryptedData,
        bool _hasCode,
        uint256 _cost
    ) external onlyRegistered {
        require(_cost >= MIN_PENALTY * 2, "Cost must be at least minimum penalty * 2");
        
        User storage user = users[msg.sender];
        bool isNew = bytes(user.passwords[_name].name).length == 0;
        if (isNew) {
            user.passwordNames.push(_name);
        }
        
        user.passwords[_name] = PasswordEntry({
            name: _name,
            account: _account,
            hasCode: _hasCode,
            encryptedData: _encryptedData,
            cost: _cost,
            attemptCount: 0,
            openCount: 0,
            lastFailedTime: 0,
            isLocked: false
        });
        
        emit PasswordStored(msg.sender, _name);
    }
    
    function attemptPasswordRetrieval(
        string memory _name,
        bytes32 _attempt
    ) external payable onlyRegistered returns (bool success, string memory password) {
        User storage user = users[msg.sender];
        PasswordEntry storage entry = user.passwords[_name];
        
        require(bytes(entry.name).length > 0, "Password entry not found");
        require(!entry.isLocked || block.timestamp >= entry.lastFailedTime + LOCK_PERIOD, "Vault is locked");
        require(msg.value >= entry.cost, "Insufficient balance for potential penalty");
        
        if (entry.isLocked && block.timestamp >= entry.lastFailedTime + LOCK_PERIOD) {
            entry.isLocked = false;
            emit VaultUnlocked(msg.sender);
        }

        if (_attempt == entry.encryptedData) {
            entry.openCount++;
            entry.attemptCount = 0;

            payable(msg.sender).transfer(msg.value);
            
            emit PasswordRetrievalAttempt(msg.sender, _name, true);
            return (true, "Password retrieved successfully");
        } else {
            entry.attemptCount++;
            uint256 penaltyAmount = calculatePenalty(entry.attemptCount);

            user.penaltyTotal += penaltyAmount;
            
            uint256 refundAmount = msg.value - penaltyAmount;
            
            emit PenaltyApplied(msg.sender, penaltyAmount);
            
            if (entry.attemptCount % 3 == 0) {
                entry.isLocked = true;
                entry.lastFailedTime = block.timestamp;
                
                user.securedBalance += refundAmount;
                
                emit VaultLocked(msg.sender, block.timestamp + LOCK_PERIOD);
                emit BalanceSecured(msg.sender, refundAmount);
                
                return (false, "Vault locked for 3 days due to multiple failed attempts");
            } else {
                payable(msg.sender).transfer(refundAmount);
                
                return (false, "Incorrect password, penalty applied");
            }
        }
    }
    
    function calculatePenalty(uint256 attempts) internal pure returns (uint256) {
        uint256 penaltyTier = (attempts - 1) / 3;
        return MIN_PENALTY * (2 ** penaltyTier);
    }
    
    function resetVault(string memory _name) external onlyRegistered {
        User storage user = users[msg.sender];
        PasswordEntry storage entry = user.passwords[_name];
        
        require(bytes(entry.name).length > 0, "Password entry not found");
        require(entry.openCount > 0, "Vault must be opened at least once before reset");
        
        entry.attemptCount = 0;
        entry.openCount = 0;
        
        emit PasswordRetrievalAttempt(msg.sender, _name, true);
    }
    
    function updateCost(string memory _name, uint256 _newCost) external onlyRegistered {
        require(_newCost >= MIN_PENALTY * 2, "Cost must be at least minimum penalty * 2");
        
        User storage user = users[msg.sender];
        PasswordEntry storage entry = user.passwords[_name];
        
        require(bytes(entry.name).length > 0, "Password entry not found");
        
        entry.cost = _newCost;
    }
    
    function withdrawSecuredBalance() external onlyRegistered {
        User storage user = users[msg.sender];
        
        uint256 amount = user.securedBalance;
        require(amount > 0, "No secured balance to withdraw");
        
        user.securedBalance = 0;
        payable(msg.sender).transfer(amount);
    }
    
    function giveTip() external payable onlyRegistered {
        require(msg.value >= MIN_TIP, "Tip amount too small");
        
        emit TipReceived(msg.sender, msg.value);
    }
    
    function withdrawTips() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    function getPasswordNames() external view onlyRegistered returns (string[] memory) {
        return users[msg.sender].passwordNames;
    }
    
    function getPasswordDetails(string memory _name) external view onlyRegistered returns (
        string memory name,
        string memory account,
        bool hasCode,
        uint256 cost,
        uint256 attemptCount,
        uint256 openCount,
        bool isLocked,
        uint256 timeUntilUnlock
    ) {
        User storage user = users[msg.sender];
        PasswordEntry storage entry = user.passwords[_name];
        
        require(bytes(entry.name).length > 0, "Password entry not found");
        
        uint256 remainingLockTime = 0;
        if (entry.isLocked && block.timestamp < entry.lastFailedTime + LOCK_PERIOD) {
            remainingLockTime = entry.lastFailedTime + LOCK_PERIOD - block.timestamp;
        }
        
        return (
            entry.name,
            entry.account,
            entry.hasCode,
            entry.cost,
            entry.attemptCount,
            entry.openCount,
            entry.isLocked,
            remainingLockTime
        );
    }
    
    function getUserBalances() external view onlyRegistered returns (uint256 securedBalance, uint256 penaltyTotal) {
        User storage user = users[msg.sender];
        return (user.securedBalance, user.penaltyTotal);
    }
}