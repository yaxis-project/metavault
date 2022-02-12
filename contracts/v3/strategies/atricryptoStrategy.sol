// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IGauge.sol";
import "../interfaces/ExtendedIERC20.sol";
import "./AvaxBaseStrategy.sol";
import '../interfaces/IHarvester.sol';
import '../interfaces/IStableSwapPool.sol';

contract atricryptoStrategy is AvaxBaseStrategy {

    address public immutable crv;
    address public immutable usdc;

    IStableSwapPool public immutable stableSwapPool;
    IGauge public immutable gauge;

    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _wavax,
        address _usdc,
        address _gauge,
        address _stableSwapPool,
        address _controller,
        address _manager,
        address[] memory _routerArray
    )
        public
        AvaxBaseStrategy(_name, _controller, _manager, _want, _wavax, _routerArray)
    {
        crv = _crv;
        usdc = _usdc;
        stableSwapPool = IStableSwapPool(_stableSwapPool);
        gauge = IGauge(_gauge);
        IERC20(_want).safeApprove(_gauge, type(uint256).max);
        IERC20(_crv).safeApprove(_routerArray[0], type(uint256).max);
        IERC20(_want).safeApprove(_stableSwapPool, type(uint256).max);
        IERC20(_usdc).safeApprove(_stableSwapPool, type(uint256).max);
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
        uint256[5] memory amounts;
        amounts[1] = IERC20(usdc).balanceOf(address(this));
        stableSwapPool.add_liquidity(amounts, _estimate);
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
            _swapTokens(wavax, usdc, _remainingWavax, _estimates[1]);
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
