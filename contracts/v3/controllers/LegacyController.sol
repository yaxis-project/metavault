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

    bool public investEnabled;
    IVault public vault;
    IConverter public converter;

    address[] public tokens;
    uint256[] public amounts;

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
        return manager.withdrawalProtectionFee().mul(_amount).div(MAX);
    }

    function withdraw(
        address _token,
        uint256 _amount
    )
        external
        onlyEnabledVault
        onlyMetaVault
        onlyToken(_token)
    {
        uint256 _balance = token.balanceOf(address(this));
        // happy path exits without calling back to the vault
        if (_balance <= _amount) {
            token.safeTransfer(metavault, _amount);
        } else {
            // convert to vault shares
            address[] memory _tokens = vault.getTokens();
            require(_tokens.length > 0, "!_tokens");
            bool _exit;
            uint256 _expected;
            uint256 _shares;
            for (uint8 i; i < _tokens.length; i++) {
                // convert the amount of 3CRV to the expected amount of stablecoin
                _expected = converter.expected(address(token), _tokens[i], _amount);
                _shares = _expected.mul(1e18).div(vault.getPricePerFullShare());
                // another happy path is if the vault has enough balance of the token
                if (IERC20(_tokens[i]).balanceOf(address(vault)) >= _expected) {
                    vault.withdraw(_shares, _tokens[i]);
                    _balance = IERC20(_tokens[i]).balanceOf(address(this));
                    IERC20(_tokens[i]).safeTransfer(address(converter), _balance);
                    converter.convert(_tokens[i], address(token), _balance, 1);
                    _exit = true;
                    break;
                }
            }
            // worst-case scenario nothing had enough balance so we'll have to do an
            // expensive withdraw from a strategy using the last token of the vault
            if (!_exit) {
                _token = _tokens[_tokens.length - 1];
                vault.withdraw(_shares, _token);
                _balance = IERC20(_token).balanceOf(address(this));
                IERC20(_token).safeTransfer(address(converter), _balance);
                converter.convert(_token, address(token), _balance, 1);
            }
            token.safeTransfer(metavault, _amount);
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

    function convertAndDeposit(
        address _toToken,
        uint256 _expected
    )
        external
        onlyEnabledConverter
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
