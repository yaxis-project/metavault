 // SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IAave.sol";
import "../interfaces/ExtendedIERC20.sol";
import "./AvaxBaseStrategy.sol";
import '../interfaces/IHarvester.sol';

contract AvaxGenericAaveStrategy is AvaxBaseStrategy {

    IAave public immutable aave;
    IAaveRewards public immutable rewards;
    address public immutable avtoken;

    constructor(
        string memory _name,
        address _wavax,
        address _want,
        address _avtoken,
        address _aave,
        address _rewards,
        address _controller,
        address _manager,
        address[] memory _routerArray
    )
        public
        AvaxBaseStrategy(_name, _controller, _manager, _want, _wavax, _routerArray)
    {
        avtoken = _avtoken;
        aave = IAave(_aave);
        rewards = IAaveRewards(_rewards);
        IERC20(_want).approve(_aave, type(uint256).max);
    }

    function _deposit()
        internal
        override
    {
        uint256 _wantBal = balanceOfWant();
        if (_wantBal > 0) {
            aave.deposit(want, _wantBal, address(this), 0);
        }
    }

    function _claimReward()
        internal
    {
        address[] memory assets = new address[](1);
        assets[0] = address(avtoken);
        rewards.claimRewards(assets, type(uint256).max, address(this));
    }

    function _harvest(
        uint256[] calldata _estimates
    )
        internal
        override
    {
        _claimReward();
        uint256 _remainingWavax = _payHarvestFees();

        if (_remainingWavax > 0) {
            if (want != wavax) {
                _swapTokens(wavax, want, _remainingWavax, _estimates[0]);
            }
            _deposit();
        }
    }

    function _payHarvestFees()
        internal
        returns (uint256 _wavaxBal)
    {
        _wavaxBal = IERC20(wavax).balanceOf(address(this));

        if (_wavaxBal > 0) {
            // get all the necessary variables in a single call
            (
                ,
                address treasury,
                uint256 treasuryFee
            ) = manager.getHarvestFeeInfo();

            uint256 _fee;

            // pay the treasury with WAVAX
            if (treasuryFee > 0 && treasury != address(0)) {
                _fee = _wavaxBal.mul(treasuryFee).div(ONE_HUNDRED_PERCENT);
                IERC20(wavax).safeTransfer(treasury, _fee);
            }
            // return the remaining WAVAX balance
            _wavaxBal = IERC20(wavax).balanceOf(address(this));
        }
    }

    function _withdrawAll()
        internal
        override
    {
        _withdraw(balanceOfPool());
    }

    function _withdraw(
        uint256 _amount
    )
        internal
        override
    {
        aave.withdraw(want, _amount, address(this));
    }

    function balanceOfPool()
        public
        view
        override
        returns (uint256)
    {
        return IERC20(avtoken).balanceOf(address(this));
    }
}
