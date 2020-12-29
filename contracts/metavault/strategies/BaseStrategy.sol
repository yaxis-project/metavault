// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/Uniswap.sol";

import "../IStableSwap3Pool.sol";
import "../IVaultManager.sol";
import "../IStrategy.sol";
import "../IController.sol";

abstract contract BaseStrategy is IStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 public constant ONE_HUNDRED_PERCENT = 10000;

    address public immutable override want;
    address public immutable weth;
    address public controller;
    IVaultManager public vaultManager;
    Uni public unirouter = Uni(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    constructor(
        address _controller,
        address _vaultManager,
        address _want,
        address _weth
    ) public {
        want = _want;
        controller = _controller;
        vaultManager = IVaultManager(_vaultManager);
        weth = _weth;
        IERC20(_weth).safeApprove(address(unirouter), type(uint256).max);
    }

    /**
     * GOVERNANCE-ONLY FUNCTIONS
     */

    function approveForSpender(IERC20 _token, address _spender, uint256 _amount) external {
        require(msg.sender == vaultManager.governance(), "!governance");
        _token.safeApprove(_spender, _amount);
    }

    function setController(address _controller) external {
        require(msg.sender == vaultManager.governance(), "!governance");
        controller = _controller;
    }

    function setUnirouter(Uni _unirouter) external {
        require(msg.sender == vaultManager.governance(), "!governance");
        unirouter = _unirouter;
    }

    /**
     * AUTHORIZED-ONLY FUNCTIONS
     */

    function deposit() external override onlyAuthorized {
        _deposit();
    }

    function skim() external override onlyAuthorized {
        IERC20(want).safeTransfer(controller, balanceOfWant());
    }

    // Controller only function for creating additional rewards from dust
    function withdraw(address _asset) external override onlyAuthorized {
        require(want != _asset, "want");

        IERC20 _assetToken = IERC20(_asset);
        uint256 _balance = _assetToken.balanceOf(address(this));
        _assetToken.safeTransfer(controller, _balance);
    }

    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint256 _amount) external override onlyAuthorized {
        uint256 _balance = balanceOfWant();
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, _amount);
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external override onlyAuthorized returns (uint256 _balance) {
        _withdrawAll();

        _balance = balanceOfWant();

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, _balance);
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    function balanceOf() external override view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    /**
     * PUBLIC VIEW FUNCTIONS
     */

    function balanceOfPool() public view override virtual returns (uint256);

    function balanceOfWant() public view override returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    /**
     * INTERNAL FUNCTIONS
     */

    function _deposit() internal virtual;

    function _payHarvestFees(
        address _poolToken
    ) internal returns (uint256 _wethBal) {
        uint256 _amount = IERC20(_poolToken).balanceOf(address(this));
        _swapTokens(_poolToken, weth, _amount);
        _wethBal = IERC20(weth).balanceOf(address(this));

        if (_wethBal > 0) {
            // get all the necessary variables in a single call
            (
                address yax,
                address stakingPool,
                uint256 stakingPoolShareFee,
                address treasury,
                uint256 treasuryFee
            ) = vaultManager.getHarvestFeeInfo();

            // pay the staking pool with YAX
            if (stakingPoolShareFee > 0 && stakingPool != address(0)) {
                uint256 _stakingPoolShareFee = _wethBal.mul(stakingPoolShareFee).div(ONE_HUNDRED_PERCENT);
                _swapTokens(weth, yax, _stakingPoolShareFee);
                IERC20(yax).safeTransfer(stakingPool, IERC20(yax).balanceOf(address(this)));
            }

            // pay the treasury with YAX
            if (treasuryFee > 0 && treasury != address(0)) {
                uint256 _treasuryFee = _wethBal.mul(treasuryFee).div(ONE_HUNDRED_PERCENT);
                _swapTokens(weth, yax, _treasuryFee);
                IERC20(yax).safeTransfer(treasury, IERC20(yax).balanceOf(address(this)));
            }

            // return the remaining WETH balance
            _wethBal = IERC20(weth).balanceOf(address(this));
        }
    }

    function _swapTokens(address _input, address _output, uint256 _amount) internal {
        address[] memory path = new address[](2);
        path[0] = _input;
        path[1] = _output;
        unirouter.swapExactTokensForTokens(_amount, 1, path, address(this), now.add(1800));
    }

    function _withdraw(uint256 _amount) internal virtual;

    function _withdrawAll() internal virtual;

    function _withdrawSome(uint256 _amount) internal returns (uint256) {
        uint256 _before = IERC20(want).balanceOf(address(this));
        _withdraw(_amount);
        uint256 _after = IERC20(want).balanceOf(address(this));
        _amount = _after.sub(_before);

        return _amount;
    }

    /**
     * MODIFIERS
     */

    modifier onlyAuthorized() {
        require(msg.sender == controller
             || msg.sender == vaultManager.strategist()
             || msg.sender == vaultManager.governance(),
             "!authorized"
        );
        _;
    }
}
