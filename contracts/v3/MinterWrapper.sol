// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MinterWrapper is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable YAXIS;
    address public minter;

    constructor(
        IERC20 _yaxis
    )
        public
        Ownable()
    {
        YAXIS = _yaxis;
    }

    function setMinter(
        address _minter
    )
        external
        onlyOwner
    {
        minter = _minter;
    }

    function mint(
        address _account,
        uint256 _amount
    )
        external
    {
        require(msg.sender == minter, "!minter");
        YAXIS.safeTransfer(_account, _amount);
    }
}
