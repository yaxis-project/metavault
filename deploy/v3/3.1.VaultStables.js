module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    const Vault = await deploy('VaultStables', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: ['yAxis Stablecoin Canonical Vault', 'CV:S', Manager.address]
    });

    await deploy('VaultStablesGauge', {
        contract: 'LiquidityGaugeV2',
        from: deployer,
        log: true,
        args: [Vault.address, Minter.address, GaugeProxy.address]
    });
};

module.exports.tags = ['v3', 'gauges'];
