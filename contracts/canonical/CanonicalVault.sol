// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./interfaces/IVaultManager.sol";
import "./interfaces/IController.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/ICanonicalVault.sol";

contract CanonicalVault is ERC20, ICanonicalVault {
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX = 10000;

    // Governance-updated variables
    address public override controller;
    address public override vaultManager;

    // Strategist|Governance-updated variables
    uint256 public min;
    uint256 public earnLowerlimit;
    uint256 public totalDepositCap;

    // Only allowed contracts may interact with the vault
    mapping(address => bool) public allowedContracts;

    address[] public tokens;

    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);
    event Earn(address indexed token, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor(
        string memory _name,
        string memory _symbol
    ) public ERC20(_name, _symbol) {
        min = 9500;
        earnLowerlimit = 500 ether;
        totalDepositCap = 10000000 ether;
    }

    function addToken(
        address _token
    )
        external
        override
        onlyController
    {
        tokens.push(_token);
        emit TokenAdded(_token);
    }

    function removeToken(
        address _token
    )
        external
        override
        onlyController
    {
        uint256 k = tokens.length;
        uint256 index;

        for (uint i = 0; i < k; i++) {
            if (tokens[i] == _token) {
                index = i;
                break;
            }
        }

        tokens[index] = tokens[k-1];
        tokens.pop();
        emit TokenRemoved(_token);
    }

    function setController(
        address _controller
    )
        external
        onlyGovernance
    {
        controller = _controller;
    }

    function setVaultManager(
        address _vaultManager
    )
        external
        onlyGovernance
    {
        vaultManager = _vaultManager;
    }

    function setMin(
        uint256 _min
    )
        external
        onlyStrategist
    {
        min = _min;
    }

    function setEarnLowerlimit(
        uint256 _earnLowerlimit
    )
        external
        onlyStrategist
    {
        earnLowerlimit = _earnLowerlimit;
    }

    function setTotalDepositCap(
        uint256 _totalDepositCap
    )
        external
        onlyStrategist
    {
        totalDepositCap = _totalDepositCap;
    }

    function setAllowedContract(
        address _contract,
        bool _allowed
    )
        external
        onlyStrategist
    {
        allowedContracts[_contract] = _allowed;
    }

    function earn(address _token)
        public
        override
    {
        IController _controller = IController(controller);
        if (address(_controller) != address(0)) {
            if (_controller.investEnabled()) {
                uint256 _balance = available(_token);
                IERC20(_token).safeTransfer(address(_controller), _balance);
                _controller.earn(_token, _balance);
                emit Earn(_token, _balance);
            }
        }
    }

    function deposit(
        address _token,
        uint256 _amount
    )
        external
        checkContract
    {
        require(_amount > 0, "!_amount");
        require(IController(controller).vaults(_token) == address(this), "!_token");
        uint256 _balance = balance();
        uint256 _before = IERC20(_token).balanceOf(address(this));

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        uint256 _after = IERC20(_token).balanceOf(address(this));
        require(totalDepositCap == 0 || _after <= totalDepositCap, ">totalDepositCap");
        _amount = _after.sub(_before); // Additional check for deflationary tokens
        if (_amount > 0) {
            _deposit(msg.sender, _token, _balance, _amount);
        }
    }

    function depositAll(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    )
        external
        checkContract
    {
        uint256 _balance = balance();

        for (uint8 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] > 0) {
                require(IController(controller).vaults(_tokens[i]) == address(this), "!_tokens");
                uint256 _before = IERC20(_tokens[i]).balanceOf(address(this));

                IERC20(_tokens[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);

                uint256 _after = IERC20(_tokens[i]).balanceOf(address(this));
                require(totalDepositCap == 0 || _after <= totalDepositCap, ">totalDepositCap");
                uint256 _amount = _after.sub(_before); // Additional check for deflationary tokens
                if (_amount > 0) {
                    _deposit(msg.sender, _tokens[i], _balance, _amount);
                }
            }
        }
    }

    function _deposit(
        address _account,
        address _token,
        uint256 _balance,
        uint256 _amount
    )
        internal
        returns (uint256 _shares)
    {
        if (totalSupply() == 0) {
            _shares = _amount;
        } else {
            _shares = (_amount.mul(totalSupply())).div(_balance);
        }
        if (_shares > 0) {
            if (IERC20(_token).balanceOf(address(this)) > earnLowerlimit) {
                earn(_token);
            }
            _mint(_account, _shares);
        }

        emit Deposit(_account, _shares);
    }

    function withdrawAll(
        address _output
    )
        external
        checkContract
    {
        withdraw(balanceOf(msg.sender), _output);
    }

    function withdraw(
        uint256 _shares,
        address _output
    )
        public
        override
        checkContract
    {
        require(IController(controller).vaults(_output) == address(this), "!_output");
        uint256 _userBal = balanceOf(msg.sender);
        uint256 _rate = (balance().mul(_shares)).div(totalSupply());
        _burn(msg.sender, _shares);

        if (vaultManager != address(0)) {
            // expected 0.1% of withdrawal go back to vault (for auto-compounding) to protect withdrawals
            // it is updated by governance (community vote)
            uint256 _withdrawalProtectionFee = IVaultManager(vaultManager).withdrawalProtectionFee();
            if (_withdrawalProtectionFee > 0) {
                uint256 _withdrawalProtection = _rate.mul(_withdrawalProtectionFee).div(MAX);
                _rate = _rate.sub(_withdrawalProtection);
            }
        }

        // Check balance
        uint256 _balance = IERC20(_output).balanceOf(address(this));
        if (_balance < _rate) {
            uint256 _toWithdraw = _rate.sub(_balance);
            if (controller != address(0)) {
                IController(controller).withdraw(_output, _toWithdraw);
            }
            uint256 _after = IERC20(_output).balanceOf(address(this));
            uint256 _diff = _after.sub(_balance);
            if (_diff < _toWithdraw) {
                _rate = _balance.add(_diff);
            }
        }

        IERC20(_output).safeTransfer(msg.sender, _rate);
        emit Withdraw(msg.sender, _rate);
    }

    /**
     * VIEWS
     */

    // Custom logic in here for how much the vault allows to be borrowed
    // Sets minimum required on-hand to keep small withdrawals cheap
    function available(
        address _token
    )
        public
        override
        view
        returns (uint256)
    {
        return IERC20(_token).balanceOf(address(this)).mul(min).div(MAX);
    }

    function balance()
        public
        override
        view
        returns (uint256 _balance)
    {
        return IController(controller).balanceOf();
    }

    function getPricePerFullShare()
        external
        override
        view
        returns (uint256)
    {
        return balance().mul(1e18).div(totalSupply());
    }

    function getTokens()
        external
        override
        view
        returns (address[] memory)
    {
        return tokens;
    }

    function withdrawFee(
        uint256 _amount
    )
        external
        override
        view
        returns (uint256)
    {
        return IVaultManager(vaultManager).withdrawalProtectionFee().mul(_amount).div(MAX);
    }

    /**
     * MODIFIERS
     */

    /**
     * @dev Throws if called by a contract and we are not allowing.
     */
    modifier checkContract() {
        if (address(msg.sender).isContract()) {
            require(allowedContracts[msg.sender], "!allowedContracts");
        }
        _;
    }

    modifier onlyController() {
        require(msg.sender == controller, "!controller");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == IVaultManager(vaultManager).governance(), "!governance");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == IVaultManager(vaultManager).strategist()
             || msg.sender == IVaultManager(vaultManager).governance(),
             "!strategist"
        );
        _;
    }
}
