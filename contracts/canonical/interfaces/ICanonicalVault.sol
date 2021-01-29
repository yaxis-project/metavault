// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface ICanonicalVault {
    function addToken(address _token) external;
    function available(address _token) external view returns (uint256);
    function balance() external view returns (uint256);
    function controller() external view returns (address);
    function earn(address _token) external;
    function getPricePerFullShare() external view returns (uint256);
    function getTokens() external view returns (address[] memory);
    function removeToken(address _token) external;
    function vaultManager() external view returns (address);
    function withdraw(uint256 _amount, address _output) external;
    function withdrawFee(uint256 _amount) external view returns (uint256);
}
