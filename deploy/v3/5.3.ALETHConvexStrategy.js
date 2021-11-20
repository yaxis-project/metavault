module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        ALETHCRV,
        ALETH,
        WETH,
        deployer,
        convexBoost,
        stableSwapALETHPool,
        unirouter,
        sushirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('ALETHCRVVault');
    const name = 'yAxis Convex Strategy: ALETHCRV';
    let pid = 49;

    if (chainId != '1') {
        const alethcrv = await deployments.get('alethCrv');
        ALETHCRV = alethcrv.address;

        const weth = await deployments.get('WETH');
        WETH = weth.address;

        let crv = await deployments.get('CRV');
        CRV = crv.address;
        crv = await ethers.getContractAt('MockERC20', CRV, deployer);

        let cvx = await deployments.get('CVX');
        CVX = cvx.address;
        cvx = await ethers.getContractAt('MockERC20', CVX, deployer);

        const mockConvexVault = await deployments.get('MockConvexVault');
        convexBoost = mockConvexVault.address;

        await execute('CVX', { from: deployer }, 'mint', convexBoost, '10000000000000000000');

        await execute(
            'MockConvexVault',
            { from: deployer, log: true },
            'addPool(address,address,uint256)',
            ALETHCRV,
            ALETHCRV,
            0
        );

        const mockStableSwap2Pool = await deployments.get('MockETHStableSwap2Pool');
        stableSwapALETHPool = mockStableSwap2Pool.address;

        const router = await deployments.get('MockUniswapRouter');
        unirouter = [router.address, router.address];

        pid = 2;
    }

    const routers = [sushirouter, unirouter];

    const Strategy = await deploy('ALETHConvexStrategy', {
        contract: 'ETHConvexStrategy',
        from: deployer,
        log: true,
        args: [
            name,
            ALETHCRV,
            CRV,
            CVX,
            WETH,
            ALETH,
            pid,
            convexBoost,
            stableSwapALETHPool,
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
