// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/ICanonicalVault.sol";

contract Depositor {
    using SafeERC20 for IERC20;

    ICanonicalVault immutable vault;

    constructor(
        address _vault
    )
        public
    {
        vault = ICanonicalVault(_vault);
    }

    function depositVault(
        address _token,
        uint256 _amount
    )
        external
    {
        IERC20(_token).safeApprove(address(vault), 0);
        IERC20(_token).safeApprove(address(vault), _amount);
        vault.deposit(_token, _amount);
    }

    function depositAllVault(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    )
        external
    {
        for (uint8 i = 0; i < _amounts.length; i++) {
            IERC20(_tokens[i]).safeApprove(address(vault), 0);
            IERC20(_tokens[i]).safeApprove(address(vault), _amounts[i]);
        }
        vault.depositAll(_tokens, _amounts);
    }

    function withdrawVault(
        uint256 _amount,
        address _token
    )
        external
    {
        IERC20(address(vault)).safeApprove(address(vault), 0);
        IERC20(address(vault)).safeApprove(address(vault), _amount);
        vault.withdraw(_amount, _token);
    }

    function withdrawAllvault(
        address _token
    )
        external
    {
        IERC20(address(vault)).safeApprove(address(vault), 0);
        IERC20(address(vault)).safeApprove(address(vault), IERC20(address(vault)).balanceOf(address(this)));
        vault.withdrawAll(_token);
    }
}
