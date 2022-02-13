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
    IMasterchef public immutable masterchef;
    uint256 public immutable pid;

    constructor(
        string memory _name,
        address _wavax,
        address _want,
        address _joe,
        address _masterchef,
        uint256 _pid,
        address _controller,
        address _manager,
        address[] memory _routerArray
    )
        public
        AvaxBaseStrategy(_name, _controller, _manager, _want, _wavax, _routerArray)
    {
        joe = IERC20(_joe);
        masterchef = IMasterchef(_masterchef);
        pid = _pid;
        IERC20(_joe).approve(_routerArray[0], type(uint256).max);
        IERC20(_want).approve(_masterchef, type(uint256).max);
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
            block.timestamp
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
        uint256 _remainingJoe = _payHarvestFees(address(joe), joe.balanceOf(address(this)), _estimates[0], 0);

        if (_remainingJoe > 0) {
            _swapTokens(address(joe), want, _remainingJoe.div(2), _estimates[1]);
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
