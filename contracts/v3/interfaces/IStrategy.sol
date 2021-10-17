// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IManager.sol";
import "./ISwap.sol";
import "./IStableSwapPool.sol";
import "./IConvexVault.sol";

interface IStrategy {
    function balanceOf() external view returns (uint256);
    function balanceOfPool() external view returns (uint256);
    function balanceOfWant() external view returns (uint256);
    function crv3() external view returns (address);
    function crv() external view returns (address);
    function crvRewards() external view returns (IConvexRewards);
    function cvx() external view returns (address);
    function deposit() external;
    function getMostPremium() external view returns (address, uint256);
    function harvest(uint256, uint256, uint256, uint256[] memory, uint256, uint256) external;
    function manager() external view returns (IManager);
    function name() external view returns (string memory);
    function router() external view returns (ISwap);
    function skim() external;
    function stableSwapPool() external view returns (IStableSwapPool);
    function want() external view returns (address);
    function weth() external view returns (address);
    function withdraw(address) external;
    function withdraw(uint256) external;
    function withdrawAll() external;
}
