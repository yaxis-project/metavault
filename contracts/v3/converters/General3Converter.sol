// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../interfaces/IConverter.sol';
import '../interfaces/IManager.sol';
import '../interfaces/ICurve3Pool.sol';

/**
 * @title General3Converter
 */
contract General3Converter is IConverter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IManager public immutable override manager;
    ICurve3Pool public immutable stableSwap3Pool;
    IERC20 public immutable tokenCRV; // 3Crv

    IERC20[3] public tokens;

    mapping(address => int128) internal indices;

    /**
     * @param _tokens A list of the address of the token in the Curve pool
     * @param _tokenCRV The address of the CRV token
     * @param _stableSwap3Pool The address of 3Pool
     * @param _manager The address of the Vault Manager
     */
    constructor(
        IERC20[] memory _tokens,
        IERC20 _tokenCRV,
        ICurve3Pool _stableSwap3Pool,
        IManager _manager
    ) public {
        require(_tokens.length == 3, 'Token count must be 3');

        tokenCRV = _tokenCRV;
        stableSwap3Pool = _stableSwap3Pool;
        manager = _manager;

        for (uint256 i = 0; i < _tokens.length; i++) {
            tokens[i] = _tokens[i];
            indices[address(_tokens[i])] = int128(i);
            _tokens[i].safeApprove(address(_stableSwap3Pool), type(uint256).max);
        }

        _tokenCRV.safeApprove(address(_stableSwap3Pool), type(uint256).max);
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    /**
     * @notice Called by the strategist to approve a token address to be spent by an address
     * @param _token The address of the token
     * @param _spender The address of the spender
     * @param _amount The amount to spend
     */
    function approveForSpender(
        IERC20 _token,
        address _spender,
        uint256 _amount
    ) external onlyStrategist {
        _token.safeApprove(_spender, _amount);
    }

    /**
     * @notice Allows the strategist to withdraw tokens from the converter
     * @dev This contract should never have any tokens in it at the end of a transaction
     * @param _token The address of the token
     * @param _amount The amount to withdraw
     * @param _to The address to receive the tokens
     */
    function recoverUnsupported(
        IERC20 _token,
        uint256 _amount,
        address _to
    ) external onlyStrategist {
        _token.safeTransfer(_to, _amount);
    }

    /**
     * AUTHORIZED-ONLY FUNCTIONS
     */

    /**
     * @notice Converts the amount of input tokens to output tokens
     * @param _input The address of the token being converted
     * @param _output The address of the token to be converted to
     * @param _inputAmount The input amount of tokens that are being converted
     * @param _estimatedOutput The estimated output tokens after converting
     */
    function convert(
        address _input,
        address _output,
        uint256 _inputAmount,
        uint256 _estimatedOutput
    ) external override onlyAuthorized returns (uint256 _outputAmount) {
        if (_output == address(tokenCRV)) {
            // convert to CRV
            uint256[3] memory amounts;
            for (uint8 i = 0; i < 3; i++) {
                if (_input == address(tokens[i])) {
                    amounts[i] = _inputAmount;
                    uint256 _before = tokenCRV.balanceOf(address(this));
                    stableSwap3Pool.add_liquidity(amounts, _estimatedOutput);
                    uint256 _after = tokenCRV.balanceOf(address(this));
                    _outputAmount = _after.sub(_before);
                    tokenCRV.safeTransfer(msg.sender, _outputAmount);
                    return _outputAmount;
                }
            }
        } else if (_input == address(tokenCRV)) {
            // convert from CRV
            for (uint8 i = 0; i < 3; i++) {
                if (_output == address(tokens[i])) {
                    uint256 _before = tokens[i].balanceOf(address(this));
                    stableSwap3Pool.remove_liquidity_one_coin(
                        _inputAmount,
                        i,
                        _estimatedOutput
                    );
                    uint256 _after = tokens[i].balanceOf(address(this));
                    _outputAmount = _after.sub(_before);
                    tokens[i].safeTransfer(msg.sender, _outputAmount);
                    return _outputAmount;
                }
            }
        } else {
            stableSwap3Pool.exchange(
                indices[_input],
                indices[_output],
                _inputAmount,
                _estimatedOutput
            );
            _outputAmount = IERC20(_output).balanceOf(address(this));
            IERC20(_output).safeTransfer(msg.sender, _outputAmount);
            return _outputAmount;
        }
        return 0;
    }

    /**
     * @notice Checks the amount of input tokens to output tokens
     * @param _input The address of the token being converted
     * @param _output The address of the token to be converted to
     * @param _inputAmount The input amount of tokens that are being converted
     */
    function expected(
        address _input,
        address _output,
        uint256 _inputAmount
    ) external view override returns (uint256) {
        if (_output == address(tokenCRV)) {
            // convert to CRV
            uint256[3] memory amounts;
            for (uint8 i = 0; i < 3; i++) {
                if (_input == address(tokens[i])) {
                    amounts[i] = _inputAmount;
                    return stableSwap3Pool.calc_token_amount(amounts, true);
                }
            }
        } else if (_input == address(tokenCRV)) {
            // convert from CRV
            for (uint8 i = 0; i < 3; i++) {
                if (_output == address(tokens[i])) {
                    // @dev this is for UI reference only, the actual share price
                    // (stable/CRV) will be re-calculated on-chain when we do convert()
                    return stableSwap3Pool.calc_withdraw_one_coin(_inputAmount, i);
                }
            }
        } else {
            return stableSwap3Pool.get_dy(indices[_input], indices[_output], _inputAmount);
        }
        return 0;
    }

    /**
     * MODIFIERS
     */

    /**
     * @dev Throws if not called by an allowed vault, controller, or strategy
     */
    modifier onlyAuthorized() {
        require(
            manager.allowedVaults(msg.sender) ||
                manager.allowedControllers(msg.sender) ||
                manager.allowedStrategies(msg.sender),
            '!authorized'
        );
        _;
    }

    /**
     * @dev Throws if not called by the strategist
     */
    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), '!strategist');
        _;
    }
}
