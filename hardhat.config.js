require('@nomiclabs/hardhat-truffle5');
require('hardhat-deploy');

// If not set, we only need to default these with something to get hardhat to run
const kovanRpcUrl = process.env.KOVAN_RPC_URL || 'https://example.com';
const mainnetRpcUrl = process.env.MAINNET_RPC_URL || 'https://example.com';
const kovanPrivateKey = process.env.KOVAN_PRIVATE_KEY || '0x00';
const mainnetPrivateKey = process.env.MAINNET_PRIVATE_KEY || '0x00';

module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {},
        kovan: {
            url: kovanRpcUrl,
            accounts: [kovanPrivateKey]
        },
        mainnet: {
            url: mainnetRpcUrl,
            accounts: [mainnetPrivateKey]
        }
    },
    namedAccounts: {
        CRV: {
            1: '0xD533a949740bb3306d119CC777fa900bA034cd52',
            42: '0x27793C6F8fdB370DA02786c0A1c47F7A0877bD67'
        },
        DAI: {
            1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            42: '0xd7a4281A3D0C464c9d995d068FC7F486c1e0a5AB'
        },
        DF: {
            1: '0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0',
            42: '0x4a371D576006F61309AD87E7fAA7f02a50ec3F03'
        },
        dDAI: {
            1: '0x02285AcaafEB533e03A7306C55EC031297df9224'
        },
        dRewardsDAI: {
            1: '0xD2fA07cD6Cd4A5A96aa86BacfA6E50bB3aaDBA8B'
        },
        dRewardsUSDT: {
            1: '0x324EebDAa45829c6A8eE903aFBc7B61AF48538df'
        },
        dUSDT: {
            1: '0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8'
        },
        deployer: {
            1: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259',
            42: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259'
        },
        gauge: {
            1: '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A'
        },
        minter: {
            1: '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0'
        },
        multisig: {
            1: '0xC1d40e197563dF727a4d3134E8BD1DeF4B498C6f'
        },
        p3crv: {
            1: '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33'
        },
        pchef: {
            1: '0xbD17B1ce622d73bD438b9E658acA5996dc394b0d'
        },
        PICKLE: {
            1: '0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5',
            42: '0xf38591C9d2FB28B6fF1b0635A1007Ff37eb9FC5B'
        },
        pjar: {
            1: '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33'
        },
        stableSwap3Pool: {
            1: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'
        },
        stakingPool: {
            1: '0xeF31Cb88048416E301Fee1eA13e7664b887BA7e8'
        },
        T3CRV: {
            1: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
            42: '0x07A0D425B0d67e38EE041e280F70f0250491764b'
        },
        timelock: {
            1: '0x66C5c16d13a38461648c1D097f219762D374B412'
        },
        unirouter: {
            1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
        },
        USDC: {
            1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            42: '0xfC121274EDA82a438D56d9B059C42F9363945fc9'
        },
        USDT: {
            1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            42: '0x2dc265244CE729802ca1122A408F6728D2422D28'
        },
        vault3crv: {
            1: '0xBFbEC72F2450eF9Ab742e4A27441Fa06Ca79eA6a'
        },
        WETH: {
            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            42: '0x47D7169F3225CDd461fA82E954b1A3C28E3ce626'
        },
        YAX: {
            1: '0xb1dC9124c395c1e97773ab855d66E879f053A289',
            42: '0xA8805A1680a8fe99DdcBd4b9456eeE702331fAA8'
        }
    },
    solidity: {
        version: '0.6.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    paths: {
        sources: './contracts',
        tests: './test'
    },
    mocha: {
        timeout: 0
    }
};
