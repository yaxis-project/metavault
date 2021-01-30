module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const chainId = await getChainId();
    const { deployer } = await getNamedAccounts();

    // yAxisMetaVault is already deployed to mainnet
    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const t3crv = await deployments.get('T3CRV');
        await deploy('yAxisMetaVault', {
            from: deployer,
            log: true,
            args: [
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                yax.address,
                '10000000000000',
                1
            ]
        });
    }
};

module.exports.tags = ['metavault', 'live'];
