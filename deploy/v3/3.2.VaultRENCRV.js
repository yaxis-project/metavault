module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, RENCRV } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    if (chainId != '1') {
        const rencrv = await deployments.get('renCrv');

        RENCRV = rencrv.address;
    }

    const VaultToken = await deploy('RENCRVVaultToken', {
        contract: 'VaultToken',
        from: deployer,
        log: true,
        args: ['yAxis BTC Vault Token', 'yV:BTC', Manager.address]
    });

    const Vault = await deploy('RENCRVVault', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: [RENCRV, VaultToken.address, Manager.address]
    });

    const Gauge = await deploy('VaultRENCRVGauge', {
        contract: 'LiquidityGaugeV2',
        from: deployer,
        log: true,
        args: [VaultToken.address, Minter.address, GaugeProxy.address]
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
        await execute(
            'Manager',
            { from: deployer, log: true },
            'setAllowedVault',
            Vault.address,
            true
        );
        await execute('Manager', { from: deployer, log: true }, 'addVault', Vault.address);
        await execute(
            'Manager',
            { from: deployer, log: true },
            'setController',
            Vault.address,
            Controller.address
        );
        await execute('RENCRVVault', { from: deployer, log: true }, 'setGauge', Gauge.address);
    }
};

module.exports.tags = ['v3', 'gauges'];
