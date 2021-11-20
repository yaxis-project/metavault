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
    IConvexRewards public immutable crvRewards;
    IStableSwap2Pool public immutable stableSwap2Pool;
    IStableSwap3Pool public immutable stableSwap3Pool;

    /**
     * @param _name The strategy name
     * @param _want The desired token of the strategy
     * @param _crv The address of CRV
     * @param _cvx The address of CVX
     * @param _weth The address of WETH
     * @param _mim The address of MIM
     * @param _crv3 The address of 3CRV
     * @param _stableSwap3Pool The address of the 3CRV pool
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
        IStableSwap3Pool _stableSwap3Pool,
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
        require(address(_stableSwap3Pool) != address(0), '!_stableSwap3Pool');

        (, , , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        mim = _mim;
        crv3 = _crv3;
        pid = _pid;
        convexVault = _convexVault;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwap2Pool = _stableSwap2Pool;
        stableSwap3Pool = _stableSwap3Pool;
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
        _setMoreApprovals(address(_stableSwap3Pool), _crvRewards, _routerArray);
    }
    
    function _setMoreApprovals(address _stableSwap3Pool, address _crvRewards, address[] memory _routerArray) internal {
        IERC20(IStableSwap3Pool(_stableSwap3Pool).coins(0)).safeApprove(_stableSwap3Pool, type(uint256).max);
        IERC20(IStableSwap3Pool(_stableSwap3Pool).coins(1)).safeApprove(_stableSwap3Pool, type(uint256).max);
        IERC20(IStableSwap3Pool(_stableSwap3Pool).coins(2)).safeApprove(_stableSwap3Pool, type(uint256).max);   
        uint _routerArrayLength = _routerArray.length;
        for(uint i=0; i<_routerArrayLength; i++) {
            address _router = _routerArray[i];
            uint rewardsLength = IConvexRewards(_crvRewards).extraRewardsLength();
            if (rewardsLength > 0) {
                for(uint j=0; j<rewardsLength; j++) {
                    IERC20(IConvexRewards(IConvexRewards(_crvRewards).extraRewards(j)).rewardToken()).safeApprove(_router, type(uint256).max);
                }
            }
        }	 	
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
            address _router = _routerArray[i];
            IERC20(_crv).safeApprove(address(_router), 0);
            IERC20(_crv).safeApprove(address(_router), type(uint256).max);
            IERC20(_cvx).safeApprove(address(_router), 0);
            IERC20(_cvx).safeApprove(address(_router), type(uint256).max);
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
        stableSwap3Pool.add_liquidity(amounts, estimate);
    }

    function getMostPremium() public view returns (address, uint256) {
        uint256 daiBalance = stableSwap3Pool.balances(0);
        uint256 usdcBalance = (stableSwap3Pool.balances(1)).mul(10**18).div(ExtendedIERC20(stableSwap3Pool.coins(1)).decimals());
        uint256 usdtBalance = (stableSwap3Pool.balances(2)).mul(10**12); 

        if (daiBalance <= usdcBalance && daiBalance <= usdtBalance) {
            return (stableSwap3Pool.coins(0), 0);
        }

        if (usdcBalance <= daiBalance && usdcBalance <= usdtBalance) {
            return (stableSwap3Pool.coins(1), 1);
        }

        if (usdtBalance <= daiBalance && usdtBalance <= usdcBalance) {
            return (stableSwap3Pool.coins(2), 2);
        }

        return (stableSwap3Pool.coins(0), 0); // If they're somehow equal, we just want DAI
    }

    function _harvest(uint256[] calldata _estimates) internal override {
        _claimReward();
        uint256 _cvxBalance = IERC20(cvx).balanceOf(address(this));
        if (_cvxBalance > 0) {
            _swapTokens(cvx, weth, _cvxBalance, _estimates[0]);
        }

        uint256 _extraRewardsLength = crvRewards.extraRewardsLength();
        for (uint256 i = 0; i < _extraRewardsLength; i++) {
            address _rewardToken = IConvexRewards(crvRewards.extraRewards(i)).rewardToken();
            uint256 _extraRewardBalance = IERC20(_rewardToken).balanceOf(address(this));
            if (_extraRewardBalance > 0) {
                _swapTokens(_rewardToken, weth, _extraRewardBalance, _estimates[i+1]);
            }
        }
	// RouterIndex 1 sets router to Uniswap to swap WETH->YAXIS
        uint256 _remainingWeth = _payHarvestFees(crv, _estimates[_extraRewardsLength + 1], _estimates[_extraRewardsLength + 2], 1);
        if (_remainingWeth > 0) {
            (address _token, ) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _token, _remainingWeth, _estimates[_extraRewardsLength + 3]);
            _addLiquidity3CRV(_estimates[_extraRewardsLength + 4]);
            _addLiquidity(_estimates[_extraRewardsLength + 4]);
            _deposit();
        }
    }

    function getEstimates() external view returns (uint256[] memory) {
               
        uint rewardsLength = crvRewards.extraRewardsLength();
        uint256[] memory _estimates = new uint256[](rewardsLength.add(5));
        address[] memory _path = new address[](2);
        uint256[] memory _amounts;
        uint256 _notSlippage = ONE_HUNDRED_PERCENT.sub(IHarvester(manager.harvester()).slippage());
        uint256 wethAmount;

        // Estimates for CVX -> WETH
        _path[0] = cvx;
        _path[1] = weth;
        _amounts = router.getAmountsOut(
            // Calculating CVX minted
            (crvRewards.earned(address(this)))
            .mul(ICVXMinter(cvx).totalCliffs().sub(ICVXMinter(cvx).totalSupply().div(ICVXMinter(cvx).reductionPerCliff())))
            .div(ICVXMinter(cvx).totalCliffs()),
            _path
        );
        _estimates[0]= _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);

        wethAmount += _estimates[0];

        // Estimates for extra rewards -> WETH
        
        if (rewardsLength > 0) {
            for (uint256 i = 0; i < rewardsLength; i++) {
                _path[0] = IConvexRewards(crvRewards.extraRewards(i)).rewardToken();
                _path[1] = weth;
                _amounts = router.getAmountsOut(
                    IConvexRewards(crvRewards.extraRewards(i)).earned(address(this)),
                    _path
                );
                _estimates[i + 1] = _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);

                wethAmount += _estimates[i + 1];
            }
        }

        // Estimates for CRV -> WETH
        _path[0] = crv;
        _path[1] = weth;
        _amounts = router.getAmountsOut(
            crvRewards.earned(address(this)),
            _path
        );
        _estimates[rewardsLength + 1] = _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);

        wethAmount += _estimates[rewardsLength + 1];

        // Estimates WETH -> YAXIS
        _path[0] = weth;
        _path[1] = manager.yaxis();
        // Set to UniswapV2 to calculate output for YAXIS
        _amounts = ISwap(routerArray[1]).getAmountsOut(wethAmount.mul(manager.treasuryFee()).div(ONE_HUNDRED_PERCENT), _path);
        _estimates[rewardsLength + 2] = _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);
        
        // Estimates for WETH -> Stablecoin
        (address _targetCoin,) = getMostPremium(); 
        _path[0] = weth;
        _path[1] = _targetCoin;
        _amounts = router.getAmountsOut(
            wethAmount - _amounts[0],
            _path
        );
        _estimates[rewardsLength + 3] = _amounts[1].mul(_notSlippage).div(ONE_HUNDRED_PERCENT);

        // Estimates for Stablecoin -> 3CRV
        _estimates[rewardsLength + 4] = (_amounts[1].mul(10**(18-ExtendedIERC20(_targetCoin).decimals())).div(stableSwap3Pool.get_virtual_price())).mul(_notSlippage).div(ONE_HUNDRED_PERCENT);
        // Estimates for 3CRV -> MIM-3CRV is the same 3CRV estimate
        
        return _estimates;
    }

    function _withdrawAll() internal override {
        crvRewards.withdrawAllAndUnwrap(true);
    }

    function _withdraw(uint256 _amount) internal override {
        crvRewards.withdrawAndUnwrap(_amount, true);
    }

    function balanceOfPool() public view override returns (uint256) {
        return IERC20(address(crvRewards)).balanceOf(address(this));
    }
}
