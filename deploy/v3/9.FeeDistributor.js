module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const VotingEscrow = await deployments.get('VotingEscrow');

    await deploy('FeeDistributor', {
        from: deployer,
        log: true,
        args: [VotingEscrow.address]
    });
};

module.exports.tags = ['v3'];
