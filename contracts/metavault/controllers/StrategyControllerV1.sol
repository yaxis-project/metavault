// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../IStrategy.sol";
import "../IMetaVault.sol";

import "../../interfaces/OneSplitAudit.sol";

contract StrategyControllerV1 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public onesplit = address(0x50FDA034C0Ce7a8f7EFDAebDA7Aa7cA21CC1267e);

    address public governance;

    // Vault to strategy mapping
    mapping(address => address) public vaults;

    // Strategy to vault mapping
    mapping(address => address) public strategies;

    mapping(address => bool) public isVault;
    mapping(address => bool) public isStrategy;

    uint public split = 100; // 1% gas fee
    uint public constant max = 10000;

    constructor() public {
        governance = msg.sender;
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setSplit(uint _split) external {
        require(msg.sender == governance, "!governance");
        split = _split;
    }

    function setOneSplit(address _onesplit) external {
        require(msg.sender == governance, "!governance");
        onesplit = _onesplit;
    }

    function setStrategy(address _vault, address _strategy, bool _withdrawAll) external {
        require(msg.sender == governance, "!governance");
        if (_withdrawAll) {
            address _current = strategies[_vault];
            if (_current != address(0)) {
                IStrategy(_current).withdrawAll();
            }
        }
        strategies[_vault] = _strategy;
        isStrategy[_strategy] = true;
        vaults[_strategy] = _vault;
        isVault[_vault] = true;
    }

    function want(address _vault) external view returns (address) {
        return IStrategy(strategies[_vault]).want();
    }

    function earn(address _vault, uint _amount) public {
        address _strategy = strategies[_vault];
        address _want = IStrategy(_strategy).want();
        IERC20(_want).safeTransfer(_strategy, _amount);
        IStrategy(_strategy).deposit();
    }

    function withdrawFee(address _strategy, uint _amount) external view returns (uint) {
        return IStrategy(_strategy).withdrawFee(_amount);
    }

    function balanceOf(address _vault) external view returns (uint) {
        return IStrategy(strategies[_vault]).balanceOf();
    }

    function withdrawAll(address _strategy) external {
        require(msg.sender == governance, "!governance");
        // WithdrawAll sends 'want' to 'vault'
        IStrategy(_strategy).withdrawAll();
    }

    function inCaseTokensGetStuck(address _token, uint _amount) external {
        require(msg.sender == governance, "!governance");
        IERC20(_token).safeTransfer(governance, _amount);
    }

    function inCaseStrategyGetStruck(address _strategy, address _token) external {
        require(msg.sender == governance, "!governance");
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
        IStrategy(_strategy).harvest();
    }

    function withdraw(address _vault, uint _amount) external {
        require(isVault[msg.sender] == true, "!vault");
        IStrategy(strategies[_vault]).withdraw(_amount);
    }
}
