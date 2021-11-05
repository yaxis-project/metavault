// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../../interfaces/Gauge.sol";
import "../../interfaces/Balancer.sol";

import "../interfaces/ExtendedIERC20.sol";

import "./BaseStrategy.sol";

import '../interfaces/IHarvester.sol';

contract NativeStrategyCurve3Crv is BaseStrategy {
    // used for Crv -> weth -> [dai/usdc/usdt] -> 3crv route
    address public immutable crv;

    // for add_liquidity via curve.fi to get back 3CRV (use getMostPremium() for the best stable coin used in the route)
    address public immutable dai;
    address public immutable usdc;
    address public immutable usdt;

    Mintr public immutable crvMintr;
    IStableSwap3Pool public immutable stableSwap3Pool;
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
        IStableSwap3Pool _stableSwap3Pool,
        address _controller,
        address _manager,
        address[] memory _routerArray
    )
        public
        BaseStrategy(_name, _controller, _manager, _want, _weth, _routerArray)
    {
        crv = _crv;
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        stableSwap3Pool = _stableSwap3Pool;
        gauge = _gauge;
        crvMintr = _crvMintr;
        IERC20(_want).safeApprove(address(_gauge), type(uint256).max);
        IERC20(_crv).safeApprove(address(_routerArray[0]), type(uint256).max);
        IERC20(_dai).safeApprove(address(_stableSwap3Pool), type(uint256).max);
        IERC20(_usdc).safeApprove(address(_stableSwap3Pool), type(uint256).max);
        IERC20(_usdt).safeApprove(address(_stableSwap3Pool), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwap3Pool), type(uint256).max);
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

    function _addLiquidity(uint256 _estimate)
        internal
    {
        uint256[3] memory amounts;
        amounts[0] = IERC20(dai).balanceOf(address(this));
        amounts[1] = IERC20(usdc).balanceOf(address(this));
        amounts[2] = IERC20(usdt).balanceOf(address(this));
        stableSwap3Pool.add_liquidity(amounts, _estimate);
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
        // RouterIndex 1 sets router to Uniswap to swap WETH->YAXIS
        uint256 _remainingWeth = _payHarvestFees(crv, _estimates[0], _estimates[1], 1);

        if (_remainingWeth > 0) {
            (address _stableCoin,) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _stableCoin, _remainingWeth, _estimates[2]);
            _addLiquidity(_estimates[3]);

            _deposit();
        }
    }

    function getEstimates() external view returns (uint256[] memory) {
            
        uint256[] memory _estimates = new uint256[](4);
        address[] memory _path;
        uint256[] memory _amounts;
        uint256 _notSlippage = ONE_HUNDRED_PERCENT.sub(IHarvester(manager.harvester()).slippage());
        uint256 wethAmount;

        // Estimates for CRV -> WETH
        _path[0] = crv;
        _path[1] = weth;
        _amounts = router.getAmountsOut(
            gauge.claimable_tokens(address(this)),
            _path
        );
        _estimates[0] = _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);

        wethAmount += _estimates[0];

        // Estimates WETH -> YAXIS
        _path[0] = weth;
        _path[1] = manager.yaxis();
        _amounts = ISwap(routerArray[1]).getAmountsOut(wethAmount.mul(manager.treasuryFee()).div(ONE_HUNDRED_PERCENT), _path); // Set to UniswapV2 to calculate output for YAXIS
        _estimates[1] = _amounts[1] - _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);
        
        // Estimates for WETH -> Stablecoin
        (address _targetCoin,) = getMostPremium(); 
        _path[0] = weth;
        _path[1] = _targetCoin;
        _amounts = router.getAmountsOut(
            wethAmount - _amounts[0],
            _path
        );
        _estimates[2] = _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);

        // Estimates for Stablecoin -> 3CRV
        _estimates[3] = (_amounts[1].mul(10**(18-ExtendedIERC20(_targetCoin).decimals())).div(stableSwap3Pool.get_virtual_price())).mul(_notSlippage).div(ONE_HUNDRED_PERCENT);
        
        return _estimates;
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
