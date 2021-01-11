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

## Getting contract addressses

Deployed addresses can be obtained by running:

```
yarn hardhat contracts --network kovan
```

This will produce the following output:

```

CRV 0xf8601D0434A1A93Face56ACaD1172252a27bc2d2
DAI 0x2B383417F6859a96a5fB3C28Ea0e7fa1887fA70d
DF 0xb4735804D4ffAD8F9926A443ecE98020c82ea5b3
MockCurveGauge 0x2372c945c38fa4acc5cC2845eBa2f78022D87787
MockCurveMinter 0xDa6813e4c9e0ee22b7d47414128C5008ba280341
MockDRewards 0x9ca4528d6B7Ce9FbB7BDB0E2Bd3e71022DCf7ABA
MockPickleJar 0xC76329638725931392C356a2088A4Be8C16b9890
MockPickleMasterChef 0x23D9534F87C90297CB030A96fd48b192134967D8
MockStableSwap3Pool 0x914CB8f93Fb649406618FdEC9fd328Cc3d1c5644
MockUniswapRouter 0x43824FBFeC887A62592eb52C39752E162d2eff05
PICKLE 0x39923ca790d0Af8b18dfa265eB39efb7F8434fbc
StableSwap3PoolConverter 0x5699C3CEDA818eb7180DEa6cD927EB7053A1f669
StrategyControllerV2 0xbf6985d14f74E9D0A3aaF40444Ab80e3CA198f12
StrategyCurve3Crv 0xF657471410D3584137FA8D1bcEf4c7fcA7B64408
StrategyDforce 0xe70B9dB594bC73b101E0D290dae81BabaAB9E248
StrategyPickle3Crv 0xc93a219331527d035f30444FFB83C5B67c30A034
T3CRV 0x54f37AE099c0417146CE57615D4D39fB0D666bed
USDC 0x2640F74f8586b84D95bE5b48CA96eFC90320D30E
USDT 0xda6E4647bD6f98A41292434277B466d654c52b75
WETH 0x76530B1D5851B35b6fe85c5FC70a7Ee743ca99D0
YAX 0xdf0479A9fCAAF1C05944CB5A326301bd528e4F5A
dDAI 0x8E8334Df52B5D533296c62Ee026F5e11355acaeB
yAxisMetaVault 0x347B497B15B91C704BEA7664Fab6F6Cd3922176E
yAxisMetaVaultHarvester 0xfe5e6A588778FD5709BF08E0D7f1EA0947736D4A
yAxisMetaVaultManager 0x2Fe58c52Dbb2F5F934B677823F3151d0663C6D56
```
