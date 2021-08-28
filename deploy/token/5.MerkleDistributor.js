module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const YAXIS = await deployments.get('YaxisToken');
    const MERKLE_ROOT = '0x3dfe13c4a605fd21576c89fa0b335cedb97b748cada972e960abc763da1a4449';

    await deploy('MerkleDistributor', {
        from: deployer,
        log: true,
        args: [YAXIS.address, MERKLE_ROOT]
    });
};

module.exports.tags = ['merkledrop'];
