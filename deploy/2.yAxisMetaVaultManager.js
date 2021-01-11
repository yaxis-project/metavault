module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const chainId = await getChainId();
    const { deployer, YAX } = await getNamedAccounts();

    if (chainId == '1') {
        await deploy('yAxisMetaVaultManager', {
            from: deployer,
            args: [YAX]
        });
    } else {
        const yax = await deployments.get('YAX');
        await deploy('yAxisMetaVaultManager', {
            from: deployer,
            args: [yax.address]
        });
    }
};
