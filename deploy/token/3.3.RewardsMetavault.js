module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let { deployer, treasury, vault3crv } = await getNamedAccounts();
    const chainId = await getChainId();
    const YAXIS = await deployments.get('YaxisToken');

    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const t3crv = await deployments.get('T3CRV');
        const Vault = await deploy('yAxisMetaVault', {
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
        vault3crv = Vault.address;
    }

    const Rewards = await deploy('RewardsMetavault', {
        contract: 'Rewards',
        from: deployer,
        log: true,
        args: [YAXIS.address, vault3crv, 7257600]
    });

    await execute(
        'RewardsMetavault',
        { from: deployer, log: true },
        'setRewardDistribution',
        treasury
    );
    await execute(
        'YaxisToken',
        { from: deployer, log: true },
        'transfer',
        Rewards.address,
        ethers.utils.parseEther('1000000')
    );
};

module.exports.tags = ['token'];
