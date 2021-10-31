// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '../interfaces/IConvexVault.sol';
import '../interfaces/ICurvePool.sol';
import '../interfaces/IStableSwap2Pool.sol';
import '../interfaces/IStableSwap3Pool.sol';
import './BaseStrategy.sol';
import '../interfaces/ExtendedIERC20.sol';
import '../interfaces/ICVXMinter.sol';
import '../interfaces/IHarvester.sol';

contract MIMConvexStrategy is BaseStrategy {
    // used for Crv -> weth -> [mim/3crv] -> mimCrv route
    address public immutable crv;
    address public immutable cvx;

    address public immutable mim;
    address public immutable crv3;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable mimCvxDepositLP;
    IConvexRewards public immutable crvRewards;
    IStableSwap2Pool public immutable stableSwap2Pool;

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
     * @param _stableSwap2Pool The address of the stable swap pool
     * @param _controller The address of the controller
     * @param _manager The address of the manager
     * @param _routerArray The address array of routers for swapping tokens
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
        IStableSwap2Pool _stableSwap2Pool,
        address _controller,
        address _manager,
        address[] memory _routerArray
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _routerArray) {
        require(address(_crv) != address(0), '!_crv');
        require(address(_cvx) != address(0), '!_cvx');
        require(address(_mim) != address(0), '!_mim');
        require(address(_crv3) != address(0), '!_crv3');
        require(address(_convexVault) != address(0), '!_convexVault');
        require(address(_stableSwap2Pool) != address(0), '!_stableSwap2Pool');

        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        mim = _mim;
        crv3 = _crv3;
        pid = _pid;
        convexVault = _convexVault;
        mimCvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwap2Pool = _stableSwap2Pool;
        // Required to overcome "Stack Too Deep" error
        _setApprovals(
            _want,
            _crv,
            _cvx,
            _mim,
            _crv3,
            address(_convexVault),
            address(_stableSwap2Pool),
            _routerArray
        );
    }

    function _setApprovals(
        address _want,
        address _crv,
        address _cvx,
        address _mim,
        address _crv3,
        address _convexVault,
        address _stableSwap2Pool,
        address[] memory _routerArray
    ) internal {
        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
        for(uint i=0; i<_routerArray.length; i++) {
            IERC20(_crv).safeApprove(address(_routerArray[i]), 0);
            IERC20(_crv).safeApprove(address(_routerArray[i]), type(uint256).max);
            IERC20(_cvx).safeApprove(address(_routerArray[i]), 0);
            IERC20(_cvx).safeApprove(address(_routerArray[i]), type(uint256).max);
        }
        IERC20(_mim).safeApprove(address(_stableSwap2Pool), type(uint256).max);
        IERC20(_crv3).safeApprove(address(_stableSwap2Pool), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwap2Pool), type(uint256).max);
    }

    function _deposit() internal override {
        if (balanceOfWant() > 0) {
            convexVault.depositAll(pid, true);
        }
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity(uint256 estimate) internal {
        uint256[2] memory amounts;
        amounts[1] = IERC20(crv3).balanceOf(address(this));
        stableSwap2Pool.add_liquidity(amounts, estimate);
    }

    function _addLiquidity3CRV(uint256 estimate) internal {
        uint256[3] memory amounts;
        (address targetCoin, uint256 targetIndex) = getMostPremium();
        amounts[targetIndex] = IERC20(targetCoin).balanceOf(address(this));
        IStableSwap3Pool(crv3).add_liquidity(amounts, estimate);
    }

    function getMostPremium() public view returns (address, uint256) {
        ICurvePool stablePool = ICurvePool(crv3);
        uint256 daiBalance = stablePool.balances(0);
        uint256 usdcBalance = (stablePool.balances(1)).mul(10**18).div(ExtendedIERC20(stablePool.coins(1)).decimals());
        uint256 usdtBalance = (stablePool.balances(2)).mul(10**12); 

        if (daiBalance <= usdcBalance && daiBalance <= usdtBalance) {
            return (stablePool.coins(0), 0);
        }

        if (usdcBalance <= daiBalance && usdcBalance <= usdtBalance) {
            return (stablePool.coins(1), 1);
        }

        if (usdtBalance <= daiBalance && usdtBalance <= usdcBalance) {
            return (stablePool.coins(2), 2);
        }

        return (stablePool.coins(0), 0); // If they're somehow equal, we just want DAI
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
	// RouterIndex 1 sets router to Uniswap to swap WETH->YAXIS
        uint256 _remainingWeth = _payHarvestFees(crv, _estimates[arrayCounter], _estimates[arrayCounter + 1], 1);
        arrayCounter += 2;
        if (_remainingWeth > 0) {
            (address _token, ) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _token, _remainingWeth, _estimates[arrayCounter]);
            arrayCounter += 1;
            _addLiquidity3CRV(_estimates[arrayCounter]);
            _addLiquidity(_estimates[arrayCounter]);
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
        
        // Estimates for WETH -> Stablecoin
        (address _targetCoin,) = getMostPremium(); 
        _path[0] = weth;
        _path[1] = _targetCoin;
        _amounts = router.getAmountsOut(
            wethAmount - _amounts[0],
            _path
        );
        _estimates[_estimates.length] = _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

        // Estimates for Stablecoin -> 3CRV
        _estimates[_estimates.length] = (_amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage).mul(10**18).div(10**(ExtendedIERC20(_targetCoin).decimals())).div(IStableSwap3Pool(crv3).get_virtual_price())).mul(ONE_HUNDRED_PERCENT - _slippage);
        // Estimates for 3CRV -> MIM-3CRV is the same 3CRV estimate
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
