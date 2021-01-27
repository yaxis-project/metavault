// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./MockERC20.sol";
import "../../interfaces/YVaultV2.sol";

contract MockYVaultV2 is ERC20, IYVaultV2 {
    using SafeMath for uint256;
    using Address for address;
    using SafeERC20 for IERC20;

    address public override token;

    constructor(
        string memory _name,
        string memory _symbol,
        address _underlyingToken
    )
        public ERC20(_name, _symbol)
    {
        token = _underlyingToken;
    }

    function deposit(uint256 _amount) external override returns (uint256) {
        uint256 shares = _issueSharesForAmount(msg.sender, _amount);
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        return shares;
    }

    function withdraw(uint256 _maxShares) external override returns (uint256) {
        uint256 value = _shareValue(_maxShares);
        _burn(msg.sender, _maxShares);
        IERC20(token).safeTransfer(msg.sender, value);
        return value;
    }

    function pricePerShare() public view override returns (uint256) {
        if (totalSupply() == 0) {
            return uint256(10 ** uint256(decimals()));
        } else {
            return _shareValue(10 ** uint256(decimals()));
        }
    }

    function _issueSharesForAmount(address _to, uint256 _amount) private returns (uint256) {
        uint256 shares = 0;
        if (totalSupply() > 0) {
            shares = _amount
              .mul(totalSupply())
              .div(IERC20(token).balanceOf(address(this)));
        } else {
            shares = _amount;
        }

        _mint(_to, shares);

        return shares;
    }

    function _shareValue(uint256 _shares) private view returns (uint256) {
        return _shares
          .mul(IERC20(token).balanceOf(address(this)))
          .div(totalSupply());
    }
}