// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface IGauge {
    function deposit(uint) external;
    function balanceOf(address) external view returns (uint);
    function withdraw(uint) external;
    function claimable_tokens(address) external view returns (uint);
    function claimable_reward_write(address, address) external view returns (uint);
    function claim_rewards(address) external;
}

interface Mintr {
    function mint(address) external;
}
