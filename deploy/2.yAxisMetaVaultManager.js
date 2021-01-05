module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, YAX } = await getNamedAccounts();

    await deploy('yAxisMetaVaultManager', {
        from: deployer,
        args: [YAX]
    });
};
