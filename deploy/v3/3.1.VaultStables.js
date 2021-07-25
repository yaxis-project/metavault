module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
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

    const Gauge = await deploy('VaultStablesGauge', {
        contract: 'LiquidityGaugeV2',
        from: deployer,
        log: true,
        args: [Vault.address, Minter.address, GaugeProxy.address]
    });

    if (Gauge.newlyDeployed) {
        await execute(
            'GaugeController',
            { from: deployer, log: true },
            'add_gauge(address,int128,uint256)',
            Gauge.address,
            0,
            ethers.utils.parseEther('1')
        );
    }
};

module.exports.tags = ['v3', 'gauges'];
