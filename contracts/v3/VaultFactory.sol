// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./Vault.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IVaultFactory.sol";

contract VaultFactory is IVaultFactory {
    IManager public immutable override manager;

    mapping(address => bool) public override factoryCreated;

    event VaultCreated(address vault);

    constructor(
        address _manager
    )
        public
    {
        manager = IManager(_manager);
    }

    function create(
        string calldata _name,
        string calldata _symbol
    )
        external
        override
    {
        require(msg.sender == manager.strategist(), "!strategist");
        Vault _vault = new Vault(_name, _symbol, address(manager));
        factoryCreated[address(_vault)] = true;
        emit VaultCreated(address(_vault));
    }
}
