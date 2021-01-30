module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const chainId = await getChainId();
    let { deployer, YAX } = await getNamedAccounts();

    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        YAX = yax.address;
    }

    await deploy('Manager', {
        from: deployer,
        log: true,
        args: [YAX]
    });
};

module.exports.tags = ['canonical', 'live'];
