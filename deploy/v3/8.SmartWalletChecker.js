module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const SmartWalletChecker = await deploy('SmartWalletChecker', {
        from: deployer,
        log: true
    });

};

module.exports.tags = ['v3'];
