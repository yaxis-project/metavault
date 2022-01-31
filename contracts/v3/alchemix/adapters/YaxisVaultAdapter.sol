// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import 'hardhat/console.sol';

import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';

import {IDetailedERC20} from '../interfaces/IDetailedERC20.sol';
import {IVaultAdapter} from '../interfaces/IVaultAdapter.sol';
import {IVault} from '../../interfaces/IVault.sol';

/// @title YaxisVaultAdapter
///
/// @dev A vault adapter implementation which wraps a yAxis vault.
contract YaxisVaultAdapter is IVaultAdapter {
    using SafeERC20 for IDetailedERC20;
    using SafeMath for uint256;

    /// @dev The vault that the adapter is wrapping.
    IVault public immutable vault;

    /// @dev The address which has admin control over this contract.
    address public immutable admin;

    /// @dev The token that the vault accepts
    IDetailedERC20 public immutable override token;

    constructor(IVault _vault, address _admin) public {
        require(_admin != address(0), 'YaxisVaultAdapter: admin address cannot be 0x0.');

        vault = _vault;
        admin = _admin;
        IDetailedERC20 _token = IDetailedERC20(_vault.getToken());
        token = _token;
        _token.safeApprove(address(_vault), uint256(-1));
    }

    /// @dev Gets the total value of the assets that the adapter holds in the vault.
    ///
    /// @return the total assets.
    function totalValue() external view override returns (uint256) {
        return _sharesToTokens(IDetailedERC20(vault.getLPToken()).balanceOf(address(this)));
    }

    /// @dev Deposits tokens into the vault.
    ///
    /// @param _amount the amount of tokens to deposit into the vault.
    function deposit(uint256 _amount) external override {
        vault.deposit(_amount);
    }

    /// @dev Withdraws tokens from the vault to the recipient.
    ///
    /// This function reverts if the caller is not the admin.
    ///
    /// @param _recipient the account to withdraw the tokes to.
    /// @param _amount    the amount of tokens to withdraw.
    function withdraw(address _recipient, uint256 _amount) external override {
        require(admin == msg.sender, 'YaxisVaultAdapter: only admin');

        IDetailedERC20 _token = token;
        uint256 beforeBalance = _token.balanceOf(address(this));

        vault.withdraw(_tokensToShares(_amount));

        _token.safeTransfer(_recipient, _token.balanceOf(address(this)) - beforeBalance);
    }

    /// @dev Computes the number of tokens an amount of shares is worth.
    ///
    /// @param _sharesAmount the amount of shares.
    ///
    /// @return the number of tokens the shares are worth.

    function _sharesToTokens(uint256 _sharesAmount) internal view returns (uint256) {
        return _sharesAmount.mul(vault.getPricePerFullShare()).div(1e18);
    }

    /// @dev Computes the number of shares an amount of tokens is worth.
    ///
    /// @param _tokensAmount the amount of shares.
    ///
    /// @return the number of shares the tokens are worth.
    function _tokensToShares(uint256 _tokensAmount) internal view returns (uint256) {
        return _tokensAmount.mul(1e18).div(vault.getPricePerFullShare());
    }
}
