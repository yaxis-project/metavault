module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let {
        DAI,
        USDC,
        USDT,
        T3CRV,
        WETH,
        PICKLE,
        pchef,
        pjar,
        deployer,
        stableSwap3Pool,
        unirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const manager = await deployments.get('yAxisMetaVaultManager');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('PICKLE', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Pickle', 'PICKLE', 18]
        });
        let pickle = await deployments.get('PICKLE');
        PICKLE = pickle.address;
        pickle = await ethers.getContractAt('MockERC20', PICKLE, deployer);
        await deploy('MockPickleJar', {
            from: deployer,
            log: true,
            args: [T3CRV]
        });
        const mockPickleJar = await deployments.get('MockPickleJar');
        pjar = mockPickleJar.address;
        const deployedPchef = await deploy('MockPickleMasterChef', {
            from: deployer,
            log: true,
            args: [PICKLE, mockPickleJar.address]
        });
        const PCHEF = await deployments.get('MockPickleMasterChef');
        pchef = PCHEF.address;
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
        const mockUnirouter = await deployments.get('MockUniswapRouter');
        unirouter = mockUnirouter.address;
        if (deployedPchef.newlyDeployed) {
            await execute(
                'PICKLE',
                { from: deployer },
                'mint',
                pchef,
                ethers.utils.parseEther('1000')
            );
        }
    }

    const deployedStrategy = await deploy('StrategyPickle3Crv', {
        from: deployer,
        log: true,
        args: [
            T3CRV,
            pjar,
            PICKLE,
            WETH,
            T3CRV,
            DAI,
            USDC,
            USDT,
            stableSwap3Pool,
            controller.address,
            manager.address,
            unirouter
        ]
    });

    if (deployedStrategy.newlyDeployed) {
        await execute('StrategyPickle3Crv', { from: deployer }, 'setStableForLiquidity', DAI);
        await execute('StrategyPickle3Crv', { from: deployer }, 'setPickleMasterChef', pchef);
    }
};
