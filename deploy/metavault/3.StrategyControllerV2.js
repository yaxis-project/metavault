module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const manager = await deployments.get('yAxisMetaVaultManager');

    await deploy('StrategyControllerV2', {
        from: deployer,
        log: true,
        args: [manager.address]
    });
};

module.exports.tags = ['metavault', 'live'];
