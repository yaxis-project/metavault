// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IGauge.sol";
import "../../interfaces/Balancer.sol";

import "../interfaces/ExtendedIERC20.sol";

import "./AvaxBaseStrategy.sol";

import '../interfaces/IHarvester.sol';
import '../interfaces/IStableSwap3Pool.sol';

contract av3CrvStrategy is AvaxBaseStrategy {
    // used for Crv -> wAVAX -> [dai/usdc/usdt] -> 3crv route
    address public immutable crv;

    // for add_liquidity via avax.curve.fi to get back 3CRV (use getMostPremium() for the best stable coin used in the route)
    address public immutable dai;
    address public immutable usdc;
    address public immutable usdt;

    IStableSwap3Pool public immutable stableSwap3Pool;
    IGauge public immutable gauge; // 3Crv Gauge

    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _wavax,
        address _dai,
        address _usdc,
        address _usdt,
        address _gauge,
        address _stableSwap3Pool,
        address _controller,
        address _manager,
        address[] memory _routerArray
    )
        public
        BaseStrategy(_name, _controller, _manager, _want, _wavax, _routerArray)
    {
        crv = _crv;
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        stableSwap3Pool = IStableSwap3Pool(_stableSwap3Pool);
        gauge = IGauge(_gauge);
        IERC20(_want).safeApprove(_gauge, type(uint256).max);
        IERC20(_crv).safeApprove(_routerArray[0], type(uint256).max);
        IERC20(_dai).safeApprove(_stableSwap3Pool, type(uint256).max);
        IERC20(_usdc).safeApprove(_stableSwap3Pool, type(uint256).max);
        IERC20(_usdt).safeApprove(_stableSwap3Pool, type(uint256).max);
        IERC20(_want).safeApprove(_stableSwap3Pool, type(uint256).max);
    }

    function _deposit()
        internal
        override
    {
        uint256 _wantBal = balanceOfWant();
        if (_wantBal > 0) {
            // deposit [want] to Gauge
            gauge.deposit(_wantBal);
        }
    }

    function _claimReward()
        internal
    {
        gauge.claim_rewards(address(this));
    }

    function _addLiquidity(uint256 _estimate)
        internal
    {
        uint256[3] memory amounts;
        amounts[0] = IERC20(dai).balanceOf(address(this));
        amounts[1] = IERC20(usdc).balanceOf(address(this));
        amounts[2] = IERC20(usdt).balanceOf(address(this));
        stableSwap3Pool.add_liquidity(amounts, _estimate, true);
    }

    function getMostPremium()
        public
        view
        returns (address, uint256)
    {
        uint daiBalance = stableSwap3Pool.balances(0);
        // USDC - Supports a change up to the 18 decimal standard
        uint usdcBalance = stableSwap3Pool.balances(1).mul(10**18).div(10**(ExtendedIERC20(usdc).decimals()));
        uint usdtBalance = stableSwap3Pool.balances(2).mul(10**12);

        if (daiBalance <= usdcBalance && daiBalance <= usdtBalance) {
            return (dai, 0);
        }

        if (usdcBalance <= daiBalance && usdcBalance <= usdtBalance) {
            return (usdc, 1);
        }

        if (usdtBalance <= daiBalance && usdtBalance <= usdcBalance) {
            return (usdt, 2);
        }

        return (dai, 0); // If they're somehow equal, we just want DAI
    }

    function _harvest(
        uint256[] calldata _estimates
    )
        internal
        override
    {
        _claimReward();
        uint256 _remainingWavax = _payHarvestFees(crv, _estimates[0], 0);

        if (_remainingWavax > 0) {
            (address _stableCoin,) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(wavax, _stableCoin, _remainingWavax, _estimates[1]);
            _addLiquidity(_estimates[2]);

            _deposit();
        }
    }

    function _withdrawAll()
        internal
        override
    {
        uint256 _bal = gauge.balanceOf(address(this));
        _withdraw(_bal);
    }

    function _withdraw(
        uint256 _amount
    )
        internal
        override
    {
        gauge.withdraw(_amount);
    }

    function balanceOfPool()
        public
        view
        override
        returns (uint256)
    {
        return gauge.balanceOf(address(this));
    }
}