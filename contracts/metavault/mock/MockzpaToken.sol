// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../../interfaces/Stabilize.sol";

contract MockzpaToken is ERC20, zpaToken {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public override underlyingAsset;

    constructor(
        string memory _name,
        string memory _symbol,
        address _underlyingAsset
    )
        public
        ERC20(_name, _symbol)
    {
        underlyingAsset = _underlyingAsset;
    }

    function deposit(uint256 _amount) external override {
        uint256 _toMint = _amount.mul(1e18).div(getExchangeRate());
        IERC20(underlyingAsset).safeTransferFrom(msg.sender, address(this), _amount);
        _mint(_account, _toMint);
    }

    function redeem(uint256 _amount) external override {
        uint256 _underlyingAmount = _amount.mul(getExchangeRate()).div(1e18);
        _burn(_account, _amount);
        IERC20(underlyingAsset).safeTransfer(msg.sender, _underlyingAmount);
    }

    function pricePerToken() external view override returns (uint256) {
        
    }

    function calculateWithdrawFee() external view override returns (uint256) {
        
    }
}
