module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { deployer, stableSwap3Pool } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        const YAX = await deploy('YAX', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['yAxis', 'YAX', 18]
        });
        const dai = await deploy('DAI', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Dai Stablecoin', 'DAI', 18]
        });
        const usdc = await deploy('USDC', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['USD Coin', 'USDC', 6]
        });
        const usdt = await deploy('USDT', {
            from: deployer,
            log: true,
            contract: 'MockERC20NonStandard',
            args: ['Tether', 'USDT', 6]
        });
        const WETH = await deploy('WETH', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Wrapped ETH', 'WETH', 18]
        });
        const t3crv = await deploy('T3CRV', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Curve.fi DAI/USDC/USDT', '3CRV', 18]
        });

        await deploy('ETHUSD', {
            from: deployer,
            log: true,
            contract: 'MockV3Aggregator',
            args: [8, '179166558581']
        });
        await deploy('DAIETH', {
            from: deployer,
            log: true,
            contract: 'MockV3Aggregator',
            args: [18, '555695000000000']
        });
        await deploy('USDCETH', {
            from: deployer,
            log: true,
            contract: 'MockV3Aggregator',
            args: [18, '558246603865858']
        });
        await deploy('USDTETH', {
            from: deployer,
            log: true,
            contract: 'MockV3Aggregator',
            args: [18, '559000000000000']
        });

        await deploy('MockUniswapRouter', {
            from: deployer,
            log: true,
            args: ['0x0000000000000000000000000000000000000000']
        });

        // Special case since Hardhat won't deploy Vyper to Kovan
        if (chainId != '42') {
            stableSwap3Pool = await deploy('MockStableSwap3Pool', {
                from: deployer,
                log: true,
                args: [
                    deployer,
                    [dai.address, usdc.address, usdt.address],
                    t3crv.address,
                    200,
                    4000000,
                    5000000000
                ]
            });
            stableSwap3Pool = stableSwap3Pool.address;
        }
        if (t3crv.newlyDeployed) {
            await execute('T3CRV', { from: deployer }, 'transferOwnership', stableSwap3Pool);
        }

        await deploy('sYAX', {
            contract: 'MockYaxisBar',
            from: deployer,
            log: true,
            args: [YAX.address]
        });

        await deploy('YaxEthUniswapV2Pair', {
            contract: 'MockUniswapPair',
            from: deployer,
            log: true,
            args: [YAX.address, WETH.address]
        });

        await deploy('MockYaxisChef', {
            from: deployer,
            log: true
        });
    }
};

module.exports.tags = ['metavault', 'governance', 'token', 'rewards', 'v3'];
