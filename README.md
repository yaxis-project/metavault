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
StableSwap3PoolConverter 0xa4ea2fD4a88cB66488109eFb8Ecd4A96F5376261
StableSwap3PoolOracle 0x8DFDdc191C6Fd7596deEEf52BC783546993962ee
StrategyControllerV2 0xD2c5fe04d97c8C7cea36FbB5016E934C39dCe549
StrategyCurve3Crv 0x3c7618f78A5CcbE9D2A45D2F71C68b688A89C655
yAxisMetaVaultHarvester 0x18DbeFac8eb66fDF559e31D5C154F4ffBc63FF99
yAxisMetaVaultManager 0xe3d32C20Be68e6189a52f60148c850dF7A2Bb5DD
```

### Kovan

```
CRV 0x15827C1E7D31ABc35cd9f5c066507bEF3D10C978
DAI 0x59Dd2C19F322f7457C34C73023cC7dA1fde4063d
DF 0xC090b5686B24C2D5eDe2077857a986B6DB73Ad15
MockCurveGauge 0x67c6a7A201cB5f80318691B7Ab82b86Cc444C00b
MockCurveMinter 0x33F04CD467679B47D2a6AD50e3BCeC7d85493edE
MockDRewards 0xfe876a7b49d04073dCa8a1fF0BA07946b78d5229
MockPickleJar 0x13F4cc6C239aBaD03EbD2deAA6A7107E9c6c9BEB
MockPickleMasterChef 0x76f4A0CE3753F745e97e588F8423230B83f4a2F4
MockStabilizePool 0x6bea6113d06CcA2453917d002b9eEB052ea5Dd6A
MockStableSwap3Pool 0xE2C2a45850375c0A8B92b853fcd0a110463ed5Ab
MockUniswapRouter 0x8D037Ea525f150BaD41D0caB990665fE944Cb2F7
PICKLE 0xCe58c84B9061d91856816a6c6cE9691de567E95C
STBZ 0x5B5fE76B7b866A660C3bAe2f5819a1452Db18174
StableSwap3PoolConverter 0x4981D4A898e1C503BFA06B751f932600E124108f
StrategyControllerV2 0xD3dB7ba937597A3fFAd1174bAed2955852FD5d6D
StrategyCurve3Crv 0x93d0f1F6a544968b914427dc3Befb788Cb75512E
StrategyDforce 0x2d24b957B5a5D0FB6A07EA0b95E693D1b2fe1458
StrategyPickle3Crv 0x4D55b12D0ADbC9f5D83Ff4a4B5572A8C4801dA6a
StrategyStabilize 0xaF25D648B5d72B6238Bd73B4AD935acF25A1cA24
T3CRV 0xFe2517Ff8E95876EE29aD9f91Ee31fB5Bd1dc2a3
USDC 0xAE0e8B59555d83f3A83DFB258E637CFfEba77D3A
USDT 0x3631E53e320F072e53397Ab7717b4C4F90fd2183
WETH 0x38e966C6F5562D628e70560726A7B7bCD6D1EC8A
YAX 0x29a0d41ad9069861976aFA6F3e6B0b5eC2381096
dDAI 0xBFcc19bEBbDcfa2992D83A9f93832Ab1A3fED356
yAxisMetaVault 0x6e4BA66AD61610098E216991977a067F0680FC96
yAxisMetaVaultHarvester 0xcE6A402d63d84C9dBA56AB3BB679F96210b7986C
yAxisMetaVaultManager 0x15885dE7737B179968B216275b6531f3a668E4E9
zpaDAI 0xC2A5B8A56A3259039C2eB5b749c121C237ffEcf4
```
