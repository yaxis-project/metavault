// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../../interfaces/PickleJar.sol";
import "./MockERC20.sol";

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

contract MockPickleJar is MockERC20 {
    IERC20 public t3crv;
    IERC20 public lpToken;

    constructor(IERC20 _t3crv) public MockERC20("pickling Curve.fi DAI/USDC/USDT", "p3Crv", 18) {
        t3crv = _t3crv;
    }

    function balance() public view returns (uint) {
        return t3crv.balanceOf(address(this));
    }

    function available() external view returns (uint) {
        return balance() * 9500 / 10000;
    }

    function depositAll() external {
        deposit(t3crv.balanceOf(msg.sender));
    }

    function deposit(uint _amount) public {
        t3crv.transferFrom(msg.sender, address(this), _amount);
        uint256 shares = _amount * 1000000000000000000 / getRatio();
        _mint(msg.sender, shares);
    }

    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    function withdraw(uint _shares) public {
        uint256 r = _shares * getRatio() / 1000000000000000000;
        _burn(msg.sender, _shares);
        t3crv.transfer(msg.sender, r);
    }

    function getRatio() public pure returns (uint) {
        return 1010000000000000000; // +1%
    }
}
