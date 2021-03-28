// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../VaultGauge.sol";
import "../interfaces/IManager.sol";

contract GaugeController {
    IManager public immutable manager;

    mapping(address => address) public vaultGauges;

    constructor(
        address _manager
    )
        public
    {
        manager = IManager(_manager);
    }

    function createGauge(
        address _vault,
        uint256 _totalReward
    )
        external
        onlyStrategist
    {
        require(manager.allowedVaults(_vault), "!allowedVaults");
        require(vaultGauges[_vault] == address(0), "!_vault");
        require(_totalReward > 0, "!_totalReward");
        VaultGauge _vg = new VaultGauge(address(manager), _totalReward);
        vaultGauges[_vault] = address(_vg);
        IERC20(manager.YAXIS()).transfer(address(_vg), _totalReward);
    }

    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
