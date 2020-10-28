// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract MockPickleMasterChef {
    IERC20 public pickleToken;
    IERC20 public lpToken;

    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    constructor(IERC20 _pickleToken, IERC20 _lpToken) public {
        pickleToken = _pickleToken;
        lpToken = _lpToken;
    }

    function deposit(uint256 _pid, uint256 _amount) external {
        lpToken.transferFrom(msg.sender, address(this), _amount);
        if (_amount == 0) {
            // claim
            pickleToken.transfer(msg.sender, pickleToken.balanceOf(address(this)) / 10);
        }
        UserInfo storage user = userInfo[_pid][msg.sender];
        user.amount = user.amount + _amount;
    }

    function withdraw(uint256 _pid, uint256 _amount) external {
        lpToken.transfer(msg.sender, _amount);
        UserInfo storage user = userInfo[_pid][msg.sender];
        user.amount = user.amount - _amount;
    }

    function pendingPickle(uint, address) external view returns (uint) {
        return pickleToken.balanceOf(address(this)) / 10;
    }

    function emergencyWithdraw(uint) external {
        lpToken.transfer(msg.sender, lpToken.balanceOf(address(this)) / 10);
    }
}
