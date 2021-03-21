module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const YAXIS = await deployments.get('YaxisToken');

    await deploy('RewardsYaxis', {
        contract: 'Rewards',
        from: deployer,
        log: true,
        args: [YAXIS.address, YAXIS.address, 31556952]
    });

    await execute('RewardsYaxis', { from: deployer }, 'setRewardDistribution', deployer);
};

module.exports.tags = ['token'];
