// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";
import "../interfaces/ILegacyVault.sol";
import "../interfaces/IManager.sol";
import "../interfaces/IVault.sol";

contract LegacyController {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant MAX = 10000;

    IManager public immutable manager;
    IERC20 public immutable token;
    address public immutable metavault;

    IVault public vault;
    IConverter public converter;

    address[] public tokens;
    uint256[] public amounts;

    event Earn();

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
        token = IERC20(_token);
    }

    function setVault(
        address _vault
    )
        external
        onlyStrategist
    {
        if (address(vault) != address(0)) {
            vault.withdrawAll(address(token));
            token.safeTransfer(metavault, token.balanceOf(address(this)));
        }
        vault = IVault(_vault);
    }

    function setConverter(
        address _converter
    )
        external
        onlyStrategist
    {
        converter = IConverter(_converter);
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
        onlyEnabledVault
        onlyMetaVault
    {
        vault.withdraw(_amount, _token);
    }

    function earn(
        address,
        uint256
    )
        external
    {
        emit Earn();
    }

    function convertAndDeposit(
        address _toToken,
        uint256 _expected
    )
        external
        onlyHarvester
    {
        uint256 _amount = token.balanceOf(address(this));
        token.safeTransfer(address(converter), _amount);
        converter.convert(address(token), _toToken, _amount, _expected);
        IERC20(_toToken).safeApprove(address(vault), 0);
        IERC20(_toToken).safeApprove(address(vault), type(uint256).max);
        tokens[0] = _toToken;
        amounts[0] = IERC20(_toToken).balanceOf(address(this));
        vault.deposit(tokens, amounts);
    }

    modifier onlyEnabledVault() {
        require(address(vault) != address(0), "!vault");
        _;
    }

    modifier onlyHarvester() {
        require(msg.sender == manager.harvester(), "!harvester");
        _;
    }

    modifier onlyMetaVault() {
        require(msg.sender == metavault, "!metavault");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }

    modifier onlyToken(address _token) {
        require(_token == address(token), "!_token");
        _;
    }
}
