// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IStrategy {
    function want() external view returns (address);
    function deposit() external;
    function withdraw(address) external;
    function withdraw(uint) external;
    function skim() external;
    function withdrawAll() external returns (uint);
    function balanceOf() external view returns (uint);
    function withdrawFee(uint) external view returns (uint); // pJar: 0.5% (50/10000)
}
