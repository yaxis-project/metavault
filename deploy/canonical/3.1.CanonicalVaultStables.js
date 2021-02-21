module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const manager = await deployments.get('Manager');

    await deploy('CanonicalVaultStables', {
        contract: 'CanonicalVault',
        from: deployer,
        log: true,
        args: ['CanonicalVault: Stables', 'CV:S', manager.address]
    });
};

module.exports.tags = ['canonical'];
