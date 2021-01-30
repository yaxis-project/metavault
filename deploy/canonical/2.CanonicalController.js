module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const manager = await deployments.get('Manager');

    await deploy('CanonicalController', {
        from: deployer,
        log: true,
        args: [manager.address]
    });
};

module.exports.tags = ['canonical', 'live'];
