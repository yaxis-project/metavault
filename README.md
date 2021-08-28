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

### Mainnet

```
RewardsMetavault 0x226f9954A1221cDe805C76CfB312A5d761630E14
RewardsYaxis 0x3b09B9ADFe11f92225b4C55De89fa81456595CD9
RewardsYaxisEth 0xEDaFe410e2f07ab9D7F1B04316D29C2F49dCb104
StableSwap3PoolConverter 0x2eab685d85AA52E4d8b6699Ba5aAC3b0c3992C3B
StableSwap3PoolNonConverter 0x9354b082E5CEdb41422Fb9D4669Ab8b7f8511AeE
StrategyControllerV2 0x0d857688d6A223A2F4e58CDd44119ABb7DC5A790
StrategyCurve3Crv 0x5cd9D7977F9e431399E8186339D9ecBf88eD43F2
StrategyYearnV2-DAI 0xb6C352587F4A92D3c7946bf42fE6D4D3aCd1F312
Swap 0xCdF398537adbF8617a8401B14DCEe7F67CF8c64b
YaxisToken 0x0adA190c81b814548ddC2F6AdC4a689ce7C1FE73
YaxisVotePower 0xDb6E6904d50f9d9Df5554Eb9aACE2F95e6712739
yAxisMetaVaultHarvester 0x5BBc6Ff70680d1DfEFd4685CbdeD5363A4db9b66
yAxisMetaVaultManager 0x443ed48F975E02eA67CA0d2be0B4d4806d1E31F2
```

### Kovan

```
CRV 0x1E79c2c11783593C48A2fD9A9fa048B74F62410A
Controller 0xCf0bF39c0783180E3B502397E075a8bCe9D77B17
DAI 0x87be8295e377dC5137EFC49ed0dC15e4CFE71703
GaugeController 0xA634255116c248bB995318F6BCD69520c3E0EBB7
GaugeProxy 0x36274287D8efe33035E078e10Df1351adF514410
Harvester 0x4f13eabcaBAEF1A2E04Ca3A0A7283f890D221Ea7
LegacyController 0x1C03e1B00bDA08AAAAdf5F3AdB40F4DD677B8521
Manager 0x444031DD3453d40034772Ac5c245AC207D8fB0f0
MetaVault 0x68250aa1e0516112875f1E0C74A4ff091e8279c4
MetaVaultNonConverter 0x1E5Dc56BF6C3bE40A305D799a19C55D82bcD239C
Minter 0xdCAFC7B68E9a5A9b766E38C230b6ACafcEd98fB3
MinterWrapper 0x4795A42e31a18362e4aE51B94064565750C4E5B2
MockCurveGauge 0xaA917FF4ff51d6210fc169626f751D8958FA0fFC
MockCurveMinter 0x968aAC9795a6A57DC31594E21631e2E9305F1e7E
MockStableSwap3Pool 0xce8CD18b6207Ec8f861dD2f396015bB056215ff8
MockUniswapRouter 0x2042e71fc3e203603152D44Dccd0d8a6e407907E
MockYaxisChef 0xD93fF52A7786A5bAd3bE53Aa190654c4313632c0
NativeStrategyCurve3Crv 0xE004eDF02D0DeB80ADaaA85e0718d871E24Ec69d
StablesConverter 0xe2909752A83c7581834447f74B2F5C0d67313987
T3CRV 0xF270fC306e08dcE71103B96084f0188d8dB389e7
USDC 0x85a2f92D5AAd4823ccE424F5F2a878E8526f614e
USDT 0x3289Bc7be698Fb739aeA5817730dd592758FE3c7
VaultHelper 0x12C03b4Aa6B062a17828524c1B246281B877ed32
VaultStables 0x38C2b50Fb86ff4D8a46d4a31DBaf2bE10d0b23EB
VaultStablesGauge 0x8651468C0066B60915894630Fc1f6f7cfcF7D56b
VotingEscrow 0x36109a531b8DeF94d196106627bd1C03Bf0fb7AB
WETH 0xb31669756bD7CBade3E1850f0cb8307675242D0d
YAX 0x5A40A336268b4E9234b672084cbdC96F9Cc087fA
YaxEthUniswapV2Pair 0x7A9C6b6E041dB1ecC90f532D05E805320D94D57f
YaxisToken 0xA0e08288787cBE076A4A6380dA86953aF85E2C35
sYAX 0x154b56EED48c5f25F4563146476B1a08A40d551c
```
