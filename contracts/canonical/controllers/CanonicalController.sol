// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";
import "../interfaces/ICanonicalVault.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IVaultManager.sol";

/**
 * @title StrategyControllerV3
 * @notice This controller allows multiple strategies to be used
 * for a single token, and multiple tokens are supported.
 */
contract CanonicalController is IController {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    bool public globalInvestEnabled;
    uint256 public maxStrategies;
    IVaultManager public vaultManager;

    struct VaultDetail {
        address converter;
        address[] strategies;
        mapping(address => uint256) index;
        mapping(address => uint256) caps;
    }

    // vault => Vault
    mapping(address => VaultDetail) internal _vaultDetails;
    // token => vault
    mapping(address => address) public override vaults;

    /**
     * @notice Logged when earn is called for a strategy
     */
    event Earn(address indexed token, address indexed strategy);

    /**
     * @notice Logged when harvest is called for a strategy
     */
    event Harvest(address indexed strategy);

    /**
     * @notice Logged when insurance is claimed for a vault
     */
    event InsuranceClaimed(address indexed vault);

    /**
     * @notice Logged when a strategy is added for a token
     */
    event StrategyAdded(address indexed token, address indexed strategy, uint256 cap);

    /**
     * @notice Logged when a strategy is removed for a token
     */
    event StrategyRemoved(address indexed token, address indexed strategy);

    /**
     * @notice Logged when strategies are reordered for a token
     */
    event StrategiesReordered(
        address indexed token,
        address indexed strategy1,
        address indexed strategy2
    );

    /**
     * @param _vaultManager The address of the vaultManager
     */
    constructor(address _vaultManager) public {
        vaultManager = IVaultManager(_vaultManager);
        globalInvestEnabled = true;
        maxStrategies = 10;
    }

    /**
     * GOVERNANCE-ONLY FUNCTIONS
     */

    /**
     * @notice Adds a strategy for a given token
     * @dev Only callable by governance
     * @param _vault The address of the vault
     * @param _token The address of the token
     * @param _strategy The address of the strategy
     * @param _cap The cap of the strategy
     */
    function addStrategy(
        address _vault,
        address _token,
        address _strategy,
        uint256 _cap
    ) external onlyGovernance {
        require(vaults[_token] != address(0), "!vaults");
        require(_vaultDetails[_vault].converter != address(0), "!converter");
        // get the index of the newly added strategy
        uint256 index = _vaultDetails[_vault].strategies.length;
        // ensure we haven't added too many strategies already
        require(index < maxStrategies, "!maxStrategies");
        // push the strategy to the array of strategies
        _vaultDetails[_vault].strategies.push(_strategy);
        // set the cap
        _vaultDetails[_vault].caps[_strategy] = _cap;
        // set the index
        _vaultDetails[_vault].index[_strategy] = index;
        emit StrategyAdded(_token, _strategy, _cap);
    }

    /**
     * @notice Sets the address of the vault manager contract
     * @dev Only callable by governance
     * @param _vaultManager The address of the vault manager
     */
    function setVaultManager(address _vaultManager) external onlyGovernance {
        vaultManager = IVaultManager(_vaultManager);
    }

    /**
     * (GOVERNANCE|STRATEGIST)-ONLY FUNCTIONS
     */

    /**
     * @notice Withdraws token from a strategy to governance
     * @dev Only callable by governance or the strategist
     * @param _strategy The address of the strategy
     * @param _token The address of the token
     */
    function inCaseStrategyGetStuck(
        address _strategy,
        address _token
    ) external onlyStrategist {
        IStrategy(_strategy).withdraw(_token);
        IERC20(_token).safeTransfer(
            vaultManager.governance(),
            IERC20(_token).balanceOf(address(this))
        );
    }

    /**
     * @notice Withdraws token from the controller to governance
     * @dev Only callable by governance or the strategist
     * @param _token The address of the token
     * @param _amount The amount that will be withdrawn
     */
    function inCaseTokensGetStuck(
        address _token,
        uint256 _amount
    ) external onlyStrategist {
        IERC20(_token).safeTransfer(vaultManager.governance(), _amount);
    }

    /**
     * @notice Removes a strategy for a given token
     * @dev Only callable by governance or strategist
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     */
    function removeStrategy(
        address _vault,
        address _strategy
    ) external onlyStrategist {
        VaultDetail storage vaultDetail = _vaultDetails[_vault];
        // get the index of the strategy to remove
        uint256 index = vaultDetail.index[_strategy];
        // get the index of the last strategy
        uint256 tail = vaultDetail.strategies.length.sub(1);
        // get the address of the last strategy
        address replace = vaultDetail.strategies[tail];
        // replace the removed strategy with the tail
        vaultDetail.strategies[index] = replace;
        // set the new index for the replaced strategy
        vaultDetail.index[replace] = index;
        // remove the duplicate replaced strategy
        vaultDetail.strategies.pop();
        // remove the strategy's index
        delete vaultDetail.index[_strategy];
        // remove the strategy's cap
        delete vaultDetail.caps[_strategy];
        // pull funds from the removed strategy to the vault
        IStrategy(_strategy).withdrawAll();
        emit StrategyRemoved(_vault, _strategy);
    }

    /**
     * @notice Reorders two strategies for a given token
     * @dev Only callable by governance or strategist
     * @param _vault The address of the vault
     * @param _strategy1 The address of the first strategy
     * @param _strategy2 The address of the second strategy
     */
    function reorderStrategies(
        address _vault,
        address _strategy1,
        address _strategy2
    ) external onlyStrategist {
        VaultDetail storage vaultDetail = _vaultDetails[_vault];
        // get the indexes of the strategies
        uint256 index1 = vaultDetail.index[_strategy1];
        uint256 index2 = vaultDetail.index[_strategy2];
        // set the new addresses at their indexes
        vaultDetail.strategies[index1] = _strategy2;
        vaultDetail.strategies[index2] = _strategy1;
        // update indexes
        vaultDetail.index[_strategy1] = index2;
        vaultDetail.index[_strategy2] = index1;
        emit StrategiesReordered(_vault, _strategy1, _strategy2);
    }

    /**
     * @notice Sets/updates the cap of a strategy for a token
     * @dev Only callable by governance or strategist
     * @dev If the balance of the strategy is greater than the new cap (except if
     * the cap is 0), then withdraw the difference from the strategy to the vault.
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _cap The new cap of the strategy
     */
    function setCap(
        address _vault,
        address _strategy,
        uint256 _cap
    ) external onlyStrategist {
        _vaultDetails[_vault].caps[_strategy] = _cap;
        uint256 _balance = IStrategy(_strategy).balanceOf();
        // send excess funds (over cap) back to the vault
        if (_balance > _cap && _cap != 0) {
            uint256 _diff = _balance.sub(_cap);
            IStrategy(_strategy).withdraw(_diff);
        }
    }

    /**
     * @notice Sets/updates the converter for a given vault
     * @dev Only callable by governance or strategist
     * @param _vault The address of the vault
     * @param _converter The address of the converter
     */
    function setConverter(
        address _vault,
        address _converter
    ) external onlyStrategist {
        _vaultDetails[_vault].converter = _converter;
    }

    /**
     * @notice Sets/updates the global invest enabled flag
     * @dev Only callable by governance or strategist
     * @param _investEnabled The new bool of the invest enabled flag
     */
    function setInvestEnabled(bool _investEnabled) external onlyStrategist {
        globalInvestEnabled = _investEnabled;
    }

    /**
     * @notice Sets/updates the maximum number of strategies for a token
     * @dev Only callable by governance or strategist
     * @param _maxStrategies The new value of the maximum strategies
     */
    function setMaxStrategies(uint256 _maxStrategies) external onlyStrategist {
      maxStrategies = _maxStrategies;
    }

    /**
     * @notice Sets the address of a vault for a given token
     * @dev Only callable by governance or strategist
     * @param _token The address of the token
     * @param _vault The address of the vault
     */
    function addVaultToken(address _token, address _vault) external onlyStrategist {
        require(vaults[_token] == address(0), "vault");
        vaults[_token] = _vault;
        ICanonicalVault(_vault).addToken(_token);
    }

    function removeVaultToken(address _token, address _vault) external onlyStrategist {
        require(vaults[_token] != address(0), "!vault");
        delete vaults[_token];
        ICanonicalVault(_vault).removeToken(_token);
    }

    /**
     * @notice Withdraws all funds from a strategy
     * @dev Only callable by governance or the strategist
     * @param _strategy The address of the strategy
     */
    function withdrawAll(address _strategy) external override onlyStrategist {
        // WithdrawAll sends 'want' to 'vault'
        IStrategy(_strategy).withdrawAll();
    }

    /**
     * (GOVERNANCE|STRATEGIST|HARVESTER)-ONLY FUNCTIONS
     */

    /**
     * @notice Harvests the specified strategy
     * @dev Only callable by governance, the strategist, or the harvester
     * @param _strategy The address of the strategy
     */
    function harvestStrategy(address _strategy) external override onlyHarvester {
        IStrategy(_strategy).harvest();
        emit Harvest(_strategy);
    }

    /**
     * VAULT-ONLY FUNCTIONS
     */

    /**
     * @notice Invests funds into a strategy
     * @dev Only callable by a vault
     * @param _token The address of the token
     * @param _amount The amount that will be invested
     */
    function earn(address _token, uint256 _amount) external override onlyVault(_token) {
        // get the first strategy that will accept the deposit
        address _strategy = getBestStrategyEarn(msg.sender, _amount);
        if (_strategy != address(0)) {
            // get the want token of the strategy
            address _want = IStrategy(_strategy).want();
            if (_want != _token) {
                IConverter _converter = IConverter(_vaultDetails[vaults[_token]].converter);
                IERC20(_token).safeTransfer(address(_converter), _amount);
                _amount = _converter.convert(_token, _want, _amount);
                IERC20(_want).safeTransfer(_strategy, _amount);
            } else {
                IERC20(_token).safeTransfer(_strategy, _amount);
            }
            // call the strategy deposit function
            IStrategy(_strategy).deposit();
            emit Earn(_token, _strategy);
        }
    }

    /**
     * @notice Withdraws funds from a strategy
     * @dev Only callable by a vault
     * @dev If the withdraw amount is greater than the first strategy given
     * by getBestStrategyWithdraw, this function will loop over strategies
     * until the requested amount is met.
     * @param _token The address of the token
     * @param _amount The amount that will be withdrawn
     */
    function withdraw(address _token, uint256 _amount) external override onlyVault(_token) {
        (
            address[] memory _strategies,
            uint256[] memory _amounts
        ) = getBestStrategyWithdraw(_token, _amount);
        for (uint i = 0; i < _strategies.length; i++) {
            // getBestStrategyWithdraw will return arrays larger than needed
            // if this happens, simply exit the loop
            if (_strategies[i] == address(0)) {
                break;
            }
            IStrategy(_strategies[i]).withdraw(_amounts[i]);
            address _want = IStrategy(_strategies[i]).want();
            if (_want != _token) {
                IConverter(_vaultDetails[vaults[_token]].converter).convert(_want, _token, _amounts[i]);
            }
        }
        IERC20(_token).safeTransfer(vaults[_token], IERC20(_token).balanceOf(address(this)));
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    /**
     * @notice Returns the balance of the sum of all strategies for a given token
     * @dev This function would make deposits more expensive for the more strategies
     * that are added for a given token
     */
    function balanceOf() external view override returns (uint256 _balance) {
        uint256 k = _vaultDetails[msg.sender].strategies.length;
        for (uint i = 0; i < k; i++) {
            IStrategy _strategy = IStrategy(_vaultDetails[msg.sender].strategies[i]);
            _balance = _balance.add(_strategy.balanceOf());
        }
    }

    /**
     * @notice Returns the cap of a strategy for a given token
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     */
    function getCap(address _vault, address _strategy) external view returns (uint256) {
        return _vaultDetails[_vault].caps[_strategy];
    }

    /**
     * @notice Returns whether investing is enabled for the calling vault
     * @dev Should be called by the vault
     */
    function investEnabled() external view override returns (bool) {
        if (globalInvestEnabled) {
            return _vaultDetails[msg.sender].strategies.length > 0;
        }
        return false;
    }

    /**
     * @notice Returns all the strategies for a given token
     * @param _token The address of the token
     */
    function strategies(address _token) external view returns (address[] memory) {
        return _vaultDetails[vaults[_token]].strategies;
    }

    /**
     * PUBLIC VIEW FUNCTIONS
     */

    /**
     * @notice Returns the best (optimistic) strategy for funds to be sent to with earn
     * @param _vault The address of the vault
     * @param _amount The amount that will be invested
     */
    function getBestStrategyEarn(
        address _vault,
        uint256 _amount
    ) public view returns (address _strategy) {
        uint256 k = _vaultDetails[_vault].strategies.length;
        if (k > 0) {
            // get the index of the last strategy
            k = k - 1;
            // scan backwards from the index to the beginning of strategies
            for (uint i = k; i >= 0; i--) {
                _strategy = _vaultDetails[_vault].strategies[i];
                // get the new balance if the _amount were added to the strategy
                uint256 balance = IStrategy(_strategy).balanceOf().add(_amount);
                uint256 cap = _vaultDetails[_vault].caps[_strategy];
                // stop scanning if the deposit wouldn't go over the cap
                if (balance <= cap || cap == 0) {
                    break;
                }
            }
            // if never broken from the loop, use the last scanned strategy
            // this could cause it to go over cap if (for some reason) no strategies
            // were added with 0 cap
        }
    }

    /**
     * @notice Returns the best (optimistic) strategy for funds to be withdrawn from
     * @dev Since Solidity doesn't support dynamic arrays in memory, the returned arrays
     * from this function will always be the same length as the amount of strategies for
     * a token. Check that _strategies[i] != address(0) when consuming to know when to
     * break out of the loop.
     * @param _token The address of the token
     * @param _amount The amount that will be withdrawn
     */
    function getBestStrategyWithdraw(
        address _token,
        uint256 _amount
    ) public view returns (
        address[] memory _strategies,
        uint256[] memory _amounts
    ) {
        // get the length of strategies for a single token
        address _vault = vaults[_token];
        uint256 k = _vaultDetails[_vault].strategies.length;
        // initialize fixed-length memory arrays
        _strategies = new address[](k);
        _amounts = new uint256[](k);
        address _strategy;
        uint256 _balance;
        // scan forward from the the beginning of strategies
        for (uint i = 0; i < k; i++) {
            _strategy = _vaultDetails[_vault].strategies[i];
            _strategies[i] = _strategy;
            // get the balance of the strategy
            _balance = IStrategy(_strategy).balanceOf();
            // if the strategy doesn't have the balance to cover the withdraw
            if (_balance < _amount) {
                // withdraw what we can and add to the _amounts
                _amounts[i] = _balance;
                _amount = _amount.sub(_balance);
            } else {
                // stop scanning if the balance is more than the withdraw amount
                _amounts[i] = _amount;
                break;
            }
        }
    }

    /**
     * MODIFIERS
     */

    modifier onlyGovernance() {
        require(msg.sender == vaultManager.governance(), "!governance");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == vaultManager.strategist()
             || msg.sender == vaultManager.governance(),
             "!strategist"
        );
        _;
    }

    modifier onlyHarvester() {
        require(
            msg.sender == vaultManager.harvester() ||
            msg.sender == vaultManager.strategist() ||
            msg.sender == vaultManager.governance(),
            "!harvester"
        );
        _;
    }

    modifier onlyVault(address _token) {
        require(msg.sender == vaults[_token], "!vault");
        _;
    }
}
