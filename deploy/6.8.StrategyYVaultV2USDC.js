module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { USDC, WETH, yVaultV2USDC, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId != '1') {
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        await deploy('yVaultV2USDC', {
            from: deployer,
            contract: 'MockYVaultV2',
            log: true,
            args: ['USDC yVault', 'yvUSDC', USDC]
        });
        const yVaultV2Usdc = await deployments.get('yVaultV2USDC');
        yVaultV2USDC = yVaultV2Usdc.address;
    }

    const deployedStrategy = await deploy('StrategyYVaultV2USDC', {
        contract: 'StrategyYVaultV2',
        from: deployer,
        log: true,
        args: [
            'YVaultV2: USDC',
            yVaultV2USDC,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });

    if (deployedStrategy.newlyDeployed) {
        const Strategy = await deployments.get('StrategyYVaultV2USDC');
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }
};
