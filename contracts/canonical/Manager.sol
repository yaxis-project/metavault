// SPDX-License-Identifier: MIT
// solhint-disable max-states-count

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IManager.sol";

/**
 * @title Manager
 * @notice This contract serves as the central point for governance-voted
 * variables. Fees and permissioned addresses are stored and referenced in
 * this contract only.
 */
contract Manager is IManager {
    using SafeMath for uint256;

    uint256 public constant PENDING_STRATEGIST_TIMELOCK = 24 hours;

    address public immutable override yax;

    address public override governance;
    address public override harvester;
    address public override insurancePool;
    address public override stakingPool;
    address public override strategist;
    address public override pendingStrategist;
    address public override treasury;

    /**
     *  The following fees are all mutable.
     *  They are updated by governance (community vote).
     */
    uint256 public override insuranceFee;
    uint256 public override insurancePoolFee;
    uint256 public override stakingPoolShareFee;
    uint256 public override treasuryBalance;
    uint256 public override treasuryFee;
    uint256 public override withdrawalProtectionFee;

    uint256 public setPendingStrategistTime;

    // Governance must first allow the following properties before
    // the strategist can make use of them
    mapping(bytes32 => bool) public override allowedCodeHash;
    mapping(address => bool) public override allowedContracts;
    mapping(address => bool) public override allowedControllers;
    mapping(address => bool) public override allowedConverters;
    mapping(address => bool) public override allowedStrategies;
    mapping(address => bool) public override allowedTokens;
    mapping(address => bool) public override allowedVaults;

    // vault => controller
    mapping(address => address) public override controllers;
    // vault => tokens[]
    mapping(address => address[]) public override tokens;
    // token => vault
    mapping(address => address) public override vaults;

    event AllowedCodeHash(
        bytes32 indexed _codeHash,
        bool _allowed
    );
    event AllowedContract(
        address indexed _contract,
        bool _allowed
    );
    event AllowedController(
        address indexed _controller,
        bool _allowed
    );
    event AllowedConverter(
        address indexed _converter,
        bool _allowed
    );
    event AllowedStrategy(
        address indexed _strategy,
        bool _allowed
    );
    event AllowedToken(
        address indexed _token,
        bool _allowed
    );
    event AllowedVault(
        address indexed _vault,
        bool _allowed
    );
    event SetGovernance(
        address indexed _governance
    );
    event TokenAdded(
        address indexed _vault,
        address indexed _token
    );
    event TokenRemoved(
        address indexed _vault,
        address indexed _token
    );

    /**
     * @param _yax The address of the YAX token
     */
    constructor(
        address _yax
    )
        public
    {
        yax = _yax;
        governance = msg.sender;
        strategist = msg.sender;
        harvester = msg.sender;
        stakingPoolShareFee = 2000;
        treasuryBalance = 20000e18;
        treasuryFee = 500;
        withdrawalProtectionFee = 10;
    }

    /**
     * GOVERNANCE-ONLY FUNCTIONS
     */

    function setAllowedController(
        address _controller,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedControllers[_controller] = _allowed;
        emit AllowedController(_controller, _allowed);
    }

    function setAllowedConverter(
        address _converter,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedConverters[_converter] = _allowed;
        emit AllowedConverter(_converter, _allowed);
    }

    function setAllowedStrategy(
        address _strategy,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedStrategies[_strategy] = _allowed;
        emit AllowedStrategy(_strategy, _allowed);
    }

    function setAllowedToken(
        address _token,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedTokens[_token] = _allowed;
        emit AllowedToken(_token, _allowed);
    }

    function setAllowedCodeHash(
        bytes32 _hash,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedCodeHash[_hash] = _allowed;
        emit AllowedCodeHash(_hash, _allowed);
    }

    function setAllowedContract(
        address _contract,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedContracts[_contract] = _allowed;
        emit AllowedContract(_contract, _allowed);
    }

    function setAllowedVault(
        address _vault,
        bool _allowed
    )
        external
        onlyGovernance
    {
        allowedVaults[_vault] = _allowed;
        emit AllowedVault(_vault, _allowed);
    }

    /**
     * @notice Sets the governance address
     * @param _governance The address of the governance
     */
    function setGovernance(
        address _governance
    )
        external
        onlyGovernance
    {
        governance = _governance;
        emit SetGovernance(_governance);
    }

    /**
     * @notice Sets the harvester address
     * @param _harvester The address of the harvester
     */
    function setHarvester(
        address _harvester
    )
        external
        onlyGovernance
    {
        harvester = _harvester;
    }

    /**
     * @notice Sets the insurance fee
     * @dev Throws if setting fee over 1%
     * @param _insuranceFee The value for the insurance fee
     */
    function setInsuranceFee(
        uint256 _insuranceFee
    )
        public
        onlyGovernance
    {
        require(_insuranceFee <= 100, "_insuranceFee over 1%");
        insuranceFee = _insuranceFee;
    }

    /**
     * @notice Sets the insurance pool address
     * @param _insurancePool The address of the insurance pool
     */
    function setInsurancePool(
        address _insurancePool
    )
        public
        onlyGovernance
    {
        insurancePool = _insurancePool;
    }

    /**
     * @notice Sets the insurance pool fee
     * @dev Throws if setting fee over 20%
     * @param _insurancePoolFee The value for the insurance pool fee
     */
    function setInsurancePoolFee(
        uint256 _insurancePoolFee
    )
        public
        onlyGovernance
    {
        require(_insurancePoolFee <= 2000, "_insurancePoolFee over 20%");
        insurancePoolFee = _insurancePoolFee;
    }

    /**
     * @notice Sets the staking pool address
     * @param _stakingPool The address of the staking pool
     */
    function setStakingPool(
        address _stakingPool
    )
        public
        onlyGovernance
    {
        stakingPool = _stakingPool;
    }

    /**
     * @notice Sets the staking pool share fee
     * @dev Throws if setting fee over 50%
     * @param _stakingPoolShareFee The value for the staking pool fee
     */
    function setStakingPoolShareFee(
        uint256 _stakingPoolShareFee
    )
        public
        onlyGovernance
    {
        require(_stakingPoolShareFee <= 5000, "_stakingPoolShareFee over 50%");
        stakingPoolShareFee = _stakingPoolShareFee;
    }

    /**
     * @notice Sets the pending strategist and the timestamp
     * @param _strategist The address of the strategist
     */
    function setStrategist(
        address _strategist
    )
        external
        onlyGovernance
    {
        require(_strategist != address(0), "!_strategist");
        pendingStrategist = _strategist;
        // solhint-disable-next-line not-rely-on-time
        setPendingStrategistTime = block.timestamp;
    }

    /**
     * @notice Sets the treasury address
     * @param _treasury The address of the treasury
     */
    function setTreasury(
        address _treasury
    )
        public
        onlyGovernance
    {
        treasury = _treasury;
    }

    /**
     * @notice Sets the maximum treasury balance
     * @dev Strategies will read this value to determine whether or not
     * to give the treasury the treasuryFee
     * @param _treasuryBalance The maximum balance of the treasury
     */
    function setTreasuryBalance(
        uint256 _treasuryBalance
    )
        public
        onlyGovernance
    {
        treasuryBalance = _treasuryBalance;
    }

    /**
     * @notice Sets the treasury fee
     * @dev Throws if setting fee over 20%
     * @param _treasuryFee The value for the treasury fee
     */
    function setTreasuryFee(
        uint256 _treasuryFee
    )
        public
        onlyGovernance
    {
        require(_treasuryFee <= 2000, "_treasuryFee over 20%");
        treasuryFee = _treasuryFee;
    }

    /**
     * @notice Sets the withdrawal protection fee
     * @dev Throws if setting fee over 1%
     * @param _withdrawalProtectionFee The value for the withdrawal protection fee
     */
    function setWithdrawalProtectionFee(
        uint256 _withdrawalProtectionFee
    )
        public
        onlyGovernance
    {
        require(_withdrawalProtectionFee <= 100, "_withdrawalProtectionFee over 1%");
        withdrawalProtectionFee = _withdrawalProtectionFee;
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    function acceptStrategist()
        external
    {
        require(msg.sender == pendingStrategist, "!pendingStrategist");
        // solhint-disable-next-line not-rely-on-time
        require(setPendingStrategistTime > block.timestamp.sub(PENDING_STRATEGIST_TIMELOCK), "PENDING_STRATEGIST_TIMELOCK");
        delete pendingStrategist;
        delete setPendingStrategistTime;
        strategist = msg.sender;
    }

    function addToken(
        address _vault,
        address _token
    )
        external
        override
        onlyStrategist
    {
        require(allowedTokens[_token], "!allowedTokens");
        require(allowedVaults[_vault], "!allowedVaults");
        vaults[_token] = _vault;
        tokens[_vault].push(_token);
        emit TokenAdded(_vault, _token);
    }

    /**
     * @notice Allows the strategist to pull tokens out of this contract
     * @dev This contract should never hold tokens
     * @param _token The address of the token
     * @param _amount The amount to withdraw
     * @param _to The address to send to
     */
    function recoverToken(
        IERC20 _token,
        uint256 _amount,
        address _to
    )
        external
        onlyStrategist
    {
        _token.transfer(_to, _amount);
    }

    function removeToken(
        address _vault,
        address _token
    )
        external
        override
        onlyStrategist
    {
        uint256 k = tokens[_vault].length;
        uint256 index;

        for (uint i = 0; i < k; i++) {
            if (tokens[_vault][i] == _token) {
                index = i;
                break;
            }
        }

        tokens[_vault][index] = tokens[_vault][k-1];
        tokens[_vault].pop();
        delete vaults[_token];
        emit TokenRemoved(_vault, _token);
    }

    /**
     * @notice Sets the vault address for a controller
     * @param _vault The address of the vault
     * @param _controller The address of the controller
     */
    function setController(
        address _vault,
        address _controller
    )
        external
        onlyStrategist
    {
        require(allowedVaults[_vault], "!_vault");
        require(allowedControllers[_controller], "!_controller");
        controllers[_vault] = _controller;
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    function getTokens(
        address _vault
    )
        external
        override
        view
        returns (address[] memory)
    {
        return tokens[_vault];
    }

    /**
     * @notice Returns a tuple of:
     *     YAX token,
     *     Staking pool address,
     *     Staking pool share fee,
     *     Treasury address,
     *     Checks the balance of the treasury and returns the treasury fee
     *         if below the treasuryBalance, or 0 if above
     */
    function getHarvestFeeInfo()
        external
        view
        override
        returns (
            address,
            address,
            uint256,
            address,
            uint256,
            address,
            uint256
        )
    {
        return (
            yax,
            stakingPool,
            stakingPoolShareFee,
            treasury,
            IERC20(yax).balanceOf(treasury) >= treasuryBalance ? 0 : treasuryFee,
            insurancePool,
            insurancePoolFee
        );
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "!governance");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == strategist, "!strategist");
        _;
    }
}
