module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const Manager = await deployments.get('Manager');

    const vaultFactory = await deploy('VaultFactory', {
        from: deployer,
        log: true,
        args: [Manager.address]
    });

    if (vaultFactory.newlyDeployed) {
        const manager = await ethers.getContractAt('Manager', Manager.address, deployer);
        if ((await manager.governance()) == deployer) {
            await execute(
                'Manager',
                { from: deployer, log: true },
                'setAllowedVaultFactory',
                vaultFactory.address,
                true
            );
        }
    }
};

module.exports.tags = ['v3'];
