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
CRV 0x857340acaCF3B84288f76b6c076E98BaD24Df8F8
Controller 0x915C1A9e559caA8A004df6Cfe452FF5B7eA39d35
DAI 0xC0a481836275b8e622340F96F0227690A6e046ce
GaugeController 0xAb1D3E1dc6fe751f0105bFf1230bC87eA088ec45
GaugeProxy 0xA070A33F1bBb5c9E1B9d05036EC7688DbcAA5FA4
Harvester 0x189b20c55A8A71aC7f75D8861D13FDB942865F93
LegacyController 0x23fa219EEaBa685BBC97339997A9Bf1Ea4Edf601
Manager 0xc7F3c5e9ccA0c4262F183769048912579877A46F
MetaVault 0x8352DD44F6e99b9e839BA256Dac8E2A55885F548
MetaVaultNonConverter 0x1b18785a1406F2130A28F5A74Bd69E6eb34c03f2
Minter 0x0137BE5a8D565dd6E87F5134408C739b46d8F601
MinterWrapper 0xbE27EF21E6DB73b13E00945A967c9F98BF232E93
MockCurveGauge 0xB5E6ac2bB6E718914fe04b18611eaf6ae8Ee2A29
MockCurveMinter 0xBf8C5e97164412b59E8A5763ab42525178b2e44a
MockStableSwap3Pool 0x102589035CF4ebc93E5aE839e70FB88334e6aad3
MockUniswapRouter 0x261572b5Acf698891a21077Da34f22817BFE50E9
MockYaxisChef 0x1E69Aa5babC1982A613013643e7De7C269220310
NativeStrategyCurve3Crv 0x03f6899C9298a4df398223b29738dAe57E095e83
StablesConverter 0xDB4e9F8354c6684eC6F3Fa9e0964EDcDAcC169b0
T3CRV 0xebB086C43a9a85053E5d4c88715D765bEcD390F2
USDC 0xf1829827c98bE17d2727AE161e8126e71472906e
USDT 0xB30F73a2b1854aE4dDAECE6c813526fc60cFcB58
VaultStables 0xC5dDCA4aAF78c44867082f1B251B2386e1286012
VaultStablesGauge 0x225d73DdA0Efbb53dEEFf304E5ffE67235673A98
VotingEscrow 0x72641D6A06825CDd04181588FD0a9cb46765fDdA
WETH 0x774E8e22b93e98B5305A2b0F6db6F69Fbac7f5E7
YAX 0xF4016C6D5446219829Eed0008621B454818CB2F3
YaxEthUniswapV2Pair 0xc882B225E8a8A0835fc179146245c3EBE4004136
YaxisToken 0x3a946e5dfBE08eb0D9A1d415d51da4Cb8F517dF5
sYAX 0x41430F04BDF909eDAe0aC2a6B0f360807b7Cbd6e
```
