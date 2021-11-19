module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, LINKCRV } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    if (chainId != '1') {
        const linkcrv = await deployments.get('LINKCRV');

        LINKCRV = linkcrv.address;
    }

    const VaultToken = await deploy('LINKCRVVaultToken', {
        contract: 'VaultToken',
        from: deployer,
        log: true,
        args: ['yAxis LINK Vault Token', 'yV:LINK', Manager.address]
    });

    const Vault = await deploy('LINKCRVVault', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: [LINKCRV, VaultToken.address, Manager.address]
    });

    const Gauge = await deploy('VaultLINKCRVGauge', {
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
        await execute(
            'LINKCRVVault',
            { from: deployer, log: true },
            'setGauge',
            Gauge.address
        );
    }
};

module.exports.tags = ['v3', 'gauges'];
