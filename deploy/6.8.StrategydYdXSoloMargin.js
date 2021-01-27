module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { DAI, USDC, WETH, deployer, unirouter, dYdXSoloMargin } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        await deploy('dYdXSoloMargin', {
            from: deployer,
            contract: 'MockdYdXSoloMargin',
            log: true,
            args: [
                [2, 3],
                [USDC, DAI]
            ]
        });
        const deployeddYdXSoloMargin = await deployments.get('dYdXSoloMargin');
        dYdXSoloMargin = deployeddYdXSoloMargin.address;
    }

    const deployedStrategyUSDC = await deploy('StrategydYdXSoloMarginUSDC', {
        from: deployer,
        contract: 'StrategydYdXSoloMargin',
        log: true,
        args: [
            dYdXSoloMargin,
            2,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
    if (deployedStrategyUSDC.newlyDeployed) {
        const Strategy = await deployments.get('StrategydYdXSoloMarginUSDC');
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }

    const deployedStrategyDAI = await deploy('StrategydYdXSoloMarginDAI', {
        from: deployer,
        contract: 'StrategydYdXSoloMargin',
        log: true,
        args: [
            dYdXSoloMargin,
            3,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
    if (deployedStrategyDAI.newlyDeployed) {
        const Strategy = await deployments.get('StrategydYdXSoloMarginDAI');
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }
};
