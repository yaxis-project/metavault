// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IGauge.sol";
import "../../interfaces/Balancer.sol";

import "../interfaces/ExtendedIERC20.sol";

import "./AvaxBaseStrategy.sol";

import '../interfaces/IHarvester.sol';
import '../interfaces/IStableSwap2Pool.sol';

contract aaWBTCrenBTCStrategy is AvaxBaseStrategy {
    // used for Crv -> wAVAX -> WBTC -> LP route
    address public immutable crv;

    // for add_liquidity via avax.curve.fi to get back LP
    address public immutable wbtc;

    IStableSwap2Pool public immutable stableSwap2Pool;
    IGauge public immutable gauge;

    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _wavax,
        address _wbtc,
        address _gauge,
        address _stableSwap2Pool,
        address _controller,
        address _manager,
        address[] memory _routerArray
    )
        public
        BaseStrategy(_name, _controller, _manager, _want, _wavax, _routerArray)
    {
        crv = _crv;
        wbtc = _wbtc;
        gauge = IGauge(_gauge);
        stableSwap2Pool = IStableSwap2Pool(_stableSwap2Pool);
        IERC20(_want).safeApprove(_gauge, type(uint256).max);
        IERC20(_crv).safeApprove(_routerArray[0], type(uint256).max);
        IERC20(_wbtc).safeApprove(_stableSwap2Pool, type(uint256).max);
        IERC20(_want).safeApprove(_stableSwap2Pool, type(uint256).max);
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
        uint256[2] memory amounts;
        amounts[0] = IERC20(wbtc).balanceOf(address(this));
        amounts[1] = 0;
        stableSwap2Pool.add_liquidity(amounts, _estimate, true);
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
            _swapTokens(wavax, wbtc, _remainingWavax, _estimates[1]);
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