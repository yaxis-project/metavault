module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    let { deployer } = await getNamedAccounts();

    await deploy('SmartWalletChecker', {
        from: deployer,
        log: true
    });
};

module.exports.tags = ['v3'];
