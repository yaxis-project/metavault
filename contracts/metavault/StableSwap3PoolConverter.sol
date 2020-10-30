// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./IConverter.sol";
import "./IVaultManager.sol";
import "./IStableSwap3Pool.sol";

contract StableSwap3PoolConverter is IConverter {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20[3] public tokens; // DAI, USDC, USDT
    IERC20 public token3CRV; // 3Crv

    address public governance;

    IStableSwap3Pool public stableSwap3Pool;
    IVaultManager public vaultManager;

    constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IStableSwap3Pool _stableSwap3Pool, IVaultManager _vaultManager) public {
        tokens[0] = _tokenDAI;
        tokens[1] = _tokenUSDC;
        tokens[2] = _tokenUSDT;
        token3CRV = _token3CRV;
        stableSwap3Pool = _stableSwap3Pool;
        tokens[0].safeApprove(address(stableSwap3Pool), uint(-1));
        tokens[1].safeApprove(address(stableSwap3Pool), uint(-1));
        tokens[2].safeApprove(address(stableSwap3Pool), uint(-1));
        token3CRV.safeApprove(address(stableSwap3Pool), uint(-1));
        vaultManager = _vaultManager;
        governance = msg.sender;
    }

    function setGovernance(address _governance) public {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setStableSwap3Pool(IStableSwap3Pool _stableSwap3Pool) public {
        require(msg.sender == governance, "!governance");
        stableSwap3Pool = _stableSwap3Pool;
        tokens[0].safeApprove(address(stableSwap3Pool), uint(-1));
        tokens[1].safeApprove(address(stableSwap3Pool), uint(-1));
        tokens[2].safeApprove(address(stableSwap3Pool), uint(-1));
        token3CRV.safeApprove(address(stableSwap3Pool), uint(-1));
    }

    function setVaultManager(IVaultManager _vaultManager) public {
        require(msg.sender == governance, "!governance");
        vaultManager = _vaultManager;
    }

    function approveForSpender(IERC20 _token, address _spender, uint _amount) external {
        require(msg.sender == governance, "!governance");
        _token.safeApprove(_spender, _amount);
    }

    function token() external override returns (address _share) {
        _share = address(token3CRV);
    }

    function convert(address _input, address _output, uint _inputAmount) external override returns (uint _outputAmount) {
        require(msg.sender == governance || vaultManager.vaults(msg.sender), "!(governance||vault)");
        if (_output == address(token3CRV)) { // convert to 3CRV
            uint[3] memory amounts;
            for (uint8 i = 0; i < 3; i++) {
                if (_input == address(tokens[i])) {
                    amounts[i] = _inputAmount;
                    uint _before = token3CRV.balanceOf(address(this));
                    stableSwap3Pool.add_liquidity(amounts, 1);
                    uint _after = token3CRV.balanceOf(address(this));
                    _outputAmount = _after.sub(_before);
                    token3CRV.safeTransfer(msg.sender, _outputAmount);
                    return _outputAmount;
                }
            }
        } else if (_input == address(token3CRV)) { // convert from 3CRV
            for (uint8 i = 0; i < 3; i++) {
                if (_output == address(tokens[i])) {
                    uint _before = tokens[i].balanceOf(address(this));
                    stableSwap3Pool.remove_liquidity_one_coin(_inputAmount, i, 1);
                    uint _after = tokens[i].balanceOf(address(this));
                    _outputAmount = _after.sub(_before);
                    tokens[i].safeTransfer(msg.sender, _outputAmount);
                    return _outputAmount;
                }
            }
        }
        return 0;
    }

    function convert_rate(address _input, address _output, uint _inputAmount) external override view returns (uint _outputAmount) {
        if (_output == address(token3CRV)) { // convert to 3CRV
            uint[3] memory amounts;
            for (uint8 i = 0; i < 3; i++) {
                if (_input == address(tokens[i])) {
                    amounts[i] = _inputAmount;
                    return stableSwap3Pool.calc_token_amount(amounts, true);
                }
            }
        } else if (_input == address(token3CRV)) { // convert from 3CRV
            for (uint8 i = 0; i < 3; i++) {
                if (_output == address(tokens[i])) {
                    // @dev this is for UI reference only, the actual share price (stable/CRV) will be re-calculated on-chain when we do convert()
                    return stableSwap3Pool.calc_withdraw_one_coin(_inputAmount, i);
                }
            }
        }
        return 0;
    }

    // 0: DAI, 1: USDC, 2: USDT
    function convert_stables(uint[3] calldata amounts) external override returns (uint _shareAmount) {
        require(msg.sender == governance || vaultManager.vaults(msg.sender), "!(governance||vault)");
        uint _before = token3CRV.balanceOf(address(this));
        stableSwap3Pool.add_liquidity(amounts, 1);
        uint _after = token3CRV.balanceOf(address(this));
        _shareAmount = _after.sub(_before);
        token3CRV.safeTransfer(msg.sender, _shareAmount);
    }

    function get_dy(int128 i, int128 j, uint dx) external override view returns (uint) {
        return stableSwap3Pool.get_dy(i, j, dx);
    }

    function exchange(int128 i, int128 j, uint dx, uint min_dy) external override returns (uint dy) {
        require(msg.sender == governance || vaultManager.vaults(msg.sender), "!(governance||vault)");
        IERC20 _output = tokens[uint8(j)];
        uint _before = _output.balanceOf(address(this));
        stableSwap3Pool.exchange(i, j, dx, min_dy);
        uint _after = _output.balanceOf(address(this));
        dy = _after.sub(_before);
        _output.safeTransfer(msg.sender, dy);
    }

    function calc_token_amount(uint[3] calldata amounts, bool deposit) external override view returns (uint _shareAmount) {
        _shareAmount = stableSwap3Pool.calc_token_amount(amounts, deposit);
    }

    function calc_token_amount_withdraw(uint _shares, address _output) external override view returns (uint) {
        for (uint8 i = 0; i < 3; i++) {
            if (_output == address(tokens[i])) {
                return stableSwap3Pool.calc_withdraw_one_coin(_shares, i);
            }
        }
        return 0;
    }

    function governanceRecoverUnsupported(IERC20 _token, uint _amount, address _to) external {
        require(msg.sender == governance, "!governance");
        _token.transfer(_to, _amount);
    }
}
