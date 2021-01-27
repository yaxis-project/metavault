module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { WETH, yvDAI, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');
    const name = 'YearnV2: DAI';

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('yvDAI', {
            from: deployer,
            contract: 'MockYearnV2',
            log: true,
            args: ['DAI yVault', 'yvDAI', dai.address]
        });
        const yvDai = await deployments.get('yvDAI');
        yvDAI = yvDai.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
    }

    const deployedStrategy = await deploy('StrategyYearnV2', {
        from: deployer,
        log: true,
        args: [
            name,
            yvDAI,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });

    if (deployedStrategy.newlyDeployed) {
        const Strategy = await deployments.get('StrategyYearnV2');
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }
};
