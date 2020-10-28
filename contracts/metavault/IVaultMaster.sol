// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IVaultMaster {
    function yax() external view returns (address);
    function vaults(address) external view returns (bool);
    function controllers(address) external view returns (bool);
    function strategies(address) external view returns (bool);
    function stakingPool() external view returns (address);
    function profitSharer() external view returns (address);
    function treasuryWallet() external view returns (address);
    function performanceReward() external view returns (address);
    function stakingPoolShareFee() external view returns (uint);
    function gasFee() external view returns (uint);
    function insuranceFee() external view returns (uint);
    function withdrawalProtectionFee() external view returns (uint);
}
