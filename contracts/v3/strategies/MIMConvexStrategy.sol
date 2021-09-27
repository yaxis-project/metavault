// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '../interfaces/IConvexVault.sol';
import '../interfaces/IStableSwap2Pool.sol';
import './BaseStrategy.sol';

contract MIMConvexStrategy is BaseStrategy {
    // used for Crv -> weth -> [mim/3crv] -> mimCrv route
    address public immutable crv;
    address public immutable cvx;

    address public immutable mim;
    address public immutable cvx3;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable mimCvxDepositLP;
    IConvexRewards public immutable crvRewards;
    IStableSwap2Pool public immutable stableSwap2Pool;

    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _cvx,
        address _weth,
        address _mim,
        address _cvx3,
        uint256 _pid,
        IConvexVault _convexVault,
        IStableSwap2Pool _stableSwap2Pool,
        address _controller,
        address _manager,
        address _router
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _router) {
        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        mim = _mim;
        cvx3 = _cvx3;
        pid = _pid;
        convexVault = _convexVault;
        mimCvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwap2Pool = _stableSwap2Pool;
        // Required to overcome "Stack Too Deep" error
        _setApprovals();
    }

    function _setApprovals() internal {
        IERC20(want).safeApprove(address(convexVault), type(uint256).max);
        IERC20(crv).safeApprove(address(router), type(uint256).max);
        IERC20(cvx).safeApprove(address(router), type(uint256).max);
        IERC20(mim).safeApprove(address(stableSwap2Pool), type(uint256).max);
        IERC20(cvx3).safeApprove(address(stableSwap2Pool), type(uint256).max);
        IERC20(want).safeApprove(address(stableSwap2Pool), type(uint256).max);
    }

    function _deposit() internal override {
        convexVault.depositAll(pid, true);
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity() internal {
        uint256[2] memory amounts;
        amounts[0] = IERC20(mim).balanceOf(address(this));
        amounts[1] = IERC20(cvx3).balanceOf(address(this));
        stableSwap2Pool.add_liquidity(amounts, 1);
    }

    function getMostPremium() public view returns (address, uint256) {
        uint256[] memory balances = new uint256[](2);
        balances[0] = stableSwap2Pool.balances(0); // MIM
        balances[1] = stableSwap2Pool.balances(1); // 3CRV

        if (balances[0] > balances[1]) {
            // MIM
            return (cvx3, 1);
        }

        return (mim, 0); // If they're somehow equal, we just want MIM
    }

    function _harvest(uint256 _estimatedWETH, uint256 _estimatedYAXIS) internal override {
        _claimReward();
        uint256 _cvxBalance = IERC20(cvx).balanceOf(address(this));
        if (_cvxBalance > 0) {
            _swapTokens(cvx, crv, _cvxBalance, 1);
        }

        uint256 _remainingWeth = _payHarvestFees(crv, _estimatedWETH, _estimatedYAXIS);

        if (_remainingWeth > 0) {
            (address _token, ) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _token, _remainingWeth, 1);
            _addLiquidity();

            if (balanceOfWant() > 0) {
                _deposit();
            }
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
