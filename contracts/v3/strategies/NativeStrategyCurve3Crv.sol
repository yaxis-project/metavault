// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../../interfaces/Gauge.sol";
import "../../interfaces/Balancer.sol";

import "../interfaces/ExtendedIERC20.sol";

import "./BaseStrategy.sol";

contract NativeStrategyCurve3Crv is BaseStrategy {
    // used for Crv -> weth -> [dai/usdc/usdt] -> 3crv route
    address public immutable override crv;

    // for add_liquidity via curve.fi to get back 3CRV (use getMostPremium() for the best stable coin used in the route)
    address public immutable dai;
    address public immutable usdc;
    address public immutable usdt;
    
    // Unused tokens in strategy
    address public override crv3;
    address public override cvx;
    IConvexRewards public override crvRewards;

    Mintr public immutable crvMintr;
    IStableSwapPool public immutable override stableSwapPool;
    Gauge public immutable gauge; // 3Crv Gauge

    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _weth,
        address _dai,
        address _usdc,
        address _usdt,
        Gauge _gauge,
        Mintr _crvMintr,
        IStableSwapPool _stableSwapPool,
        address _controller,
        address _manager,
        address _router
    )
        public
        BaseStrategy(_name, _controller, _manager, _want, _weth, _router)
    {
        crv = _crv;
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        stableSwapPool = _stableSwapPool;
        gauge = _gauge;
        crvMintr = _crvMintr;
        IERC20(_want).safeApprove(address(_gauge), type(uint256).max);
        IERC20(_crv).safeApprove(address(_router), type(uint256).max);
        IERC20(_dai).safeApprove(address(_stableSwapPool), type(uint256).max);
        IERC20(_usdc).safeApprove(address(_stableSwapPool), type(uint256).max);
        IERC20(_usdt).safeApprove(address(_stableSwapPool), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwapPool), type(uint256).max);
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
        crvMintr.mint(address(gauge));
    }

    function _addLiquidity(uint256 _estimatedWant)
        internal
    {
        uint256[3] memory amounts;
        amounts[0] = IERC20(dai).balanceOf(address(this));
        amounts[1] = IERC20(usdc).balanceOf(address(this));
        amounts[2] = IERC20(usdt).balanceOf(address(this));
        stableSwapPool.add_liquidity(amounts, _estimatedWant);
    }

    function getMostPremium()
        public
        view
        override
        returns (address, uint256)
    {
        uint daiBalance = stableSwapPool.balances(0);
        // USDC - Supports a change up to the 18 decimal standard
        uint usdcBalance = stableSwapPool.balances(1).mul(10**18).div(10**(ExtendedIERC20(usdc).decimals()));
        uint usdtBalance = stableSwapPool.balances(2).mul(10**12);

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
        uint256 _estimatedCRVWETH,
        uint256 _estimatedCVXWETH,
        uint256 _estimatedYAXIS,
        uint256[] memory _estimatedExtraWETH,
        uint256 _estimatedToken,
        uint256 _estimatedWant
    )
        internal
        override
    {
        _claimReward();
        uint256 _remainingWeth = _payHarvestFees(crv, _estimatedCRVWETH, _estimatedYAXIS);

        if (_remainingWeth > 0) {
            (address _stableCoin,) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _stableCoin, _remainingWeth, _estimatedToken);
            _addLiquidity(_estimatedWant);

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
