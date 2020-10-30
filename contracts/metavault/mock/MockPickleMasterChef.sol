// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IERC20 {
    function totalSupply() external view returns (uint);
    function balanceOf(address account) external view returns (uint);
    function transfer(address recipient, uint amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint);
    function approve(address spender, uint amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract MockPickleMasterChef {
    IERC20 public pickleToken;
    IERC20 public lpToken;

    struct UserInfo {
        uint amount; // How many LP tokens the user has provided.
        uint rewardDebt; // Reward debt. See explanation below.
    }

    mapping(uint => mapping(address => UserInfo)) public userInfo;

    constructor(IERC20 _pickleToken, IERC20 _lpToken) public {
        pickleToken = _pickleToken;
        lpToken = _lpToken;
    }

    function deposit(uint _pid, uint _amount) external {
        lpToken.transferFrom(msg.sender, address(this), _amount);
        UserInfo storage user = userInfo[_pid][msg.sender];
        pickleToken.transfer(msg.sender, user.amount / 10); // always get 10% of deposited amount
        user.amount = user.amount + _amount;
    }

    function withdraw(uint _pid, uint _amount) external {
        lpToken.transfer(msg.sender, _amount);
        UserInfo storage user = userInfo[_pid][msg.sender];
        pickleToken.transfer(msg.sender, user.amount / 10); // always get 10% of deposited amount
        user.amount = user.amount - _amount;
    }

    function pendingPickle(uint, address) external view returns (uint) {
        return pickleToken.balanceOf(address(this)) / 10;
    }

    function emergencyWithdraw(uint _pid) external {
        UserInfo storage user = userInfo[_pid][msg.sender];
        lpToken.transfer(msg.sender, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }
}
