// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IsYAX.sol";

contract Swap {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public immutable YAXIS;
    IERC20 public immutable YAX;
    IERC20 public immutable SYAX;

    constructor(
        address _yaxis,
        address _yax,
        address _syax
    )
        public
    {
        YAXIS = IERC20(_yaxis);
        YAX = IERC20(_yax);
        SYAX = IERC20(_syax);
    }

    function swap()
        external
    {
        uint256 _amount = YAX.balanceOf(msg.sender);
        if (_amount > 0) {
            YAX.safeTransferFrom(msg.sender, address(this), _amount);
            YAXIS.safeTransfer(msg.sender, _amount);
        }
        _amount = SYAX.balanceOf(msg.sender);
        if (_amount > 0) {
            SYAX.safeTransferFrom(msg.sender, address(this), _amount);
            uint256 _balance = YAX.balanceOf(address(this));
            IsYAX(address(SYAX)).exit();
            _balance = YAX.balanceOf(address(this)).sub(_balance);
            YAXIS.safeTransfer(msg.sender, _balance);
        }
    }
}
