// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../IStableSwap3Pool.sol";
import "../IMetaVault.sol";
import "../IVaultMaster.sol";
import "../IProfitSharer.sol";

import "../../interfaces/PickleJar.sol";
import "../../interfaces/PickleMasterChef.sol";
import "../../interfaces/Uniswap.sol";
import "../../interfaces/Balancer.sol";

/*

 A strategy must implement the following calls;

 - deposit()
 - withdraw(address) must exclude any tokens used in the yield - Controller role - withdraw should return to Controller
 - withdraw(uint) - Controller | Vault role - withdraw should always return to vault
 - withdrawAll() - Controller | Vault role - withdraw should always return to vault
 - balanceOf()

 Where possible, strategies must remain as immutable as possible, instead of updating variables, we update the contract by linking it in the controller

*/

contract StrategyPickle3Crv {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint;

    Uni public unirouter = Uni(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    address public want = address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
    address public p3crv = address(0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33);

    // used for pickle -> weth -> dai -> 3crv route
    address public pickle = address(0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5);
    address public weth = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public dai = address(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    address public usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address public usdt = address(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    address public t3crv = address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);

    PickleJar public pickleJar = PickleJar(p3crv);
    PickleMasterChef public pickleMasterChef = PickleMasterChef(0xbD17B1ce622d73bD438b9E658acA5996dc394b0d);
    uint public poolId = 14;

    uint public withdrawalFee = 50;
    uint constant public withdrawalMax = 10000;

    address public governance;
    address public controller;
    address public strategist;
    IVaultMaster public vaultMaster;
    IStableSwap3Pool public stableSwap3Pool;

    mapping(address => mapping(address => address[])) public uniswapPaths; // [input -> output] => uniswap_path
    mapping(address => mapping(address => address)) public balancerPools; // [input -> output] => balancer_pool

    constructor(address _controller, IVaultMaster _vaultMaster) public {
        controller = _controller;
        vaultMaster = _vaultMaster;
        governance = msg.sender;
        strategist = msg.sender;
        IERC20(want).safeApprove(address(pickleJar), type(uint256).max);
        IERC20(p3crv).safeApprove(address(pickleMasterChef), type(uint256).max);
        IERC20(weth).safeApprove(address(unirouter), type(uint256).max);
        IERC20(pickle).safeApprove(address(unirouter), type(uint256).max);
    }

    function getName() external pure returns (string memory) {
        return "StrategyPickle3Crv";
    }

    function setStrategist(address _strategist) external {
        require(msg.sender == governance, "!governance");
        strategist = _strategist;
    }

    function setWithdrawalFee(uint _withdrawalFee) external {
        require(msg.sender == governance, "!governance");
        withdrawalFee = _withdrawalFee;
    }

    function approveForSpender(IERC20 _token, address _spender, uint _amount) external {
        require(msg.sender == controller || msg.sender == governance || msg.sender == strategist, "!authorized");
        _token.safeApprove(_spender, _amount);
    }

    function setUnirouter(Uni _unirouter) external {
        require(msg.sender == governance || msg.sender == strategist, "!authorized");
        unirouter = _unirouter;
        IERC20(weth).safeApprove(address(unirouter), type(uint256).max);
        IERC20(pickle).safeApprove(address(unirouter), type(uint256).max);
    }

    function deposit() public {
        uint _wantBal = IERC20(want).balanceOf(address(this));
        if (_wantBal > 0) {
            pickleMasterChef.deposit(poolId, _wantBal);
        }
    }

    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint balance) {
        require(msg.sender == controller || msg.sender == governance || msg.sender == strategist, "!authorized");

        require(want != address(_asset), "want");
        require(p3crv != address(_asset), "p3crv");
        require(weth != address(_asset), "weth");
        require(dai != address(_asset), "dai");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(controller, balance);
    }

    // Withdraw partial funds, normally used with a vault withdrawal
    function withdraw(uint _amount) external {
        require(msg.sender == controller || msg.sender == governance || msg.sender == strategist, "!authorized");

        uint _balance = IERC20(want).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds

        IERC20(want).safeTransfer(_vault, _amount);
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external returns (uint balance) {
        require(msg.sender == controller || msg.sender == governance || msg.sender == strategist, "!authorized");
        _withdrawAll();

        balance = IERC20(want).balanceOf(address(this));

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault"); // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, balance);
    }

    function claimReward() public {
        pickleMasterChef.withdraw(poolId, 0);
    }

    function _withdrawAll() internal {
        (uint amount,) = pickleMasterChef.userInfo(poolId, address(this));
        pickleMasterChef.withdraw(poolId, amount);
        pickleJar.withdrawAll();
    }

    function setUnirouterPath(address _input, address _output, address [] memory _path) public {
        require(msg.sender == governance || msg.sender == strategist, "!authorized");
        uniswapPaths[_input][_output] = _path;
    }

    function setBalancerPools(address _input, address _output, address _pool) public {
        require(msg.sender == governance || msg.sender == strategist, "!authorized");
        balancerPools[_input][_output] = _pool;
        IERC20(_input).safeApprove(_pool, type(uint256).max);
    }

    function _swapTokens(address _input, address _output, uint256 _amount) internal {
        address _pool = balancerPools[_input][_output];
        if (_pool != address(0)) { // use ValueLiquid
            // swapExactAmountIn(tokenIn, tokenAmountIn, tokenOut, minAmountOut, maxPrice)
            Balancer(_pool).swapExactAmountIn(_input, _amount, _output, 1, type(uint256).max);
        } else { // use Uniswap
            address[] memory path = uniswapPaths[_input][_output];
            if (path.length == 0) {
                // path: _input -> _output
                path = new address[](2);
                path[0] = _input;
                path[1] = _output;
            }
            // swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)
            unirouter.swapExactTokensForTokens(_amount, 1, path, address(this), now.add(1800));
        }
    }

    // to get back want (3CRV)
    function _addLiquidity() internal {
        // 0: DAI, 1: USDC, 2: USDT
        uint[3] memory amounts;
        amounts[0] = IERC20(dai).balanceOf(address(this));
        amounts[1] = IERC20(usdc).balanceOf(address(this));
        amounts[2] = IERC20(usdt).balanceOf(address(this));
        // add_liquidity(uint[3] calldata amounts, uint min_mint_amount)
        stableSwap3Pool.add_liquidity(amounts, 1);
    }

    function harvest() external {
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        claimReward();
        uint _pickleBal = IERC20(pickle).balanceOf(address(this));

        _swapTokens(pickle, weth, _pickleBal);
        uint256 _wethBal = IERC20(weth).balanceOf(address(this));

        if (_wethBal > 0) {
            address profitSharer = vaultMaster.profitSharer();
            address performanceReward = vaultMaster.performanceReward();

            if (vaultMaster.stakingPoolShareFee() > 0 && profitSharer != address(0)) {
                address _yax = vaultMaster.yax();
                uint256 _stakingPoolShareFee = _wethBal.mul(vaultMaster.stakingPoolShareFee()).div(10000);
                _swapTokens(weth, _yax, _stakingPoolShareFee);
                IERC20(_yax).safeTransfer(profitSharer, IERC20(_yax).balanceOf(address(this)));
                IProfitSharer(profitSharer).shareProfit();
            }

            if (vaultMaster.gasFee() > 0 && performanceReward != address(0)) {
                uint256 _gasFee = _wethBal.mul(vaultMaster.gasFee()).div(10000);
                IERC20(weth).safeTransfer(performanceReward, _gasFee);
            }

            _wethBal = IERC20(weth).balanceOf(address(this));
            _swapTokens(weth, dai, _wethBal);
            _addLiquidity();

            uint _want = IERC20(want).balanceOf(address(this));
            if (_want > 0) {
                deposit(); // auto re-invest
            }
        }
    }

    function _withdrawSome(uint _amount) internal returns (uint) {
        if (withdrawalFee > 0) {
            _amount = _amount.mul(10000).div(10000 - withdrawalFee);
        }
        uint _ratio = pickleJar.getRatio();
        _amount = _amount.mul(1e18).div(_ratio);
        uint _before = pickleJar.balanceOf(address(this));
        pickleMasterChef.withdraw(poolId, _amount);
        uint _after = pickleJar.balanceOf(address(this));
        _amount = _after.sub(_before);
        _before = IERC20(want).balanceOf(address(this));
        pickleJar.withdrawAll();
        _after = IERC20(want).balanceOf(address(this));
        _amount = _after.sub(_before);
        return _amount;
    }

    function balanceOfWant() public view returns (uint) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfPool() public view returns (uint) {
        uint p3crvBal = pickleJar.balanceOf(address(this));
        (uint amount,) = pickleMasterChef.userInfo(poolId, address(this));
        return p3crvBal.add(amount).mul(pickleJar.getRatio()).div(1e18);
    }

    function balanceOf() public view returns (uint) {
        return balanceOfWant()
               .add(balanceOfPool());
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setController(address _controller) external {
        require(msg.sender == governance, "!governance");
        controller = _controller;
    }
}
