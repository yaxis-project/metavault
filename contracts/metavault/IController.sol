// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IController {
    function vaults(address) external view returns (address);
    function want(address) external view returns (address);
    function balanceOf(address) external view returns (uint);
    function withdraw(address, uint) external;
    function earn(address, uint) external;
    function withdrawFee(address, uint) external view returns (uint); // pJar: 0.5% (50/10000)
    function investEnabled() external view returns (bool);
    // note that some strategies do not allow controller to harvest
    function harvestStrategy(address _strategy) external;
}
