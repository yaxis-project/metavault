// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IController.sol";
import "../interfaces/ILegacyVault.sol";
import "../interfaces/IManager.sol";
import "../interfaces/IVault.sol";

contract LegacyController {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant MAX = 10000;

    IManager public immutable manager;
    IERC20 public immutable token;
    IVault public immutable vault;
    address public immutable metavault;

    address[] public tokens;
    uint256[] public amounts;

    /**
     * @param _manager The vault manager contract
     * @param _metavault The legacy MetaVault contract
     */
    constructor(
        address _manager,
        address _metavault
    )
        public
    {
        manager = IManager(_manager);
        metavault = _metavault;
        address _token = ILegacyVault(_metavault).want();
        address _vault = IManager(_manager).vaults(_token);
        token = IERC20(_token);
        vault = IVault(_vault);
        tokens.push(_token);
        IERC20(_token).safeApprove(_vault, type(uint256).max);
        IERC20(_vault).safeApprove(_vault, type(uint256).max);
    }

    function balanceOf(
        address _token
    )
        external
        view
        onlyToken(_token)
        returns (uint256)
    {
        return token.balanceOf(address(this));
    }

    function withdrawFee(
        address _token,
        uint256 _amount
    )
        external
        view
        onlyToken(_token)
        returns (uint256)
    {
        uint256 _withdrawalProtectionFee = manager.withdrawalProtectionFee();
        if (_withdrawalProtectionFee > 0) {
            uint256 _withdrawalProtection = _amount.mul(_withdrawalProtectionFee).div(MAX);
            return _amount.sub(_withdrawalProtection);
        }
        return 0;
    }

    function investEnabled()
        external
        view
        returns (bool)
    {
        IController _controller = IController(manager.controllers(address(vault)));
        return _controller.investEnabled();
    }

    function withdraw(
        address _token,
        uint256 _amount
    )
        external
        onlyMetaVault
    {
        vault.withdraw(_amount, _token);
    }

    function earn(
        address _token,
        uint256 _amount
    )
        external
        onlyMetaVault
        onlyToken(_token)
    {
        amounts[0] = _amount;
        vault.deposit(tokens, amounts);
    }

    modifier onlyMetaVault() {
        require(msg.sender == metavault, "!metavault");
        _;
    }

    modifier onlyToken(address _token) {
        require(_token == address(token), "!_token");
        _;
    }
}
