// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IConvexVault.sol';
import '../interfaces/ExtendedIERC20.sol';
import '../interfaces/IStableSwap2Pool.sol';
import '../interfaces/IWETH.sol';
import './BaseStrategy.sol';
import '../interfaces/ICVXMinter.sol';
import '../interfaces/IHarvester.sol';

contract ETHConvexStrategy is BaseStrategy {
    using SafeMath for uint8;

    address public immutable crv;
    address public immutable cvx;
    address public immutable aleth;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable cvxDepositLP;
    IConvexRewards public immutable crvRewards;
    IStableSwap2Pool public immutable stableSwapPool;

    /**
     * @param _name The strategy name
     * @param _want The desired token of the strategy
     * @param _crv The address of CRV
     * @param _cvx The address of CVX
     * @param _weth The address of WETH
     * @param _aleth The address of alternative ETH
     * @param _pid The pool id of convex
     * @param _convexVault The address of the convex vault
     * @param _stableSwapPool The address of the stable swap pool
     * @param _controller The address of the controller
     * @param _manager The address of the manager
     * @param _routerArray The addresses of routers for swapping tokens
     */
    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _cvx,
        address _weth,
        address _aleth,
        uint256 _pid,
        IConvexVault _convexVault,
        address _stableSwapPool,
        address _controller,
        address _manager,
        address[] memory _routerArray
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _routerArray) {
        require(address(_crv) != address(0), '!_crv');
        require(address(_cvx) != address(0), '!_cvx');
        require(address(_aleth) != address(0), '!_aleth');
        require(address(_convexVault) != address(0), '!_convexVault');
        require(address(_stableSwapPool) != address(0), '!_stableSwapPool');

        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        aleth = _aleth;
        pid = _pid;
        convexVault = _convexVault;
        cvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwapPool = IStableSwap2Pool(_stableSwapPool);

        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
        for(uint i=0; i<_routerArray.length; i++) {
            IERC20(_crv).safeApprove(address(_routerArray[i]), type(uint256).max);
            IERC20(_cvx).safeApprove(address(_routerArray[i]), type(uint256).max);
        }
        IERC20(_want).safeApprove(address(_stableSwapPool), type(uint256).max);
        IERC20(_aleth).safeApprove(_stableSwapPool, type(uint256).max);
    }

    function _deposit() internal override {
        convexVault.depositAll(pid, true);
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity(uint256 _estimate) internal {
        uint256[2] memory amounts;
        amounts[0] = address(this).balance;
        stableSwapPool.add_liquidity(amounts, _estimate);
        return;
    }

    function _harvest(uint256[] memory _estimates) internal override {
        uint256 arrayCounter;
        _claimReward();
        uint256 _cvxBalance = IERC20(cvx).balanceOf(address(this));
        if (_cvxBalance > 0) {
            _swapTokens(cvx, weth, _cvxBalance, _estimates[0]);
        }
        arrayCounter += 1;

        uint256 _extraRewardsLength = crvRewards.extraRewardsLength();
        for (uint256 i = 0; i < _extraRewardsLength; i++) {
            address _rewardToken = IConvexRewards(crvRewards.extraRewards(i)).rewardToken();
            uint256 _extraRewardBalance = IERC20(_rewardToken).balanceOf(address(this));
            if (_extraRewardBalance > 0) {
                _swapTokens(_rewardToken, weth, _extraRewardBalance, _estimates[i+1]);
            }
            arrayCounter += 1;
        }

        uint256 _remainingWeth = _payHarvestFees(crv, _estimates[arrayCounter], _estimates[arrayCounter+1], routerArray[1]);
        arrayCounter += 2;
        setRouterInternal(routerArray[0]); // Set router to routerArray[0] == Sushiswap router
        if (_remainingWeth > 0) {
            IWETH(weth).withdraw(_remainingWeth);
        }
        _addLiquidity(_estimates[arrayCounter]);
        if (balanceOfWant() > 0) {
            _deposit();
        }
    }

    function getEstimates() public view returns (uint256[] memory _estimates) {
        address[] memory _path;
        uint256[] memory _amounts;
        uint256 _slippage = IHarvester(manager.harvester()).slippage();
        uint256 wethAmount;

        // Estimates for CVX -> WETH
        _path[0] = cvx;
        _path[1] = weth;
        _amounts = router.getAmountsOut(
            // Calculating CVX minted
            (crvRewards.earned(address(this))).mul(ICVXMinter(cvx).totalCliffs().sub(ICVXMinter(cvx).maxSupply().div(ICVXMinter(cvx).reductionPerCliff()))).div(ICVXMinter(cvx).totalCliffs()),
            _path
        );
        _estimates[0]= _amounts[1] - _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

        wethAmount += _estimates[0];

        // Estimates for extra rewards -> WETH
        if (crvRewards.extraRewardsLength() > 0) {
            for (uint256 i = 0; i < crvRewards.extraRewardsLength(); i++) {
                _path[0] = IConvexRewards(crvRewards.extraRewards(i)).rewardToken();
                _path[1] = weth;
                _amounts = router.getAmountsOut(
                    IConvexRewards(crvRewards.extraRewards(i)).earned(address(this)),
                    _path
                );
                _estimates[_estimates.length] = _amounts[1] - _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

                wethAmount += _estimates[_estimates.length - 1];
            }
        }

        // Estimates for CRV -> WETH
        _path[0] = crv;
        _path[1] = weth;
        _amounts = router.getAmountsOut(
            crvRewards.earned(address(this)),
            _path
        );
        _estimates[_estimates.length] = _amounts[1] - _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

        wethAmount += _estimates[_estimates.length - 1];

        // Estimates WETH -> YAXIS
        _path[0] = weth;
        _path[1] = manager.yaxis();
        _amounts = ISwap(routerArray[1]).getAmountsOut(wethAmount.mul(manager.treasuryFee()).div(ONE_HUNDRED_PERCENT), _path); // Set to UniswapV2 to calculate output for YAXIS
        _estimates[_estimates.length] = _amounts[1] - _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

        // Estimates for ETH -> ethCRV LP
        _estimates[_estimates.length] = (wethAmount-_amounts[0]).div(stableSwapPool.get_virtual_price());
    }

    function _withdrawAll() internal override {
        convexVault.withdrawAll(pid);
    }

    function _withdraw(uint256 _amount) internal override {
        convexVault.withdraw(pid, _amount);
    }

    function balanceOfPool() public view override returns (uint256) {
        return IERC20(cvxDepositLP).balanceOf(address(this));
    }
}
