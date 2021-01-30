// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../../interfaces/Idle.sol";
import "../interfaces/IConverter.sol";
import "./BaseStrategy.sol";

contract StrategyIdleV2 is BaseStrategy {
    address public immutable idleYieldToken;
    address public immutable IDLE;
    address public immutable COMP;

    constructor(
        string memory _name,
        address _underlying,
        address _idleYieldToken,
        address _IDLE,
        address _COMP,
        address _controller,
        address _manager,
        address _weth,
        address _router
    )
        public
        BaseStrategy(_name, _controller, _manager, _underlying, _weth, _router)
    {
        idleYieldToken = _idleYieldToken;
        IDLE = _IDLE;
        COMP = _COMP;
        IERC20(_IDLE).safeApprove(address(_router), type(uint256).max);
        IERC20(_COMP).safeApprove(address(_router), type(uint256).max);
        IERC20(_underlying).safeApprove(_idleYieldToken, type(uint256).max);
    }

    function balanceOfPool() public view override returns (uint256) {
        uint256 balance = balanceOfYieldToken();
        return balance
            .mul(pricePerToken())
            .div(1e18);
    }

    function pricePerToken() public view returns (uint256) {
        return IIdleTokenV3_1(idleYieldToken).tokenPrice();
    }

    function balanceOfYieldToken() public view returns (uint256) {
        return IERC20(idleYieldToken).balanceOf(address(this));
    }

    function _deposit() internal override {
        uint256 balance = balanceOfWant();
        if (balance > 0) {
            IIdleTokenV3_1(idleYieldToken).mintIdleToken(balance, true, address(0));
        }
    }

    function _harvest() internal override {
        IIdleTokenV3_1(idleYieldToken).redeemIdleToken(0);
        uint256 remainingWeth = _payHarvestFees(IDLE);

        _liquidateAsset(COMP, want);

        if (remainingWeth > 0) {
            _swapTokens(weth, want, remainingWeth);
        }

        _deposit();
    }

    function _withdraw(uint256 _amount) internal override {
        _amount = _amount.mul(1e18).div(IIdleTokenV3_1(idleYieldToken).tokenPrice());
        IIdleTokenV3_1(idleYieldToken).redeemIdleToken(_amount);

        _liquidateAsset(COMP, want);
        _liquidateAsset(IDLE, want);
    }

    function _withdrawAll() internal override {
        uint256 balance = balanceOfYieldToken();
        IIdleTokenV3_1(idleYieldToken).redeemIdleToken(balance);

        _liquidateAsset(COMP, want);
        _liquidateAsset(IDLE, want);
    }

    function _liquidateAsset(address asset, address to) internal {
        uint256 assetBalance = IERC20(asset).balanceOf(address(this));
        if (assetBalance > 0) {
            _swapTokens(asset, to, assetBalance);
        }
    }
}
