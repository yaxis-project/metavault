// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IAave {
    function deposit(
        address,
        uint256,
        address,
        uint16
    ) external;
    
    function withdraw(
        address,
        uint256,
        address
    ) external;
}

interface IAaveRewards {
    function claimRewards(
        address[] memory,
        uint256,
        address
    ) external;
}
