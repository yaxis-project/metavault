// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IVaultManager.sol";

contract yAxisMetaVaultManager is IVaultManager {
    address public override governance;
    address public override harvester;
    address public override stakingPool;
    address public override strategist;
    address public override treasury;
    address public override yax;

    /**
     *  The following fees are all mutable.
     *  They are updated by governance (community vote).
     */
    uint256 public override insuranceFee;
    uint256 public override stakingPoolShareFee;
    uint256 public override treasuryBalance;
    uint256 public override treasuryFee;
    uint256 public override withdrawalProtectionFee;

    mapping(address => bool) public override vaults;

    constructor(address _yax) public {
        yax = _yax;
        governance = msg.sender;
        strategist = msg.sender;
        harvester = msg.sender;
        stakingPoolShareFee = 2000;
        treasuryBalance = 20000e18;
        treasuryFee = 500;
        withdrawalProtectionFee = 10;
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setStrategist(address _strategist) external {
        require(msg.sender == governance, "!governance");
        strategist = _strategist;
    }

    function setYax(address _yax) external {
        require(msg.sender == governance, "!governance");
        yax = _yax;
    }

    function setStakingPool(address _stakingPool) public {
        require(msg.sender == governance, "!governance");
        stakingPool = _stakingPool;
    }

    function setStakingPoolShareFee(uint256 _stakingPoolShareFee) public {
        require(msg.sender == governance, "!governance");
        require(_stakingPoolShareFee <= 5000, "_stakingPoolShareFee over 50%");
        stakingPoolShareFee = _stakingPoolShareFee;
    }

    function setTreasury(address _treasury) public {
        require(msg.sender == governance, "!governance");
        treasury = _treasury;
    }

    function setTreasuryBalance(uint256 _treasuryBalance) public {
        require(msg.sender == governance, "!governance");
        treasuryBalance = _treasuryBalance;
    }

    function setTreasuryFee(uint256 _treasuryFee) public {
        require(msg.sender == governance, "!governance");
        require(_treasuryFee <= 2000, "_treasuryFee over 20%");
        treasuryFee = _treasuryFee;
    }

    function setInsuranceFee(uint256 _insuranceFee) public {
        require(msg.sender == governance, "!governance");
        require(_insuranceFee <= 100, "_insuranceFee over 1%");
        insuranceFee = _insuranceFee;
    }

    function setWithdrawalProtectionFee(uint256 _withdrawalProtectionFee) public {
        require(msg.sender == governance, "!governance");
        require(_withdrawalProtectionFee <= 100, "_withdrawalProtectionFee over 1%");
        withdrawalProtectionFee = _withdrawalProtectionFee;
    }

    function governanceRecoverUnsupported(IERC20 _token, uint _amount, address _to) external {
        require(msg.sender == governance, "!governance");
        _token.transfer(_to, _amount);
    }

    function setHarvester(address _harvester) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        harvester = _harvester;
    }

    function setVaultStatus(address _vault, bool _status) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        vaults[_vault] = _status;
    }

    function getHarvestFeeInfo()
        external
        view
        override
        returns (address, address, uint256, address, uint256)
    {
        return (
            yax,
            stakingPool,
            stakingPoolShareFee,
            treasury,
            IERC20(yax).balanceOf(treasury) >= treasuryBalance ? 0 : treasuryFee
        );
    }
}
