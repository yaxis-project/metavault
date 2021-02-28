module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const Manager = await deployments.get('Manager');
    const Controller = await deployments.get('Controller');

    const vault = await deploy('VaultStables', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: ['Vault: Stables', 'MV:S', Manager.address]
    });

    if (vault.newlyDeployed) {
        const manager = await ethers.getContractAt('Manager', Manager.address, deployer);
        if ((await manager.governance()) == deployer) {
            await execute(
                'Manager',
                { from: deployer, log: true },
                'setAllowedVault',
                vault.address,
                true
            );

            await execute(
                'Manager',
                { from: deployer, log: true },
                'setController',
                vault.address,
                Controller.address
            );
        }
    }
};

module.exports.tags = ['v3'];
