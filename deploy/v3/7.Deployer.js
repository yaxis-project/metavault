module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('Depositor', {
        from: deployer,
        log: true
    });
};

module.exports.tags = ['v3'];
