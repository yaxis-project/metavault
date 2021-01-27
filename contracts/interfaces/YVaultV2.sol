// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface IYVaultV2 {
    function token() external view returns (address);
    function pricePerShare() external view returns (uint256);
    function deposit(uint256) external returns (uint256);
    function withdraw(uint256) external returns (uint256);
}
