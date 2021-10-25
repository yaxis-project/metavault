// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '../interfaces/IConvexVault.sol';
import './BaseStrategy.sol';
import '../interfaces/ICVXMinter.sol';
import '../interfaces/IHarvester.sol';
import '../interfaces/ExtendedIERC20.sol';

contract ConvexStrategy is BaseStrategy {
    // used for Crv -> weth -> [dai/usdc/usdt] -> 3crv route
    address public immutable crv;
    address public immutable cvx;

    // for add_liquidity via curve.fi to get back 3CRV (use getMostPremium() for the best stable coin used in the route)
    address public immutable dai;
    address public immutable usdc;
    address public immutable usdt;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable cvxDepositLP;
    IConvexRewards public immutable crvRewards;
    IStableSwap3Pool public immutable stableSwap3Pool;

    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _cvx,
        address _weth,
        address _dai,
        address _usdc,
        address _usdt,
        uint256 _pid,
        IConvexVault _convexVault,
        IStableSwap3Pool _stableSwap3Pool,
        address _controller,
        address _manager,
        address[] memory _routerArray // [0]=Sushiswap, [1]=Uniswap
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _routerArray) {
        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;
        pid = _pid;
        convexVault = _convexVault;
        cvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwap3Pool = _stableSwap3Pool;
        // Required to overcome "Stack Too Deep" error
        _setApprovals(
            _want,
            _crv,
            _cvx,
            _dai,
            _usdc,
            _usdt,
            address(_convexVault),
            _routerArray,
            address(_stableSwap3Pool)
        );
    }

    function _setApprovals(
        address _want,
        address _crv,
        address _cvx,
        address _dai,
        address _usdc,
        address _usdt,
        address _convexVault,
        address[] memory _routerArray,
        address _stableSwap3Pool
    ) internal {
        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
            for(uint i=0; i<_routerArray.length; i++) {
                IERC20(_crv).safeApprove(address(_routerArray[i]), 0);
                IERC20(_crv).safeApprove(address(_routerArray[i]), type(uint256).max);
                IERC20(_cvx).safeApprove(address(_routerArray[i]), 0);
                IERC20(_cvx).safeApprove(address(_routerArray[i]), type(uint256).max);
            }
        IERC20(_dai).safeApprove(address(_stableSwap3Pool), type(uint256).max);
        IERC20(_usdc).safeApprove(address(_stableSwap3Pool), type(uint256).max);
        IERC20(_usdt).safeApprove(address(_stableSwap3Pool), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwap3Pool), type(uint256).max);
    }

    function _deposit() internal override {
        convexVault.depositAll(pid, true);
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity(uint256 _estimate) internal {
        uint256[3] memory amounts;
        amounts[0] = IERC20(dai).balanceOf(address(this));
        amounts[1] = IERC20(usdc).balanceOf(address(this));
        amounts[2] = IERC20(usdt).balanceOf(address(this));
        stableSwap3Pool.add_liquidity(amounts, _estimate);
    }

    function getMostPremium() public view returns (address, uint256) {
        uint256[] memory balances = new uint256[](3);
        balances[0] = stableSwap3Pool.balances(0); // DAI
        balances[1] = stableSwap3Pool.balances(1).mul(10**12); // USDC
        balances[2] = stableSwap3Pool.balances(2).mul(10**12); // USDT

        if (balances[0] < balances[1] && balances[0] < balances[2]) {
            // DAI
            return (dai, 0);
        }

        if (balances[1] < balances[0] && balances[1] < balances[2]) {
            // USDC
            return (usdc, 1);
        }

        if (balances[2] < balances[0] && balances[2] < balances[1]) {
            // USDT
            return (usdt, 2);
        }

        return (dai, 0); // If they're somehow equal, we just want DAI
    }

    function _harvest(uint256[] memory _estimates) internal override {
        _claimReward();
        uint256 _cvxBalance = IERC20(cvx).balanceOf(address(this));
        if (_cvxBalance > 0) {
            _swapTokens(cvx, weth, _cvxBalance, _estimates[0]);
        }
        // routerArray[1] sets router to Uniswap to swap WETH->YAXIS
        uint256 _remainingWeth = _payHarvestFees(crv, _estimates[1], _estimates[2], routerArray[1]);
        setRouterInternal(routerArray[0]); // Set router to routerArray[0] == Sushiswap router

        if (_remainingWeth > 0) {
            (address _stableCoin, ) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _stableCoin, _remainingWeth, _estimates[3]);
            _addLiquidity(_estimates[4]);

            if (balanceOfWant() > 0) {
                _deposit();
            }
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

        // Estimates for CRV -> WETH
        _path[0] = crv;
        _path[1] = weth;
        _amounts = router.getAmountsOut(
            crvRewards.earned(address(this)),
            _path
        );
        _estimates[1] = _amounts[1] - _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

        wethAmount += _estimates[1];

        // Estimates WETH -> YAXIS
        _path[0] = weth;
        _path[1] = manager.yaxis();
        _amounts = ISwap(routerArray[1]).getAmountsOut(wethAmount.mul(manager.treasuryFee()).div(ONE_HUNDRED_PERCENT), _path); // Set to UniswapV2 to calculate output for YAXIS
        _estimates[2] = _amounts[1] - _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);
        
        // Estimates for WETH -> Stablecoin
        (address _targetCoin,) = getMostPremium(); 
        _path[0] = weth;
        _path[1] = _targetCoin;
        _amounts = router.getAmountsOut(
            wethAmount - _amounts[0],
            _path
        );
        _estimates[3] = _amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage);

        // Estimates for Stablecoin -> 3CRV
        _estimates[4] = (_amounts[1].mul(ONE_HUNDRED_PERCENT - _slippage).mul(10**18).div(10**(ExtendedIERC20(_targetCoin).decimals())).div(stableSwap3Pool.get_virtual_price())).mul(ONE_HUNDRED_PERCENT - _slippage);
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
