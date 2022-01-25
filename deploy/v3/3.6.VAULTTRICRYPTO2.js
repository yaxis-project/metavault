module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, TRICRYPTO2 } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    if (chainId != '1') {
        const tri = await deployments.deploy('TRICRYPTO2', {
            from: deployer,
            contract: 'MockERC20',
            args: ['TRICRYPTO2', 'TRICRYPTO2', 18]
        });

        TRICRYPTO2 = tri.address;
    }

    const VaultToken = await deploy('TRICRYPTO2VaultToken', {
        contract: 'VaultToken',
        from: deployer,
        log: true,
        args: ['yAxis TRICRYPTO2 Vault Token', 'yV:TRICRYPTO2', Manager.address]
    });

    const Vault = await deploy('TRICRYPTO2Vault', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: [TRICRYPTO2, VaultToken.address, Manager.address]
    });

    const Gauge = await deploy('VaultTRICRYPTO2Gauge', {
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
            ethers.utils.parseEther('1346475')
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
        await execute(
            'TRICRYPTO2Vault',
            { from: deployer, log: true },
            'setGauge',
            Gauge.address
        );
    }
};

module.exports.tags = ['v3', 'gauges'];
