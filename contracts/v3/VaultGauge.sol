// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./interfaces/IManager.sol";

contract VaultGauge {
    IManager public immutable manager;

    uint256 public rewardBalance;

    constructor(
        address _manager,
        uint256 _reward
    )
        public
    {
        manager = IManager(_manager);
        rewardBalance = _reward;
    }
}
