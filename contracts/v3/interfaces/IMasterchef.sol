// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IMasterchef {
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }
    struct PoolInfo {
        address lpToken;
        uint256 accJoePerShare;
        uint256 lastRewardTimestamp;
        uint256 allocPoint;
        address rewarder;
    }
    function userInfo(uint256 pid, address user) external view returns (UserInfo calldata);
    function deposit(uint256 pid, uint256 amount) external;
    function withdraw(uint256 pid, uint256 amount) external;
    function poolInfo(uint256 pid) external view returns (PoolInfo calldata);
}

interface IBonusRewards {
    function rewardToken() external view returns (address);
}
