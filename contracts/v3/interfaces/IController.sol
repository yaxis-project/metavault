// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IManager.sol";

interface IController {
    function balanceOf() external view returns (uint256);
    function earn(address _strategy, address _token, uint256 _amount) external;
    function investEnabled() external view returns (bool);
    function harvestStrategy(address _strategy) external;
    function manager() external view returns (IManager);
    function strategies() external view returns (uint256);
    function withdraw(address _token, uint256 _amount) external;
    function withdrawAll(address _strategy) external;
}
