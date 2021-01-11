module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
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
            contract: 'MockERC20',
            args: ['Pickle', 'PICKLE', 18]
        });
        let pickle = await deployments.get('PICKLE');
        PICKLE = pickle.address;
        pickle = await ethers.getContractAt('MockERC20', PICKLE, deployer);
        await deploy('MockPickleJar', {
            from: deployer,
            args: [T3CRV]
        });
        const mockPickleJar = await deployments.get('MockPickleJar');
        pjar = mockPickleJar.address;
        await deploy('MockPickleMasterChef', {
            from: deployer,
            args: [PICKLE, mockPickleJar.address]
        });
        const PCHEF = await deployments.get('MockPickleMasterChef');
        pchef = PCHEF.address;
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
        const mockUnirouter = await deployments.get('MockUniswapRouter');
        unirouter = mockUnirouter.address;
        await pickle.mint(pchef, ethers.utils.parseEther('1000'));
    }

    await deploy('StrategyPickle3Crv', {
        from: deployer,
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
    const Strategy = await deployments.get('StrategyPickle3Crv');
    const strategy = await ethers.getContractAt(
        'StrategyPickle3Crv',
        Strategy.address,
        deployer
    );
    if ((await strategy.stableForAddLiquidity()) != DAI) {
        await strategy.setStableForLiquidity(DAI);
    }
    if ((await strategy.pickleMasterChef()) != pchef) {
        await strategy.setPickleMasterChef(pchef);
    }
};
