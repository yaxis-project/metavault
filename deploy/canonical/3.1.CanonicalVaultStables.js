module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const manager = await deployments.get('Manager');
    const controller = await deployments.get('CanonicalController');

    await deploy('CanonicalVaultStables', {
        contract: 'CanonicalVault',
        from: deployer,
        log: true,
        args: ['CanonicalVault: Stables', 'MVLT:S', manager.address, controller.address]
    });
};

module.exports.tags = ['canonical', 'live'];
