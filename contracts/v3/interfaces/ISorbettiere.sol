// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface ISorbettiere {
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 remainingIceTokenReward;
    }
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function pendingIce(uint256 _pid, address _user) external view returns (uint256);
    function userInfo(uint256, address) external view returns (UserInfo memory);
}
