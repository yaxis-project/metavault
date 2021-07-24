// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract MinterWrapper is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public immutable token;
    address public minter;
    uint256 public rate;

    event Write();

    constructor(
        address _token
    )
        public
        Ownable()
    {
        token = IERC20(_token);
        rate = 1e12;
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

    function setRate(
        uint256 _rate
    )
        external
        onlyOwner
    {
        rate = _rate;
    }

    function mint(
        address _account,
        uint256 _amount
    )
        external
        returns (bool)
    {
        require(msg.sender == minter, "!minter");
        token.safeTransfer(_account, _amount);
        return true;
    }

    function future_epoch_time_write()
        external
        returns (uint256)
    {
        emit Write();
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp;
    }

    function available_supply()
        public
        view
        returns (uint256)
    {
        return token.balanceOf(address(this));
    }
}
