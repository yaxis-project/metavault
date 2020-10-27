// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IConverter {
    function token() external returns (address);
    function convert(address _input, address _output) external returns (uint _outputAmount);
    function rate(address _input, address _output, uint _inputAmount) external returns (uint _outputAmount);
}
