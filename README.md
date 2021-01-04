# yAxis MetaVault Contracts

The MetaVault will allow users to take advantage of the best yield farming strategies while minimizing gas fees and transferring difficult management decisions to an incentivized community governance. Multiple strategies are utilized by each vault, allowing for per-strategy deposit caps to be placed in order to limit risk.

## Responsible Disclosure

We have an active [security bug bounty on Immunefi](https://immunefi.com/bounty/yaxis/). Please follow our [Security Policy](https://github.com/yaxis-project/metavault/security/policy) for reporting security issues to the team.

## Writing Strategies

In order to write a strategy for the MetaVault, you must inherit the BaseStrategy contract. The BaseStrategy contract is an abstract contract that gives specific security properties which make it hard to write an insecure strategy.

All state-changing functions implemented in the strategy should be internal, since any public or externally-facing functions are already handled in the BaseStrategy.

 The following functions must be implemented by a strategy:
 - `function _deposit() internal virtual;`
 - `function _harvest() internal virtual;`
 - `function _withdraw(uint256 _amount) internal virtual;`
 - `function _withdrawAll() internal virtual;`
 - `function balanceOfPool() public view override virtual returns (uint256);`

