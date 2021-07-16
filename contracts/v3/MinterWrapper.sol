// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract MinterWrapper is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant YEAR = 86400 * 365;
    uint256 public constant INFLATION_DELAY = 86400;
    uint256 public constant RATE_REDUCTION_TIME = YEAR;
    uint256 public constant RATE_DENOMINATOR = 1e18;
    uint256 public constant RATE_REDUCTION_COEFFICIENT = 1189207115002721024;

    address public immutable token;
    address public minter;
    uint256 public rate;
    uint256 internal _start_epoch_time;
    uint256 internal _start_epoch_supply;

    constructor(
        address _token
    )
        public
        Ownable()
    {
        token = _token;
        // solhint-disable-next-line not-rely-on-time
        _start_epoch_time = block.timestamp.add(INFLATION_DELAY).sub(RATE_REDUCTION_TIME);
    }

    /**
     * @dev can only be set once
     */
    function setMinter(
        address _minter
    )
        external
        onlyOwner
    {
        require(minter == address(0), "minter");
        minter = _minter;
    }

    function mint(
        address _account,
        uint256 _amount
    )
        external
    {
        require(msg.sender == minter, "!minter");
        IERC20(token).safeTransfer(_account, _amount);
    }

    function future_epoch_time_write()
        external
        returns (uint256)
    {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp >= _start_epoch_time.add(RATE_REDUCTION_TIME)) {
            _update_mining_parameters();
            return _start_epoch_time.add(RATE_REDUCTION_TIME);
        } else {
            return _start_epoch_time.add(RATE_REDUCTION_TIME);
        }
    }

    function _update_mining_parameters()
        internal
    {
        _start_epoch_time = _start_epoch_time.add(RATE_REDUCTION_TIME);

        if (rate == 0) {
            rate = available_supply().mul(1e18).div(YEAR);
        } else {
            _start_epoch_supply = _start_epoch_supply.add(rate.mul(RATE_REDUCTION_TIME));
            rate = rate.mul(RATE_DENOMINATOR).div(RATE_REDUCTION_COEFFICIENT);
        }
    }

    function available_supply()
        public
        view
        returns (uint256)
    {
        return IERC20(token).balanceOf(address(this));
    }
}
