module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        FRAXCRV,
        WETH,
        deployer,
        convexBoost,
        FRAXStableSwap,
        unirouter,
        sushirouter,
        USDC,
        FRAXPOOL
    } = await getNamedAccounts();
    //const chainId = await getChainId();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('RENCRVVault');
    const name = 'yAxis Convex Strategy: FRAXCRV';
    let pid = 32;

    //if (chainId != '1') {}

    const routers = [sushirouter, unirouter];

    const Strategy = await deploy('FRAXCRVConvexStrategy', {
        contract: 'FRAXCRVConvexStrategy',
        from: deployer,
        log: true,
        args: [
            name,
            FRAXCRV,
            CRV,
            CVX,
            WETH,
            pid,
            USDC,
            FRAXPOOL,
            convexBoost,
            FRAXStableSwap,
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
