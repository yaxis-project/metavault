module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const manager = await deployments.get('Manager');

    await deploy('VaultStables', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: ['Vault: Stables', 'MV:S', manager.address]
    });
};

module.exports.tags = ['v3'];
