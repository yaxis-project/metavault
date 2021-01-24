// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../interfaces/FlamIncome.sol";
import "../IConverter.sol";
import "./BaseStrategy.sol";

contract StrategyFlamIncome is BaseStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public vault;
    IConverter public converter;

    /**
     * @param _vault The address of the vault
     * @param _converter The address of the converter
     * @param _controller The address of the controller
     * @param _vaultManager The address of the vaultManager
     * @param _weth The address of WETH
     * @param _router The address of the router for swapping tokens
     */
    constructor(
        address _vault,
        address _converter,
        address _controller,
        address _vaultManager,
        address _weth,
        address _router
    )
        public
        BaseStrategy(
            string(abi.encodePacked("FlamIncome: ", ERC20(IVault(_vault).token()).symbol())),
            _controller,
            _vaultManager,
            IVault(_vault).token(),
            _weth,
            _router
        )
    {
        vault = _vault;
        converter = IConverter(_converter);
        IERC20(IVault(_vault).token()).safeApprove(_vault, type(uint256).max);
    }

    function _deposit() internal override virtual {
        uint256 _amount = balanceOfWant();
        if (_amount > 0) {
            IVault(vault).deposit(_amount);
        }
    }

    function _harvest() internal override {
        // Harvest is not necessary in the vault
        return;
    }

    function _withdraw(uint256 _amount) internal override virtual {
        _amount = _amount.mul(1e18).div(priceE18());
        IVault(vault).withdraw(_amount);
        _amount = balanceOfWant();
        if (_amount > 0) {
            _convert(want, _vaultWant(), _amount);
        }
    }

    function _withdrawAll() internal override virtual {
        uint _amount = IERC20(vault).balanceOf(address(this));
        if (_amount > 0) {
            IVault(vault).withdrawAll();
            _amount = balanceOfWant();
            _convert(want, _vaultWant(), _amount);
        }
    }

    function balanceOfPool() public view override virtual returns (uint256) {
        if (ERC20(vault).totalSupply() == 0) return 0;

        uint shares = IERC20(vault).balanceOf(address(this));
        uint balance = shares.mul(priceE18());
        return balance.div(1e18);
    }

    function _convert(address _from, address _to, uint256 _amount) internal {
        require(converter.convert_rate(_from, _to, _amount) > 0, "!convert_rate");
        IERC20(_from).safeTransfer(address(converter), _amount);
        converter.convert(_from, _to, _amount);
    }

    function priceE18() public view returns (uint) {
        return IVault(vault).priceE18();
    }
}
