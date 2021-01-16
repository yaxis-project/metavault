// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../../interfaces/Stabilize.sol";
import "../IConverter.sol";
import "./BaseStrategy.sol";

contract StrategyStabilize is BaseStrategy {
    address public immutable zpaToken;
    address public immutable pool;
    address public immutable STBZ;
    uint256 public immutable poolId;
    IConverter public converter;

    uint256 depositTime; // The time the strategy made a deposit into zpa-Token, every deposit resets the time
    uint256 constant divisionFactor = 100000;
    uint256 constant initialFee = 1000; // 1000 = 1%, 100000 = 100%, max fee restricted in contract is 10%
    uint256 constant endFee = 100; // 100 = 0.1%
    uint256 constant feeDuration = 604800; // The amount of seconds it takes from the initial to end fee

    constructor(
        address _underlying,
        address _zpaToken,
        address _pool,
        uint256 _poolId,
        address _STBZ,
        address _converter,
        address _controller,
        address _vaultManager,
        address _weth,
        address _router
    )
        public
        BaseStrategy(_controller, _vaultManager, _underlying, _weth, _router)
    {
        zpaToken = _zpaToken;
        pool = _pool;
        poolId = _poolId;
        STBZ = _STBZ;
        converter = IConverter(_converter);
        IERC20(_STBZ).safeApprove(address(_router), type(uint256).max);
        IERC20(_underlying).safeApprove(address(_converter), type(uint256).max);
        IERC20(_underlying).safeApprove(_zpaToken, type(uint256).max);
        IERC20(_zpaToken).safeApprove(_pool, type(uint256).max);
    }

    function balanceOfPool() public view override returns (uint256) {
        return (IZPAPool(pool).poolBalance(poolId, address(this)))
            .mul(IZPAToken(zpaToken).pricePerToken())
            .div(1e18)
            .add(balanceOfzpaToken());
    }

    function balanceOfzpaToken() public view returns (uint256) {
        return IERC20(zpaToken).balanceOf(address(this));
    }

    function calculateWithdrawFee(uint256 amount) public view returns (uint256) {
        uint256 _depositTime = depositTime;
        if (_depositTime == 0) {
            // Never deposited
            _depositTime = now; // Give the max fee
        }

        uint256 feeSubtraction = initialFee.sub(endFee).mul(now.sub(_depositTime)).div(feeDuration);
        if (feeSubtraction > initialFee.sub(endFee)) {
            // Cannot reduce fee more than this
            feeSubtraction = initialFee.sub(endFee);
        }
        uint256 fee = initialFee.sub(feeSubtraction);
        return amount.mul(fee).div(divisionFactor);
    }

    function _deposit() internal override {
        uint256 amount = balanceOfWant();
        if (amount > 0) {
            depositTime = now;
            IZPAToken(zpaToken).deposit(amount);
        }
        amount = balanceOfzpaToken();
        if (amount > 0) {
            IZPAPool(pool).deposit(poolId, amount);
        }
    }

    function _harvest() internal override {
        IZPAPool(pool).getReward(poolId);
        uint256 remainingWeth = _payHarvestFees(STBZ);

        if (remainingWeth > 0) {
            _swapTokens(weth, want, remainingWeth);

            if (balanceOfWant() > 0) {
                _deposit();
            }
        }
    }

    function _withdraw(uint256 _amount) internal override {
        uint256 fee = calculateWithdrawFee(_amount);
        if (fee > 0) {
            _amount = _amount.sub(fee);
        }
        _amount = _amount.mul(1e18).div(IZPAToken(zpaToken).pricePerToken());
        uint256 _before = balanceOfzpaToken();
        IZPAPool(pool).withdraw(poolId, _amount);
        uint256 _after = balanceOfzpaToken();
        _amount = _after.sub(_before);
        IZPAToken(zpaToken).redeem(_amount);
        _amount = balanceOfWant();
        if (_amount > 0) {
            _convert(want, _vaultWant(), _amount);
        }
    }

    function _withdrawAll() internal override {
        uint256 amount = IZPAPool(pool).poolBalance(poolId, address(this));
        IZPAPool(pool).exit(poolId, amount);

        amount = balanceOfzpaToken();
        if (amount > 0) {
            IZPAToken(zpaToken).redeem(amount);
            amount = balanceOfWant();
            _convert(want, _vaultWant(), amount);
        }
    }

    function _convert(address _from, address _to, uint256 _amount) internal {
        require(converter.convert_rate(_from, _to, _amount) > 0, "!convert_rate");
        IERC20(_from).safeTransfer(address(converter), _amount);
        converter.convert(_from, _to, _amount);
    }
}
