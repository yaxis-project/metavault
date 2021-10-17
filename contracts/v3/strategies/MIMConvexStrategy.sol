// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '../interfaces/IConvexVault.sol';
import '../interfaces/IStableSwapPool.sol';
import './BaseStrategy.sol';

contract MIMConvexStrategy is BaseStrategy {
    // used for Crv -> weth -> [mim/3crv] -> mimCrv route
    address public immutable override crv;
    address public immutable override cvx;

    address public immutable mim;
    address public immutable override crv3;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable mimCvxDepositLP;
    IConvexRewards public immutable override crvRewards;
    IStableSwapPool public immutable override stableSwapPool;

    /**
     * @param _name The strategy name
     * @param _want The desired token of the strategy
     * @param _crv The address of CRV
     * @param _cvx The address of CVX
     * @param _weth The address of WETH
     * @param _mim The address of MIM
     * @param _crv3 The address of 3CRV
     * @param _pid The pool id of convex
     * @param _convexVault The address of the convex vault
     * @param _stableSwapPool The address of the stable swap pool
     * @param _controller The address of the controller
     * @param _manager The address of the manager
     * @param _router The address of the router for swapping tokens
     */
    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _cvx,
        address _weth,
        address _mim,
        address _crv3,
        uint256 _pid,
        IConvexVault _convexVault,
        IStableSwapPool _stableSwapPool,
        address _controller,
        address _manager,
        address _router
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _router) {
        require(address(_crv) != address(0), '!_crv');
        require(address(_cvx) != address(0), '!_cvx');
        require(address(_mim) != address(0), '!_mim');
        require(address(_crv3) != address(0), '!_crv3');
        require(address(_convexVault) != address(0), '!_convexVault');
        require(address(_stableSwapPool) != address(0), '!_stableSwapPool');

        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        mim = _mim;
        crv3 = _crv3;
        pid = _pid;
        convexVault = _convexVault;
        mimCvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwapPool = _stableSwapPool;
        // Required to overcome "Stack Too Deep" error
        _setApprovals(
            _want,
            _crv,
            _cvx,
            _mim,
            _crv3,
            address(_convexVault),
            address(_stableSwapPool)
        );
    }

    function _setApprovals(
        address _want,
        address _crv,
        address _cvx,
        address _mim,
        address _crv3,
        address _convexVault,
        address _stableSwapPool
    ) internal {
        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
        IERC20(_crv).safeApprove(address(router), type(uint256).max);
        IERC20(_cvx).safeApprove(address(router), type(uint256).max);
        IERC20(_mim).safeApprove(address(_stableSwapPool), type(uint256).max);
        IERC20(_crv3).safeApprove(address(_stableSwapPool), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwapPool), type(uint256).max);
    }

    function _deposit() internal override {
        if (balanceOfWant() > 0) {
            convexVault.depositAll(pid, true);
        }
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity(uint256 _estimatedWant) internal {
        uint256[2] memory amounts;
        amounts[0] = IERC20(mim).balanceOf(address(this));
        amounts[1] = IERC20(crv3).balanceOf(address(this));
        stableSwapPool.add_liquidity(amounts, _estimatedWant);
    }

    function getMostPremium() public view override returns (address, uint256) {
        // 3CRV has 18 decimals
        return (crv3, 1);
    }

    function _harvest(uint256 _estimatedCRVWETH, uint256 _estimatedCVXWETH, uint256 _estimatedYAXIS, uint256[] memory _estimatedExtraWETH, uint256 _estimatedToken, uint256 _estimatedWant) internal override {
        _claimReward();
        uint256 _cvxBalance = IERC20(cvx).balanceOf(address(this));
        if (_cvxBalance > 0) {
            _swapTokens(cvx, weth, _cvxBalance, _estimatedCVXWETH);
        }

        uint256 _extraRewardsLength = crvRewards.extraRewardsLength();
        for (uint256 i = 0; i < _extraRewardsLength; i++) {
            address _rewardToken = IConvexRewards(crvRewards.extraRewards(i)).rewardToken();
            uint256 _extraRewardBalance = IERC20(_rewardToken).balanceOf(address(this));
            if (_extraRewardBalance > 0) {
                _swapTokens(_rewardToken, weth, _extraRewardBalance, _estimatedExtraWETH[i]);
            }
        }

        uint256 _remainingWeth = _payHarvestFees(crv, _estimatedCRVWETH, _estimatedYAXIS);
        setRouterInternal(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F); // Set router back to Sushiswap after _payHarvestFees
        if (_remainingWeth > 0) {
            (address _token, ) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _token, _remainingWeth, _estimatedToken);
            _addLiquidity(_estimatedWant);
            _deposit();
        }
    }

    function _withdrawAll() internal override {
        convexVault.withdrawAll(pid);
    }

    function _withdraw(uint256 _amount) internal override {
        convexVault.withdraw(pid, _amount);
    }

    function balanceOfPool() public view override returns (uint256) {
        return IERC20(mimCvxDepositLP).balanceOf(address(this));
    }
}
