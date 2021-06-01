module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');

    const Vault = await deploy('VaultStables', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: ['yAxis Stablecoin Canonical Vault', 'CV:S', Manager.address]
    });

    await deploy('LiquidityGaugeV2', {
        from: deployer,
        log: true,
        args: [Vault.address, Minter.address, treasury]
    });

    // TODO: switch to a script/test that will use ethers since hardhat-deploy
    // doesn't seem to work with Vyper contracts
    // if (StablesLiquidityGauge.newlyDeployed) {
    //     await execute(
    //         'GaugeController',
    //         { from: deployer, log: true },
    //         'add_gauge',
    //         StablesLiquidityGauge.address,
    //         0,
    //         0
    //     );
    // }
};

module.exports.tags = ['v3', 'gauges'];
