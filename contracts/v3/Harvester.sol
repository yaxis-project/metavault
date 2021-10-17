// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IVault.sol";
import "./interfaces/IController.sol";
import "./interfaces/IHarvester.sol";
import "./interfaces/ILegacyController.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/ISwap.sol";
import "./interfaces/IStableSwapPool.sol";
import "./interfaces/ExtendedIERC20.sol";
import "./interfaces/ICVXMinter.sol";
import "./interfaces/IConvexVault.sol";

/**
 * @title Harvester
 * @notice This contract is to be used as a central point to call
 * harvest on all strategies for any given vault. It has its own
 * permissions for harvesters (set by the strategist or governance).
 */
contract Harvester is IHarvester {
    using SafeMath for uint256;

    uint256 public constant ONE_HUNDRED_PERCENT = 10000;

    IManager public immutable override manager;
    IController public immutable controller;
    ILegacyController public immutable legacyController;

    uint256 public slippage;

    struct Strategy {
        uint256 timeout;
        uint256 lastCalled;
        address[] addresses;
    }

    mapping(address => Strategy) public strategies;
    mapping(address => bool) public isHarvester;

    /**
     * @notice Logged when harvest is called for a strategy
     */
    event Harvest(
        address indexed controller,
        address indexed strategy
    );

    /**
     * @notice Logged when a harvester is set
     */
    event HarvesterSet(address indexed harvester, bool status);

    /**
     * @notice Logged when a strategy is added for a vault
     */
    event StrategyAdded(address indexed vault, address indexed strategy, uint256 timeout);

    /**
     * @notice Logged when a strategy is removed for a vault
     */
    event StrategyRemoved(address indexed vault, address indexed strategy, uint256 timeout);

    /**
     * @param _manager The address of the yAxisMetaVaultManager contract
     * @param _controller The address of the controller
     */
    constructor(
        address _manager,
        address _controller,
        address _legacyController
    )
        public
    {
        manager = IManager(_manager);
        controller = IController(_controller);
        legacyController = ILegacyController(_legacyController);
    }

    /**
     * (GOVERNANCE|STRATEGIST)-ONLY FUNCTIONS
     */

    /**
     * @notice Adds a strategy to the rotation for a given vault and sets a timeout
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _timeout The timeout between harvests
     */
    function addStrategy(
        address _vault,
        address _strategy,
        uint256 _timeout
    )
        external
        override
        onlyController
    {
        strategies[_vault].addresses.push(_strategy);
        strategies[_vault].timeout = _timeout;
        emit StrategyAdded(_vault, _strategy, _timeout);
    }

    /**
     * @notice Removes a strategy from the rotation for a given vault and sets a timeout
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _timeout The timeout between harvests
     */
    function removeStrategy(
        address _vault,
        address _strategy,
        uint256 _timeout
    )
        external
        override
        onlyController
    {
        uint256 tail = strategies[_vault].addresses.length;
        uint256 index;
        bool found;
        for (uint i; i < tail; i++) {
            if (strategies[_vault].addresses[i] == _strategy) {
                index = i;
                found = true;
                break;
            }
        }

        if (found) {
            strategies[_vault].addresses[index] = strategies[_vault].addresses[tail.sub(1)];
            strategies[_vault].addresses.pop();
            strategies[_vault].timeout = _timeout;
            emit StrategyRemoved(_vault, _strategy, _timeout);
        }
    }

    /**
     * @notice Sets the status of a harvester address to be able to call harvest functions
     * @param _harvester The address of the harvester
     * @param _status The status to allow the harvester to harvest
     */
    function setHarvester(
        address _harvester,
        bool _status
    )
        external
        onlyStrategist
    {
        isHarvester[_harvester] = _status;
        emit HarvesterSet(_harvester, _status);
    }

    function setSlippage(
        uint256 _slippage
    )
        external
        onlyStrategist
    {
        require(_slippage < ONE_HUNDRED_PERCENT, "!_slippage");
        slippage = _slippage;
    }

    /**
     * HARVESTER-ONLY FUNCTIONS
     */

    function earn(
        address _strategy,
        IVault _vault,
        address _token
    )
        external
        onlyHarvester
    {
        _vault.earn(_token, _strategy);
    }

    /**
     * @notice Harvests a given strategy on the provided controller
     * @dev This function ignores the timeout
     * @param _controller The address of the controller
     * @param _strategy The address of the strategy
     */
    function harvest(
        IController _controller,
        address _strategy,
        uint256 _estimatedCRVWETH,
        uint256 _estimatedCVXWETH,
        uint256 _estimatedYAXIS,
        uint256[] memory _estimatedExtraWETH,
        uint256 _estimatedToken,
        uint256 _estimatedWant
    )
        public
        onlyHarvester
    {
        _controller.harvestStrategy(_strategy, _estimatedCRVWETH, _estimatedCVXWETH, _estimatedYAXIS, _estimatedExtraWETH, _estimatedToken, _estimatedWant);
        emit Harvest(address(_controller), _strategy);
    }

    /**
     * @notice Harvests the next available strategy for a given vault and
     * rotates the strategies
     * @param _vault The address of the vault
     */
    function harvestNextStrategy(
        address _vault,
        uint256 _estimatedCRVWETH,
        uint256 _estimatedCVXWETH,
        uint256 _estimatedYAXIS,
        uint256[] memory _estimatedExtraWETH,
        uint256 _estimatedToken,
        uint256 _estimatedWant
    )
        external
    {
        require(canHarvest(_vault), "!canHarvest");
        address strategy = strategies[_vault].addresses[0];
        harvest(controller, strategy, _estimatedCRVWETH, _estimatedCVXWETH, _estimatedYAXIS, _estimatedExtraWETH, _estimatedToken, _estimatedWant);
        uint256 k = strategies[_vault].addresses.length;
        if (k > 1) {
            address[] memory _strategies = new address[](k);
            for (uint i; i < k-1; i++) {
                _strategies[i] = strategies[_vault].addresses[i+1];
            }
            _strategies[k-1] = strategy;
            strategies[_vault].addresses = _strategies;
        }
        // solhint-disable-next-line not-rely-on-time
        strategies[_vault].lastCalled = block.timestamp;
    }

    /**
     * @notice Earns tokens in the LegacyController to the v3 vault
     * @param _token The address of the token
     * @param _expected The expected amount to deposit after conversion
     */
    function legacyEarn(
        address _token,
        uint256 _expected
    )
        external
        onlyHarvester
    {
        legacyController.legacyDeposit(_token, _expected);
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    /**
     * @notice Returns the addresses of the strategies for a given vault
     * @param _vault The address of the vault
     */
    function strategyAddresses(
        address _vault
    )
        external
        view
        returns (address[] memory)
    {
        return strategies[_vault].addresses;
    }

    /**
     * PUBLIC VIEW FUNCTIONS
     */

    /**
     * @notice Returns the availability of a vault's strategy to be harvested
     * @param _vault The address of the vault
     */
    function canHarvest(
        address _vault
    )
        public
        view
        returns (bool)
    {
        Strategy storage strategy = strategies[_vault];
        // only can harvest if there are strategies, and when sufficient time has elapsed
        return (strategy.addresses.length > 0 && strategy.lastCalled <= block.timestamp.sub(strategy.timeout));
    }

    /**
     * @notice Returns the estimated amount of WETH and YAXIS for the given strategy
     * @param _strategy The address of the strategy
     */
    function getEstimates(
        address _strategy
    )
        public
        view
        returns (uint256 _estimatedCRVWETH, uint256 _estimatedCVXWETH, uint256 _estimatedYAXIS, uint256[] memory _estimatedExtraWETH, uint256 _estimatedToken, uint256 _estimatedWant)
    {
        IStrategy strategy = IStrategy(_strategy);
        ISwap _router = strategy.router();
        uint256 _slippage = slippage;
        address[] memory _path;
        uint256[] memory _amounts;

        // Estimates for CRV -> WETH
        if (strategy.weth() != address(0) && strategy.crv() != address(0)) {
            _path[0] = strategy.crv();
            _path[1] = strategy.weth();
            _amounts = _router.getAmountsOut(
                strategy.crvRewards().earned(address(this)),
                _path
            );
            _estimatedCRVWETH = _amounts[1];
            
            if (_slippage > 0) {
                _estimatedCRVWETH = _estimatedCRVWETH - _estimatedCRVWETH.mul(_slippage).div(ONE_HUNDRED_PERCENT);
            }
        }

        // Estimates for CVX -> WETH
        if (strategy.weth() != address(0) && strategy.cvx() != address(0)) {
            _path[0] = strategy.cvx();
            _path[1] = strategy.weth();
            ICVXMinter minter = ICVXMinter(strategy.cvx());
            _amounts = _router.getAmountsOut(
                // Calculating CVX minted
                (strategy.crvRewards().earned(address(this))).mul(minter.totalCliffs().sub(minter.maxSupply().div(minter.reductionPerCliff()))).div(minter.totalCliffs()),
                _path
            );
            _estimatedCVXWETH = _amounts[1];
            
            if (_slippage > 0) {
                _estimatedCVXWETH = _estimatedCVXWETH - _estimatedCVXWETH.mul(_slippage).div(ONE_HUNDRED_PERCENT);
            }
        }
        
        // Estimates for extra rewards -> WETH
        uint256 _extraRewardsLength = strategy.crvRewards().extraRewardsLength();
        if (_extraRewardsLength > 0) {
            for (uint256 i = 0; i < _extraRewardsLength; i++) {
                _path[0] = IConvexRewards(strategy.crvRewards().extraRewards(i)).rewardToken();
                _path[1] = strategy.weth();
                _amounts = _router.getAmountsOut(
                    IConvexRewards(strategy.crvRewards().extraRewards(i)).earned(address(this)),
                    _path
                );
                _estimatedExtraWETH[i] = _amounts[1];
                if (_slippage > 0) {
                    _estimatedExtraWETH[i] = _estimatedExtraWETH[i] - _estimatedExtraWETH[i].mul(_slippage).div(ONE_HUNDRED_PERCENT);
                }
            }
        }
        
        // Estimates WETH -> YAXIS
        _path[0] = strategy.weth();
        _path[1] = manager.yaxis();
        uint256 _beforeFee = _estimatedCRVWETH + _estimatedCVXWETH;
        if (_extraRewardsLength > 0) {
            for (uint256 i = 0; i < _extraRewardsLength; i++) {
                _beforeFee += _estimatedExtraWETH[i];
            }
        }
        uint256 _fee = _beforeFee.mul(manager.treasuryFee()).div(ONE_HUNDRED_PERCENT);
        _amounts = ISwap(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D).getAmountsOut(_fee, _path); // Set to UniswapV2 to calculate output for YAXIS
        _estimatedYAXIS = _amounts[1];
        if (_slippage > 0) {
            _estimatedYAXIS = _estimatedYAXIS - _estimatedYAXIS.mul(_slippage).div(ONE_HUNDRED_PERCENT);
        }

        // Estimates for WETH -> 3CRV || Estimates for WETH -> Pooled token -> Want
        (address strategyPremium,) = strategy.getMostPremium();
        if (strategyPremium == strategy.crv3()) {
            IStableSwapPool strategyStablePool = IStableSwapPool(strategy.stableSwapPool());
            address premiumStable = getPremiumStable(strategy);
            _path[0] = strategy.weth();
            _path[1] = premiumStable;
            _amounts = _router.getAmountsOut(
                _beforeFee - _fee,
                _path
            );
            if (premiumStable == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 || premiumStable == 0xdAC17F958D2ee523a2206206994597C13D831ec7) {
                _amounts[1] = _amounts[1].mul(10**18).div(10**(ExtendedIERC20(premiumStable).decimals()));
            }
            _estimatedToken = _amounts[1];
            _estimatedWant = _amounts[1].div(strategyStablePool.get_virtual_price());
            if (_slippage > 0) {
                _estimatedToken = _amounts[1] - _amounts[1].mul(_slippage).div(ONE_HUNDRED_PERCENT);
                _estimatedWant = _estimatedWant - _estimatedWant.mul(_slippage).div(ONE_HUNDRED_PERCENT);
            }
        }
        else {
            _path[0] = strategy.weth();
            _path[1] = strategyPremium;
            _amounts = _router.getAmountsOut(
                _beforeFee - _fee,
                _path
            );
            _estimatedToken = _amounts[1];
            _estimatedWant = _amounts[1].div(IStableSwapPool(strategy.want()).get_virtual_price());
            if (_slippage > 0) {
                _estimatedToken = _estimatedToken - _estimatedToken.mul(_slippage).div(ONE_HUNDRED_PERCENT);
                _estimatedWant = _estimatedWant - _estimatedWant.mul(_slippage).div(ONE_HUNDRED_PERCENT);
            }            
        }
    }

    function getPremiumStable(IStrategy strategy) private view returns (address) {
        IStableSwapPool stableSwapPool = IStableSwapPool(strategy.crv3());
        uint daiBalance = stableSwapPool.balances(0);
        uint usdcBalance = stableSwapPool.balances(1).mul(10**18).div(10**(ExtendedIERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48).decimals())); // USDC address
        uint usdtBalance = stableSwapPool.balances(2).mul(10**12);
        address premiumStable = 0x6B175474E89094C44Da98b954EedeAC495271d0F; // DAI
        if (usdcBalance <= daiBalance && usdcBalance <= usdtBalance) {
            premiumStable = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC
        }
        if (usdtBalance <= daiBalance && usdtBalance <= usdcBalance) {
            premiumStable = 0xdAC17F958D2ee523a2206206994597C13D831ec7; // USDT
        }
        return premiumStable; 
    }

    /**
     * MODIFIERS
     */

    modifier onlyController() {
        require(manager.allowedControllers(msg.sender), "!controller");
        _;
    }

    modifier onlyHarvester() {
        require(isHarvester[msg.sender], "!harvester");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
