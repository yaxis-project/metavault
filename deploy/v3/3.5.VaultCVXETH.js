module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, CVXETH } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    if (chainId != '1') {
        const cvxeth = await deployments.deploy('CVXETH', {
            from: deployer,
            contract: 'MockERC20',
            args: ['CVXETH', 'CVXETH', 18]
        });

        CVXETH = cvxeth.address;
    }

    const VaultToken = await deploy('CVXETHVaultToken', {
        contract: 'VaultToken',
        from: deployer,
        log: true,
        args: ['yAxis CVXETHCRV Vault Token', 'yV:CVXETHCRV', Manager.address]
    });

    const Vault = await deploy('CVXETHVault', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: [CVXETH, VaultToken.address, Manager.address]
    });

    const Gauge = await deploy('VaultCVXETHGauge', {
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
        await execute('CVXETHVault', { from: deployer, log: true }, 'setGauge', Gauge.address);
    }
};

module.exports.tags = ['v3', 'gauges'];
