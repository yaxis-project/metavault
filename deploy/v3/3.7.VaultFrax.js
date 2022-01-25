module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, FRAXCRV } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    if (chainId != '1') {
        const frax = await deployments.deploy('FRAXCRV', {
            from: deployer,
            contract: 'MockERC20',
            args: ['FRAXCRV', 'FRAXCRV', 18]
        });

        FRAXCRV = frax.address;
    }

    const VaultToken = await deploy('FRAXCRVVaultToken', {
        contract: 'VaultToken',
        from: deployer,
        log: true,
        args: ['yAxis FRAXCRV Vault Token', 'yV:FRAXCRV', Manager.address]
    });

    const Vault = await deploy('FRAXCRVVault', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: [FRAXCRV, VaultToken.address, Manager.address]
    });

    const Gauge = await deploy('VaultFRAXCRVGauge', {
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
            ethers.utils.parseEther('1046475')
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
            'FRAXCRVVault',
            { from: deployer, log: true },
            'setGauge',
            Gauge.address
        );
    }
};

module.exports.tags = ['v3', 'gauges', 'now'];
