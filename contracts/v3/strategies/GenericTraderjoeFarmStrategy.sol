// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IMasterchef.sol";
import "../interfaces/ExtendedIERC20.sol";
import "./AvaxBaseStrategy.sol";
import '../interfaces/IHarvester.sol';
import '../interfaces/IWETH.sol';

contract GenericTraderjoeFarmStrategy is AvaxBaseStrategy {

    IERC20 public immutable joe;
    IERC20 public bonus;
    IMasterchef public immutable masterchef;
    uint256 public immutable pid;
    address[] public rewardPath; // bonus->...->wavax->joe

    constructor(
        string memory _name,
        address _wavax,
        address _want,
        address _joe,
        address _masterchef,
        uint256 _pid,
        address _controller,
        address _manager,
        address[] memory _routerArray,
        address[] memory _rewardPath // Needed only for swapping bonus
    )
        public
        AvaxBaseStrategy(_name, _controller, _manager, _want, _wavax, _routerArray)
    {
        joe = IERC20(_joe);
        masterchef = IMasterchef(_masterchef);
        pid = _pid;
        IERC20(_joe).approve(_routerArray[0], type(uint256).max);
        IERC20(_want).approve(_masterchef, type(uint256).max);
        for (uint i=0; i<_rewardPath.length; i++) {
            IERC20(_rewardPath[i]).approve(_routerArray[0], type(uint256).max);
        }
        address _bonus = IBonusRewards(IMasterchef(_masterchef).poolInfo(_pid).rewarder).rewardToken();
        if (
            _bonus != _wavax &&
            _bonus != address(0)
        ) {
            bonus = IERC20(_bonus);
        }
    }

    function _deposit()
        internal
        override
    {
        uint256 _wantBal = balanceOfWant();
        if (_wantBal > 0) {
            masterchef.deposit(pid, _wantBal);
        }
    }

    function _addLiquidity()
        internal
    {
        // Allows 0.5% slippage
        router.addLiquidity(
            address(joe),
            wavax,
            joe.balanceOf(address(this)),
            IERC20(wavax).balanceOf(address(this)),
            joe.balanceOf(address(this)).mul(995).div(1000),
            IERC20(wavax).balanceOf(address(this)).mul(995).div(1000),
            address(this),
            1e10
        );
    }

    function _claimReward()
        internal
    {
        masterchef.deposit(pid, 0);
    }

    function _harvest(
        uint256[] calldata _estimates
    )
        internal
        override
    {
        _claimReward();
        if (address(bonus) != address(0)) {
            if (bonus.balanceOf(address(this)) > 0) {
                router.swapExactTokensForTokens(
                    bonus.balanceOf(address(this)),
                    _estimates[0],
                    rewardPath,
                    address(this),
                    1e10
                );
            }
        }
        uint256 _remainingJoe = _payHarvestFees(address(joe), joe.balanceOf(address(this)), _estimates[1], 0);

        if (_remainingJoe > 0) {
            _swapTokens(address(joe), want, _remainingJoe.div(2), _estimates[2]);
            _addLiquidity();
            _deposit();
        }
    }

    function _payHarvestFees(
        address _poolToken,
        uint256 _amount,
        uint256 _estimatedWAVAX,
        uint256 _routerIndex
    )
        internal
        returns (uint256 _joeBal)
    {
        if (_amount > 0) {
            (
                ,
                address treasury,
                uint256 treasuryFee
            ) = manager.getHarvestFeeInfo();
            _amount = _amount.mul(treasuryFee).div(ONE_HUNDRED_PERCENT);
            _swapTokensWithRouterIndex(_poolToken, wavax, _amount, _estimatedWAVAX, _routerIndex);
            if (address(this).balance > 0) {
                IWETH(wavax).deposit{value: address(this).balance}();
            }
            IERC20(wavax).safeTransfer(treasury, IERC20(wavax).balanceOf(address(this)));
        }
        _joeBal = joe.balanceOf(address(this));
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
        masterchef.withdraw(pid, _amount);
    }

    function balanceOfPool()
        public
        view
        override
        returns (uint256)
    {
        return masterchef.userInfo(pid, address(this)).amount;
    }

    receive() external payable {}
}
