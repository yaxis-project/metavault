// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IController {
    function balanceOf() external view returns (uint256);
    function earn(address _token, uint256 _amount) external;
    function investEnabled() external view returns (bool);
    function harvestStrategy(address _strategy) external;
    function strategies() external view returns (uint256);
    function withdraw(address _token, uint256 _amount) external;
    function withdrawAll(address _strategy) external;
}
