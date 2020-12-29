// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./IController.sol";
import "./IVaultManager.sol";

contract yAxisMetaVaultHarvester {
    using SafeMath for uint256;

    IVaultManager public vaultManager;
    IController public controller;

    struct Strategy {
        uint256 timeout;
        uint256 lastCalled;
        address[] addresses;
    }

    mapping(address => Strategy) public strategies;
    mapping(address => bool) public isHarvester;

    /**
     * @notice Logged when a controller is set
     */
    event ControllerSet(address indexed controller);

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
     * @notice Logged when a strategy is added for a token
     */
    event StrategyAdded(address indexed token, address indexed strategy, uint256 timeout);

    /**
     * @notice Logged when a strategy is removed for a token
     */
    event StrategyRemoved(address indexed token, address indexed strategy, uint256 timeout);

    constructor(address _vaultManager) public {
        vaultManager = IVaultManager(_vaultManager);
    }

    function setHarvester(address _harvester, bool _status) public onlyStrategist {
        isHarvester[_harvester] = _status;
        emit HarvesterSet(_harvester, _status);
    }

    function setController(IController _controller) external onlyStrategist {
        controller = _controller;
        emit ControllerSet(address(_controller));
    }

    function addStrategy(
        address _token,
        address _strategy,
        uint256 _timeout
    ) external onlyStrategist {
        strategies[_token].addresses.push(_strategy);
        strategies[_token].timeout = _timeout;
        emit StrategyAdded(_token, _strategy, _timeout);
    }

    function removeStrategy(
        address _token,
        address _strategy,
        uint256 _timeout
    ) external onlyStrategist {
        uint256 tail = strategies[_token].addresses.length;
        uint256 index;
        bool found;
        for (uint i; i < tail; i++) {
            if (strategies[_token].addresses[i] == _strategy) {
                index = i;
                found = true;
                break;
            }
        }
        require(found, "!found");
        strategies[_token].addresses[index] = strategies[_token].addresses[tail.sub(1)];
        strategies[_token].addresses.pop();
        strategies[_token].timeout = _timeout;
        emit StrategyRemoved(_token, _strategy, _timeout);
    }

    function harvest(
        IController _controller,
        address _strategy
    ) public onlyHarvester {
        _controller.harvestStrategy(_strategy);
        emit Harvest(address(_controller), _strategy);
    }

    function harvestNextStrategy(address _token) external onlyHarvester {
        address strategy = strategies[_token].addresses[0];
        harvest(controller, strategy);
        uint256 k = strategies[_token].addresses.length;
        if (k > 1) {
            address[] memory _strategies = new address[](k);
            for (uint i; i < k; i++) {
                _strategies[i] = strategies[_token].addresses[i+1];
            }
            _strategies[k-1] = strategy;
            strategies[_token].addresses = _strategies;
        }
        strategies[_token].lastCalled = block.timestamp;
    }

    function canHarvest(address _token) external view returns (bool) {
        Strategy storage strategy = strategies[_token];
        if (strategy.addresses.length == 0 ||
            strategy.lastCalled > block.timestamp.sub(strategy.timeout)) {
            return false;
        }
        return true;
    }

    modifier onlyHarvester() {
        require(isHarvester[msg.sender], "!harvester");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == vaultManager.strategist()
             || msg.sender == vaultManager.governance(),
             "!strategist"
        );
        _;
    }
}
