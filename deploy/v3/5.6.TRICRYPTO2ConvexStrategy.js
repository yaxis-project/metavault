module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        TRICRYPTO2,
        WETH,
        deployer,
        convexBoost,
        TRICRYPTO2StableSwap,
        unirouter,
        sushirouter
    } = await getNamedAccounts();
    //const chainId = await getChainId();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('RENCRVVault');
    const name = 'yAxis Convex Strategy: TRICRYPTO2';
    let pid = 38;

    //if (chainId != '1') {}

    const routers = [sushirouter, unirouter];

    const Strategy = await deploy('TRICRYPTO2ConvexStrategy', {
        contract: 'TRICRYPTO2ConvexStrategy',
        from: deployer,
        log: true,
        args: [
            name,
            TRICRYPTO2,
            CRV,
            CVX,
            WETH,
            pid,
            2,
            convexBoost,
            TRICRYPTO2StableSwap,
            Controller.address,
            Manager.address,
            routers
        ]
    });

    if (Strategy.newlyDeployed) {
        await execute(
            'Manager',
            { from: deployer, log: true },
            'setAllowedStrategy',
            Strategy.address,
            true
        );
        await execute(
            'Controller',
            { from: deployer, log: true },
            'addStrategy',
            Vault.address,
            Strategy.address,
            0,
            86400
        );
    }
};

module.exports.tags = ['v3-strategies', 'GeneralConvexStrategy'];
