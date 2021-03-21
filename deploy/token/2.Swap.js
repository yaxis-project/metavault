module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();
    let { SYAX, YAX } = await getNamedAccounts();
    const YAXIS = await deployments.get('YaxisToken');

    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        YAX = yax.address;
        const syax = await deployments.get('sYAX');
        SYAX = syax.address;
    }

    await deploy('Swap', {
        from: deployer,
        log: true,
        args: [YAXIS.address, YAX, SYAX]
    });
};

module.exports.tags = ['token'];
