// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./IController.sol";
import "./IConverter.sol";

interface IYaxisToken is IERC20 {
    function cap() external view returns (uint);

    function minters(address account) external view returns (bool);

    function mint(address _to, uint _amount) external;
}

contract yAxisMetaVault is ERC20 {
    using Address for address;
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    IERC20 public token3CRV;
    IYaxisToken public tokenYAX;

    uint public min = 9500;
    uint public constant max = 10000;

    uint public earnLowerlimit;
    uint public totalDepositCap;

    address public governance;
    address public controller;
    IConverter public converter;

    struct UserInfo {
        uint amount;
        uint yaxRewardDebt;
        uint accEarned;
    }

    uint public lastRewardBlock;
    uint public accYaxPerShare;

    uint public yaxPerBlock;

    mapping(address => UserInfo) public userInfo;

    address public tresuryWallet = 0x362Db1c17db4C79B51Fe6aD2d73165b1fe9BaB4a;

    event Deposit(address indexed user, uint amount);
    event Withdraw(address indexed user, uint amount);
    event RewardPaid(address indexed user, uint reward);
    event EmergencyWithdraw(address indexed user, uint amount);

    constructor (IERC20 _token3CRV, IYaxisToken _tokenYAX, uint _yaxPerBlock, uint _startBlock) public ERC20("yAxis.io:MetaVault:3CRV", "MVLT") {
        token3CRV = _token3CRV;
        tokenYAX = _tokenYAX;
        yaxPerBlock = _yaxPerBlock;
        lastRewardBlock = _startBlock;
        governance = msg.sender;
    }

    function balance() public view returns (uint) {
        uint bal = token3CRV.balanceOf(address(this));
        if (controller != address(0)) bal = bal.add(IController(controller).balanceOf(address(token3CRV)));
        return bal;
    }

    function setMin(uint _min) external {
        require(msg.sender == governance, "!governance");
        min = _min;
    }

    function setGovernance(address _governance) public {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setController(address _controller) public {
        require(msg.sender == governance, "!governance");
        controller = _controller;
    }

    function setConverter(IConverter _converter) public {
        require(msg.sender == governance, "!governance");
        require(_converter.token() == address(token3CRV), "!token3CRV");
        converter = _converter;
    }

    function setEarnLowerlimit(uint _earnLowerlimit) public {
        require(msg.sender == governance, "!governance");
        earnLowerlimit = _earnLowerlimit;
    }

    function setTotalDepositCap(uint _totalDepositCap) public {
        require(msg.sender == governance, "!governance");
        totalDepositCap = _totalDepositCap;
    }

    function setYaxPerBlock(uint _yaxPerBlock) public {
        require(msg.sender == governance, "!governance");
        updateReward();
        yaxPerBlock = _yaxPerBlock;
    }

    function setTresuryWallet(address _tresuryWallet) public {
        require(msg.sender == governance, "!governance");
        tresuryWallet = _tresuryWallet;
    }

    // Custom logic in here for how much the vault allows to be borrowed
    // Sets minimum required on-hand to keep small withdrawals cheap
    function available() public view returns (uint) {
        return token3CRV.balanceOf(address(this)).mul(min).div(max);
    }

    function withdrawFee(uint _amount) public view returns (uint) {
        return (controller == address(0)) ? 0 : IController(controller).withdrawFee(address(token3CRV), _amount);
    }

    function earn() public {
        if (controller != address(0)) {
            uint _bal = available();
            token3CRV.safeTransfer(controller, _bal);
            IController(controller).earn(address(token3CRV), _bal);
        }
    }

    // Transfers tokens of all kinds
    function depositAll(uint256[] memory amounts, address[] memory tokenAddresses, bool _isStake) external {
        require(amounts.length == tokenAddresses.length, "DH: amounts and vault lengths mismatch");
        uint _pool = balance();
        uint _before = token3CRV.balanceOf(address(this));
        for (uint i = 0; i < tokenAddresses.length; i++) {
            uint _inputAmount = amounts[i];
            if (_inputAmount > 0) {
                address _input = tokenAddresses[i];
                if (_input != address(token3CRV) && converter.rate(_input, address(token3CRV), _inputAmount) > 0) {
                    IERC20(_input).safeTransferFrom(msg.sender, address(converter), _inputAmount);
                    converter.convert(_input, address(token3CRV));
                }
            }
        }
        uint _after = token3CRV.balanceOf(address(this));
        require(totalDepositCap == 0 || _after <= totalDepositCap, ">totalDepositCap");
        uint _totalDepositAmount = _after.sub(_before);
        // Additional check for deflationary tokens
        if (_totalDepositAmount > 0) {
            if (!_isStake) {
                _deposit(msg.sender, _pool, _totalDepositAmount);
            } else {
                uint _shares = _deposit(address(this), _pool, _totalDepositAmount);
                _stakeShares(_shares);
            }
        }
    }

    function stakeShares(uint _shares) external {
        uint _before = balanceOf(address(this));
        IERC20(address(this)).transferFrom(msg.sender, address(this), _shares);
        uint _after = balanceOf(address(this));
        _shares = _after.sub(_before);
        // Additional check for deflationary tokens
        _stakeShares(_shares);
    }

    function _deposit(address _mintTo, uint _pool, uint _amount) internal returns (uint _shares) {
        _shares = 0;
        if (totalSupply() == 0) {
            _shares = _amount;
        } else {
            _shares = (_amount.mul(totalSupply())).div(_pool);
        }
        if (_shares > 0) {
            if (token3CRV.balanceOf(address(this)) > earnLowerlimit) {
                earn();
            }
            _mint(_mintTo, _shares);
        }
    }

    function _stakeShares(uint _shares) internal {
        UserInfo storage user = userInfo[msg.sender];
        updateReward();
        _getReward();
        user.amount = user.amount.add(_shares);
        user.yaxRewardDebt = user.amount.mul(accYaxPerShare).div(1e12);
        emit Deposit(msg.sender, _shares);
    }

    // View function to see pending YAXs on frontend.
    function pendingYax(address _account) public view returns (uint _pending) {
        UserInfo storage user = userInfo[_account];
        uint _accYaxPerShare = accYaxPerShare;
        uint lpSupply = balanceOf(address(this));
        if (block.number > lastRewardBlock && lpSupply != 0) {
            uint numBlocks = block.number.sub(lastRewardBlock);
            _accYaxPerShare = accYaxPerShare.add(numBlocks.mul(yaxPerBlock).mul(1e12).div(lpSupply));
        }
        _pending = user.amount.mul(_accYaxPerShare).div(1e12).sub(user.yaxRewardDebt);
    }

    function updateReward() public {
        if (block.number <= lastRewardBlock) {
            return;
        }
        uint lpSupply = balanceOf(address(this));
        if (lpSupply == 0) {
            lastRewardBlock = block.number;
            return;
        }
        uint _numBlocks = block.number.sub(lastRewardBlock);
        accYaxPerShare = accYaxPerShare.add(_numBlocks.mul(yaxPerBlock).mul(1e12).div(lpSupply));
        lastRewardBlock = block.number;
    }

    function _getReward() internal {
        UserInfo storage user = userInfo[msg.sender];
        uint _pendingYax = user.amount.mul(accYaxPerShare).div(1e12).sub(user.yaxRewardDebt);
        if (_pendingYax > 0) {
            user.accEarned = user.accEarned.add(_pendingYax);
            safeYaxMint(msg.sender, _pendingYax);
            emit RewardPaid(msg.sender, _pendingYax);
        }
    }

    function withdrawAll(address _output) external {
        unstake(userInfo[msg.sender].amount);
        withdraw(balanceOf(msg.sender), _output);
    }

    // Used to swap any borrowed reserve over the debt limit to liquidate to 'token'
    function harvest(address reserve, uint amount) external {
        require(msg.sender == controller, "!controller");
        require(reserve != address(token3CRV), "token3CRV");
        IERC20(reserve).safeTransfer(controller, amount);
    }

    function unstake(uint _amount) public {
        updateReward();
        _getReward();
        UserInfo storage user = userInfo[msg.sender];
        if (_amount > 0) {
            require(user.amount >= _amount, "stakedBal < _amount");
            user.amount = user.amount.sub(_amount);
            IERC20(address(this)).transfer(msg.sender, _amount);
        }
        user.yaxRewardDebt = user.amount.mul(accYaxPerShare).div(1e12);
        emit Withdraw(msg.sender, _amount);
    }

    // No rebalance implementation for lower fees and faster swaps
    function withdraw(uint _shares, address _output) public {
        uint _userBal = balanceOf(msg.sender);
        if (_shares > _userBal) {
            uint _need = _shares.sub(_userBal);
            require(_need <= userInfo[msg.sender].amount, "_userBal+staked < _shares");
            unstake(_need);
        }
        uint r = (balance().mul(_shares)).div(totalSupply());
        _burn(msg.sender, _shares);

        uint _withdrawFee = withdrawFee(r);
        if (_withdrawFee > 0) {
            r = r.mul(10000 - _withdrawFee).div(10000);
        }

        // Check balance
        uint b = token3CRV.balanceOf(address(this));
        if (b < r) {
            uint _withdraw = r.sub(b);
            if (controller != address(0)) {
                IController(controller).withdraw(address(token3CRV), _withdraw);
            }
            uint _after = token3CRV.balanceOf(address(this));
            uint _diff = _after.sub(b);
            if (_diff < _withdraw) {
                r = b.add(_diff);
            }
        }

        if (_output == address(token3CRV)) {
            token3CRV.safeTransfer(msg.sender, r);
        } else if (_output != address(token3CRV) && converter.rate(address(token3CRV), address(token3CRV), r) > 0) {
            token3CRV.safeTransferFrom(msg.sender, address(converter), r);
            r = converter.convert(address(token3CRV), _output);
            IERC20(_output).safeTransfer(msg.sender, r);
        }
    }

    function getPricePerFullShare() public view returns (uint) {
        return balance().mul(1e18).div(totalSupply());
    }

    // Safe YAX mint, ensure we are the current owner.
    function safeYaxMint(address _to, uint _amount) internal {
        if (tokenYAX.minters(address(this)) && _to != address(0)) {
            uint totalSupply = tokenYAX.totalSupply();
            uint cap = tokenYAX.cap();
            if (totalSupply.add(_amount) > cap) {
                tokenYAX.mint(_to, cap.sub(totalSupply));
            } else {
                tokenYAX.mint(_to, _amount);
            }
        }
    }

    function governanceRecoverUnsupported(IERC20 _token, uint _amount, address _to) external {
        require(msg.sender == governance, "!governance");
        require(address(_token) != address(token3CRV) || balance().sub(_amount) >= totalSupply(), "cant withdraw 3CRV more than MVLT supply");
        _token.transfer(_to, _amount);
    }
}
