// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

interface IStableSwapPool {
    function coins(int128) external view returns (address);
    function get_virtual_price() external view returns (uint);
}
