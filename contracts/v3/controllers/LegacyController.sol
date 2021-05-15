// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";
import "../interfaces/ILegacyController.sol";
import "../interfaces/ILegacyVault.sol";
import "../interfaces/IManager.sol";
import "../interfaces/IVault.sol";

contract LegacyController is ILegacyController {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant MAX = 10000;

    IManager public immutable manager;
    IERC20 public immutable token;
    address public immutable metavault;

    bool public investEnabled;
    IVault public vault;
    IConverter public converter;

    event Earn(uint256 amount);
    event Withdraw(uint256 amount);

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

    function setInvestEnabled(
        bool _investEnabled
    )
        external
        onlyStrategist
    {
        investEnabled = _investEnabled;
    }

    function recoverUnsupportedToken(
        address _token,
        address _receiver
    )
        external
        onlyStrategist
    {
        require(_token != address(token), "!_token");
        IERC20(_token).safeTransfer(_receiver, IERC20(_token).balanceOf(address(this)));
    }

    function balanceOf(
        address _token
    )
        external
        view
        onlyToken(_token)
        returns (uint256)
    {
        return token.balanceOf(address(this))
                    .add(IERC20(address(vault)).balanceOf(address(this)));
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
        return manager.withdrawalProtectionFee().mul(_amount).div(MAX);
    }

    function withdraw(
        address,
        uint256 _amount
    )
        external
        onlyEnabledVault
        onlyMetaVault
    {
        uint256 _balance = token.balanceOf(address(this));
        // happy path exits without calling back to the vault
        if (_balance >= _amount) {
            token.safeTransfer(metavault, _amount);
        } else {
            uint256 _toWithdraw = _amount.sub(_balance);
            // convert to vault shares
            address[] memory _tokens = vault.getTokens();
            require(_tokens.length > 0, "!_tokens");
            // get the amount of the token that we would be withdrawing
            uint256 _expected = converter.expected(address(token), _tokens[0], _toWithdraw);
            uint256 _shares = _expected.mul(1e18).div(vault.getPricePerFullShare());
            vault.withdraw(_shares, _tokens[0]);
            _balance = IERC20(_tokens[0]).balanceOf(address(this));
            IERC20(_tokens[0]).safeTransfer(address(converter), _balance);
            // TODO: calculate expected
            converter.convert(_tokens[0], address(token), _balance, 1);
            token.safeTransfer(metavault, token.balanceOf(address(this)));
        }
        emit Withdraw(_amount);
    }

    function earn(
        address,
        uint256 _amount
    )
        external
        onlyMetaVault
    {
        emit Earn(_amount);
    }

    function legacyDeposit(
        address _toToken,
        uint256 _expected
    )
        external
        override
        onlyEnabledConverter
        onlyHarvester
    {
        if (_toToken != address(token)) {
            uint256 _amount = token.balanceOf(address(this));
            token.safeTransfer(address(converter), _amount);
            converter.convert(address(token), _toToken, _amount, _expected);
        }
        IERC20(_toToken).safeApprove(address(vault), 0);
        IERC20(_toToken).safeApprove(address(vault), type(uint256).max);
        vault.deposit(_toToken, IERC20(_toToken).balanceOf(address(this)));
    }

    modifier onlyEnabledConverter() {
        require(address(converter) != address(0), "!converter");
        _;
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
