module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        await deploy('YAX', {
            from: deployer,
            contract: 'MockERC20',
            args: ['yAxis', 'YAX', 18]
        });
        await deploy('DAI', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Dai Stablecoin', 'DAI', 18]
        });
        const dai = await deployments.get('DAI');
        await deploy('USDC', {
            from: deployer,
            contract: 'MockERC20',
            args: ['USD Coin', 'USDC', 6]
        });
        const usdc = await deployments.get('USDC');
        await deploy('USDT', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Tether', 'USDT', 6]
        });
        const usdt = await deployments.get('USDT');
        await deploy('WETH', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Wrapped ETH', 'WETH', 18]
        });
        await deploy('T3CRV', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Curve.fi DAI/USDC/USDT', '3CRV', 18]
        });
        const t3crv = await deployments.get('T3CRV');

        await deploy('MockUniswapRouter', {
            from: deployer,
            args: ['0x0000000000000000000000000000000000000000']
        });
        await deploy('MockStableSwap3Pool', {
            from: deployer,
            args: [dai.address, usdc.address, usdt.address, t3crv.address]
        });
    }
};
