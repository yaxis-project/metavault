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
CRV 0x0d3F625E516f9C4AE9b46054B9d0207b0B38b573
Controller 0x395051792953D489Bbb1b9eaE8d53Ac9240d34e4
DAI 0x483355ee7412f3E97f13Bd8C19da42fE46c5F054
Depositor 0xbfF9016A9e98A1173a35687De083A85730a13004
GaugeController 0x2883f97c04234C890d6F33b74c840B389A5B67Fd
GaugeProxy 0xc6Fe25bb1DF325edffF881f9083539b390929c5D
Harvester 0x91A3628c1Ff48E19B1176b693136cBF4B140cB70
LegacyController 0x61E579436eaAa270FaE20F199b57f7c616951b99
Manager 0xe8b9C674762f6A80af7112C21Fb8D71a215F075f
MetaVault 0x0Dc95c39C9F787761708FF31A72c97b65CaDeeec
MetaVaultNonConverter 0x1fF48bF4e923Ef7D405f2818b645f46103f85cde
Minter 0xC1b1e4419a15935a7D8Fd606AaD92FdBF781035e
MinterWrapper 0x4e3c12cc77FB73baa796b72C3B176E60228E1a53
MockCurveGauge 0x2Dd337A9e640b1a8311F8907a3B0435615671d69
MockCurveMinter 0xdC66D93325Ae21595b9cA3bf9CFDB11A91385dC4
MockStableSwap3Pool 0x829c7756076fdcff4D34Ac5202332089F983cFba
MockUniswapRouter 0x9d270fDa19c065474Af9454E7c3c222D4fb8457B
MockYaxisChef 0x719dAa4c1f91BCf9385CBecb044BaE4F28484fa8
NativeStrategyCurve3Crv 0x861DD09D8A19b0f542EA7914202B885D97b652DE
StablesConverter 0xB7D2015FaC676F5ddf06661f0F00e1470f657eA4
T3CRV 0xc033788b535c02d550dB6E6E4440Cf85CbE32FAB
USDC 0x1AFA7C8fB499ff2c5E638996C11dAEe1ffec258d
USDT 0x3Eae32bD124E64561F3f6162b96B7434941d7066
VaultHelper 0x7a390763c17937c2E82a0A2E176A49ea6A06c781
VaultStables 0x1aEe32285611Bac2C9ce74A92401291Aa10e682C
VaultStablesGauge 0x2e46090E9e02D4c4CCF75aa008640E24Fa0F7F4F
VotingEscrow 0x30A6667c992104f6B4A92858b0C4EC49CC4F9fC8
WETH 0x390C2e4c6d463339aeBc1Ab87246fa0B96FFD72d
YAX 0x42407091d2079a739E993696DBa74840fFCD4f2C
YaxEthUniswapV2Pair 0x3E2461587293851d27787BDF44B1D5F4e74B1dcF
YaxisToken 0x917B82e3ce54224f73dBf2D65e00881481FB6b58
sYAX 0x0BB24E85AB9D6168688dda0148CAfb83D458875B
```
