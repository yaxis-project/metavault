module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const controller = await deployments.get('StrategyControllerV2');
    const manager = await deployments.get('yAxisMetaVaultManager');

    await deploy('yAxisMetaVaultHarvester', {
        from: deployer,
        args: [manager.address, controller.address]
    });
};
