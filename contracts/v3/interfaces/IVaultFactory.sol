// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IManager.sol";

interface IVaultFactory {
    function manager() external view returns (IManager);
    function factoryCreated(address vault) external view returns (bool);
    function create(string calldata name, string calldata symbol) external;
}
