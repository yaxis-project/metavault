// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IConvexVault.sol';
import '../interfaces/ExtendedIERC20.sol';
import '../interfaces/IStableSwapPool.sol';
import '../interfaces/IStableSwap2Pool.sol';
import './BaseStrategy.sol';
import '../interfaces/ICVXMinter.sol';
import '../interfaces/IHarvester.sol';
contract CVXETHConvexStrategy is BaseStrategy {
    using SafeMath for uint8;

    address public immutable crv;
    address public immutable cvx;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    IConvexRewards public immutable crvRewards;
    address public immutable stableSwapPool;

    address[] public tokens;
    uint8[] public decimalMultiples;

    /**
     * @param _name The strategy name
     * @param _want The desired token of the strategy
     * @param _crv The address of CRV
     * @param _cvx The address of CVX
     * @param _weth The address of WETH
     * @param _pid The pool id of convex
     * @param _coinCount The number of coins in the pool
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
        uint256 _pid,
        uint256 _coinCount,
        IConvexVault _convexVault,
        address _stableSwapPool,
        address _controller,
        address _manager,
        address[] memory _routerArray // [1] should be set to Uniswap router
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _routerArray) {
        require(_coinCount == 2 || _coinCount == 3, '_coinCount should be 2 or 3');
        require(address(_crv) != address(0), '!_crv');
        require(address(_cvx) != address(0), '!_cvx');
        require(address(_convexVault) != address(0), '!_convexVault');
        require(address(_stableSwapPool) != address(0), '!_stableSwapPool');

        (, , , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        pid = _pid;
        convexVault = _convexVault;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwapPool = _stableSwapPool;

        for (uint256 i = 0; i < _coinCount; i++) {
            tokens.push(IStableSwapPool(_stableSwapPool).coins(i));
            decimalMultiples.push(18 - ExtendedIERC20(tokens[i]).decimals());
            IERC20(tokens[i]).safeApprove(_stableSwapPool, type(uint256).max);
        }

        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwapPool), type(uint256).max);
        _setApprovals(_cvx, _crv, _routerArray, _crvRewards);
    }

    function _setApprovals(
    	address _cvx,
    	address _crv,
    	address[] memory _routerArray,
    	address _crvRewards
    ) internal {
    	uint _routerArrayLength = _routerArray.length;
	    uint rewardsLength = IConvexRewards(_crvRewards).extraRewardsLength();
        for(uint i=0; i<_routerArrayLength; i++) {
            address _router = _routerArray[i];
            IERC20(_crv).safeApprove(address(_router), 0);
            IERC20(_crv).safeApprove(address(_router), type(uint256).max);
            IERC20(_cvx).safeApprove(address(_router), 0);
            IERC20(_cvx).safeApprove(address(_router), type(uint256).max);
            if (rewardsLength > 0) {
            	for(uint j=0; j<rewardsLength; j++) {
                    IERC20(IConvexRewards(IConvexRewards(_crvRewards).extraRewards(j)).rewardToken()).safeApprove(_router, 0);
                    IERC20(IConvexRewards(IConvexRewards(_crvRewards).extraRewards(j)).rewardToken()).safeApprove(_router, type(uint256).max);
            	}
            }	
    	}
    }
    
    function _deposit() internal override {
        convexVault.depositAll(pid, true);
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity(uint256 _estimate) internal {      
        uint256[2] memory amounts;
        amounts[0] = IERC20(tokens[0]).balanceOf(address(this));
        amounts[1] = IERC20(tokens[1]).balanceOf(address(this));
        IStableSwap2Pool(stableSwapPool).add_liquidity(amounts, _estimate);      
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
            _addLiquidity(_estimates[_extraRewardsLength + 3]);

            if (balanceOfWant() > 0) {
                _deposit();
            }
        }
    }

    function _withdrawAll() internal override {
        crvRewards.withdrawAllAndUnwrap(false);
    }

    function _withdraw(uint256 _amount) internal override {
        crvRewards.withdrawAndUnwrap(_amount, false);
    }

    function balanceOfPool() public view override returns (uint256) {
        return IERC20(address(crvRewards)).balanceOf(address(this));
    }

    function getEstimates() external view returns (uint256[] memory _estimates) {
    
        return _estimates;
    }
}
