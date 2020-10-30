// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../IStrategy.sol";
import "../IMetaVault.sol";

import "../../interfaces/OneSplitAudit.sol";

interface Converter {
    function convert(address) external returns (uint);
}

contract StrategyControllerV1 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public onesplit = address(0x50FDA034C0Ce7a8f7EFDAebDA7Aa7cA21CC1267e);

    address public governance;
    address public strategist;

    // Vault to strategy mapping
    mapping(address => address) public vaults;

    // Strategy to vault mapping
    mapping(address => address) public strategies;

    mapping(address => mapping(address => address)) public converters;
    mapping(address => mapping(address => bool)) public approvedStrategies;

    bool public investEnabled = true;

    constructor() public {
        governance = msg.sender;
        strategist = msg.sender;
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setStrategist(address _strategist) public {
        require(msg.sender == governance, "!governance");
        strategist = _strategist;
    }

    function setOneSplit(address _onesplit) external {
        require(msg.sender == governance, "!governance");
        onesplit = _onesplit;
    }

    function setVault(address _token, address _vault) public {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        require(vaults[_token] == address(0), "vault");
        vaults[_token] = _vault;
    }

    function approveStrategy(address _token, address _strategy) public {
        require(msg.sender == governance, "!governance");
        approvedStrategies[_token][_strategy] = true;
    }

    function revokeStrategy(address _token, address _strategy) public {
        require(msg.sender == governance, "!governance");
        approvedStrategies[_token][_strategy] = false;
    }

    function setStrategy(address _token, address _strategy, bool _withdrawAll) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        require(approvedStrategies[_token][_strategy] == true, "!approved");
        if (_withdrawAll) {
            address _current = strategies[_token];
            if (_current != address(0)) {
                IStrategy(_current).withdrawAll();
            }
        }
        strategies[_token] = _strategy;
    }

    function setConverter(address _input, address _output, address _converter) public {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        converters[_input][_output] = _converter;
    }

    function setInvestEnabled(bool _investEnabled) public {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        investEnabled = _investEnabled;
    }

    function want(address _token) external view returns (address) {
        return IStrategy(strategies[_token]).want();
    }

    function earn(address _token, uint _amount) public {
        address _strategy = strategies[_token];
        address _want = IStrategy(_strategy).want();
        if (_want != _token) {
            address converter = converters[_token][_want];
            IERC20(_token).safeTransfer(converter, _amount);
            _amount = Converter(converter).convert(_strategy);
            IERC20(_want).safeTransfer(_strategy, _amount);
        } else {
            IERC20(_token).safeTransfer(_strategy, _amount);
        }
        IStrategy(_strategy).deposit();
    }

    function withdrawFee(address _token, uint _amount) external view returns (uint) {
        return (strategies[_token] == address(0)) ? 0 : IStrategy(strategies[_token]).withdrawFee(_amount);
    }

    function balanceOf(address _token) external view returns (uint) {
        return IStrategy(strategies[_token]).balanceOf();
    }

    function withdrawAll(address _strategy) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        // WithdrawAll sends 'want' to 'vault'
        IStrategy(_strategy).withdrawAll();
    }

    function inCaseTokensGetStuck(address _token, uint _amount) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        IERC20(_token).safeTransfer(governance, _amount);
    }

    function inCaseStrategyGetStuck(address _strategy, address _token) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        IStrategy(_strategy).withdraw(_token);
        IERC20(_token).safeTransfer(governance, IERC20(_token).balanceOf(address(this)));
    }

    function getExpectedReturn(address _strategy, address _token, uint parts) external view returns (uint expected) {
        uint _balance = IERC20(_token).balanceOf(_strategy);
        address _want = IStrategy(_strategy).want();
        (expected,) = OneSplitAudit(onesplit).getExpectedReturn(_token, _want, _balance, parts, 0);
    }

    function claimInsurance(address _vault) external {
        require(msg.sender == governance, "!governance");
        IMetaVault(_vault).claimInsurance();
    }

    // note that some strategies do not allow controller to harvest
    function harvestStrategy(address _strategy) external {
        require(msg.sender == strategist || msg.sender == governance, "!strategist");
        IStrategy(_strategy).harvest();
    }

    function withdraw(address _token, uint _amount) external {
        require(msg.sender == vaults[_token], "!vault");
        IStrategy(strategies[_token]).withdraw(_amount);
    }
}
