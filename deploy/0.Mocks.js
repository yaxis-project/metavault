module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        await deploy('YAX', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['yAxis', 'YAX', 18]
        });
        await deploy('DAI', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Dai Stablecoin', 'DAI', 18]
        });
        const dai = await deployments.get('DAI');
        await deploy('USDC', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['USD Coin', 'USDC', 6]
        });
        const usdc = await deployments.get('USDC');
        await deploy('USDT', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Tether', 'USDT', 6]
        });
        const usdt = await deployments.get('USDT');
        await deploy('WETH', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Wrapped ETH', 'WETH', 18]
        });
        await deploy('T3CRV', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Curve.fi DAI/USDC/USDT', '3CRV', 18]
        });
        const t3crv = await deployments.get('T3CRV');

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
        await deploy('MockStableSwap3Pool', {
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
        const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        await execute(
            'T3CRV',
            { from: deployer },
            'transferOwnership',
            stableSwap3Pool.address
        );
    }
};

module.exports.tags = ['metavault'];
