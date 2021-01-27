// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/YVaultV2.sol";
import "../IConverter.sol";
import "./BaseStrategy.sol";

contract StrategyYVaultV2 is BaseStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public yVaultV2;
    IConverter public converter;

    constructor(
        string memory _name,
        address _yVaultV2,
        address _converter,
        address _controller,
        address _vaultManager,
        address _weth,
        address _router
    )
        public
        BaseStrategy(
            _name,
            _controller,
            _vaultManager,
            IYVaultV2(_yVaultV2).token(),
            _weth,
            _router
        )
    {
        yVaultV2 = _yVaultV2;
        converter = IConverter(_converter);
        IERC20(IYVaultV2(_yVaultV2).token()).safeApprove(_yVaultV2, type(uint256).max);
    }

    function balanceOfPool() public view override returns (uint256) {
        uint256 balance = IERC20(yVaultV2).balanceOf(address(this));
        return balance.mul(IYVaultV2(yVaultV2).pricePerShare()).div(1e18);
    }

    function _deposit() internal override {
        uint256 balance = balanceOfWant();
        if (balance > 0) {
            IYVaultV2(yVaultV2).deposit(balance);
        }
    }

    function _harvest() internal override {
        return;
    }

    function _withdraw(uint256 _amount) internal override {
        _amount = _amount.mul(1e18).div(IYVaultV2(yVaultV2).pricePerShare());
        IYVaultV2(yVaultV2).withdraw(_amount);

        _amount = balanceOfWant();
        if (_amount > 0) {
            _convert(want, _vaultWant(), _amount);
        }
    }

    function _withdrawAll() internal override {
        uint256 balance = IERC20(yVaultV2).balanceOf(address(this));
        if (balance > 0) {
            IYVaultV2(yVaultV2).withdraw(balance);
            balance = balanceOfWant();
            _convert(want, _vaultWant(), balance);
        }
    }

    function _convert(address _from, address _to, uint256 _amount) internal {
        require(converter.convert_rate(_from, _to, _amount) > 0, "!convert_rate");
        IERC20(_from).safeTransfer(address(converter), _amount);
        converter.convert(_from, _to, _amount);
    }
}
