// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./interfaces/IManager.sol";
import "./interfaces/IController.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/IVault.sol";
import "./interfaces/ExtendedIERC20.sol";

/**
 * @title Vault
 * @notice The vault is where users deposit and withdraw
 * like-kind assets that have been added by governance.
 */
contract Vault is ERC20, IVault {
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX = 10000;

    IManager public immutable override manager;

    // Strategist-updated variables
    uint256 public min;
    uint256 public totalDepositCap;

    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);
    event Earn(address indexed token, uint256 amount);

    /**
     * @param _name The name of the vault token for depositors
     * @param _symbol The symbol of the vault token for depositors
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _manager
    ) public ERC20(_name, _symbol) {
        manager = IManager(_manager);
        min = 9500;
        totalDepositCap = 10000000 ether;
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    /**
     * @notice Sets the value for min
     * @dev min is the minimum percent of funds to keep small withdrawals cheap
     * @param _min The new min value
     */
    function setMin(
        uint256 _min
    )
        external
        onlyStrategist
    {
        require(_min <= MAX, "!_min");
        min = _min;
    }

    /**
     * @notice Sets the value for the totalDepositCap
     * @dev totalDepositCap is the maximum amount of value that can be deposited
     * to the metavault at a time
     * @param _totalDepositCap The new totalDepositCap value
     */
    function setTotalDepositCap(
        uint256 _totalDepositCap
    )
        external
        onlyStrategist
    {
        totalDepositCap = _totalDepositCap;
    }

    /**
     * HARVESTER-ONLY FUNCTIONS
     */

    /**
     * @notice Sends accrued 3CRV tokens on the metavault to the controller to be deposited to strategies
     */
    function earn(address _token)
        public
        override
        onlyHarvester
        checkToken(_token)
    {
        IController _controller = IController(manager.controllers(address(this)));
        if (_controller.investEnabled()) {
            uint256 _balance = available(_token);
            IERC20(_token).safeTransfer(address(_controller), _balance);
            _controller.earn(_token, _balance);
            emit Earn(_token, _balance);
        }
    }

    /**
     * USER-FACING FUNCTIONS
     */

    // TODO: remove in favor of depositAll
    function deposit(
        address _token,
        uint256 _amount
    )
        external
        override
        checkContract
        checkToken(_token)
        checkVault
    {
        require(_amount > 0, "!_amount");
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

    /**
     * @notice Deposits multiple tokens simultaneously to the vault
     * @dev Users must approve the vault to spend their stablecoin
     * @param _tokens The addresses of each token being deposited
     * @param _amounts The amounts of each token being deposited
     */
    function depositAll(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    )
        external
        override
        checkContract
        checkVault
    {
        require(_tokens.length == _amounts.length, "!length");
        for (uint8 i; i < _amounts.length; i++) {
            if (_amounts[i] > 0) {
                require(_checkToken(_tokens[i]), "!_tokens");
                uint256 _balance = balance();
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

    /**
     * @notice Withdraws an amount of shares to a given output token
     * @param _shares The amount of shares to withdraw
     * @param _output The address of the token to receive
     */
    function withdraw(
        uint256 _shares,
        address _output
    )
        public
        override
        checkContract
        checkToken(_output)
    {
        uint256 _amount = (balance().mul(_shares)).div(totalSupply());
        _burn(msg.sender, _shares);

        uint256 _withdrawalProtectionFee = manager.withdrawalProtectionFee();
        if (_withdrawalProtectionFee > 0) {
            uint256 _withdrawalProtection = _amount.mul(_withdrawalProtectionFee).div(MAX);
            _amount = _amount.sub(_withdrawalProtection);
        }

        uint256 _balance = IERC20(_output).balanceOf(address(this));
        if (_balance < _amount) {
            uint256 _conversionFee = manager.conversionFee();
            if (_conversionFee > 0) {
                _amount = _amount.mul(_conversionFee).div(MAX);
            }
            IController _controller = IController(manager.controllers(address(this)));
            uint256 _toWithdraw = _amount.sub(_balance);
            if (_controller.strategies() > 0) {
                _controller.withdraw(_output, _toWithdraw);
            }
            uint256 _after = IERC20(_output).balanceOf(address(this));
            uint256 _diff = _after.sub(_balance);
            if (_diff < _toWithdraw) {
                _amount = _balance.add(_diff);
            }
        }

        IERC20(_output).safeTransfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }

    /**
     * @notice Withdraw the entire balance for an account
     * @param _output The address of the desired token to receive
     */
    function withdrawAll(
        address _output
    )
        external
        override
        checkContract
    {
        withdraw(balanceOf(msg.sender), _output);
    }

    /**
     * INTERNAL FUNCTIONS
     */

    function _deposit(
        address _account,
        address _token,
        uint256 _balance,
        uint256 _amount
    )
        internal
        returns (uint256 _shares)
    {
        _amount = _normalizeDecimals(_token, _amount);

        if (totalSupply() == 0) {
            _shares = _amount;
        } else {
            _shares = (_amount.mul(totalSupply())).div(_balance);
        }

        if (_shares > 0) {
            _mint(_account, _shares);
        }

        emit Deposit(_account, _shares);
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
        view
        override
        returns (uint256)
    {
        return IERC20(_token).balanceOf(address(this)).mul(min).div(MAX);
    }

    function balance()
        public
        view
        override
        returns (uint256 _balance)
    {
        return balanceOfThis().add(IController(manager.controllers(address(this))).balanceOf());
    }

    function balanceOfThis()
        public
        view
        returns (uint256 _balance)
    {
        address[] memory _tokens = manager.getTokens(address(this));
        for (uint8 i; i < _tokens.length; i++) {
            address _token = _tokens[i];
            _balance = _balance.add(_normalizeDecimals(_token, IERC20(_token).balanceOf(address(this))));
        }
    }

    function getPricePerFullShare()
        external
        view
        override
        returns (uint256)
    {
        return balance().mul(1e18).div(totalSupply());
    }

    function getTokens()
        external
        view
        override
        returns (address[] memory)
    {
        return manager.getTokens(address(this));
    }

    function withdrawFee(
        uint256 _amount
    )
        external
        view
        override
        returns (uint256)
    {
        return manager.withdrawalProtectionFee().mul(_amount).div(MAX);
    }

    function _normalizeDecimals(
        address _token,
        uint256 _amount
    )
        internal
        view
        returns (uint256)
    {
        uint256 _decimals = uint256(ExtendedIERC20(_token).decimals());
        if (_decimals < 18) {
            _amount = _amount.mul(10**(18-_decimals));
        }
        return _amount;
    }

    function _checkToken(
        address _token
    )
        private
        view
        returns (bool)
    {
        return manager.allowedTokens(_token) && manager.vaults(_token) == address(this);
    }

    /**
     * MODIFIERS
     */

    /**
     * @dev Throws if called by a contract and we are not allowing.
     */
    modifier checkContract() {
        address _sender = msg.sender;
        if (address(_sender).isContract()) {
            bytes32 _hash;
            // solhint-disable-next-line no-inline-assembly
            assembly { _hash := extcodehash(_sender) }
            require(manager.allowedContracts(_sender)
                || manager.allowedCodeHash(_hash),
                "!allowedContracts");
        }
        _;
    }

    modifier checkToken(address _token) {
        require(_checkToken(_token), "!_token");
        _;
    }

    modifier checkVault() {
        require(manager.allowedVaults(address(this)), "!vault");
        _;
    }

    modifier onlyHarvester() {
        require(msg.sender == manager.harvester(), "!harvester");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
