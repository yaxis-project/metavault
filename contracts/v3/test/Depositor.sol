// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IVault.sol";

contract Depositor {
    using SafeERC20 for IERC20;

    IVault immutable vault;

    constructor(
        address _vault
    )
        public
    {
        vault = IVault(_vault);
    }

    function depositVault(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    )
        external
    {
        for (uint8 i = 0; i < _amounts.length; i++) {
            IERC20(_tokens[i]).safeApprove(address(vault), 0);
            IERC20(_tokens[i]).safeApprove(address(vault), _amounts[i]);
        }
        vault.deposit(_tokens, _amounts);
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
