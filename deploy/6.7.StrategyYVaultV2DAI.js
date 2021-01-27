module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { DAI, WETH, yVaultV2DAI, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        await deploy('yVaultV2DAI', {
            from: deployer,
            contract: 'MockYVaultV2',
            log: true,
            args: ['DAI yVault', 'yvDAI', DAI]
        });
        const yVaultV2Dai = await deployments.get('yVaultV2DAI');
        yVaultV2DAI = yVaultV2Dai.address;
    }

    const deployedStrategy = await deploy('StrategyYVaultV2DAI', {
        contract: 'StrategyYVaultV2',
        from: deployer,
        log: true,
        args: [
            'YVaultV2: DAI',
            yVaultV2DAI,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });

    if (deployedStrategy.newlyDeployed) {
        const Strategy = await deployments.get('StrategyYVaultV2DAI');
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }
};
