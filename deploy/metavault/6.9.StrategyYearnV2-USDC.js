module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    let { USDC, WETH, yvUSDC, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');
    const name = 'YearnV2: USDC';

    if (chainId != '1') {
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('yvUSDC', {
            from: deployer,
            contract: 'MockYearnV2',
            log: true,
            args: ['USDC yVault', 'yvUSDC', usdc.address]
        });
        const yvUsdc = await deployments.get('yvUSDC');
        yvUSDC = yvUsdc.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
    }

    await deploy('StrategyYearnV2-USDC', {
        contract: 'StrategyYearnV2',
        from: deployer,
        log: true,
        args: [
            name,
            yvUSDC,
            USDC,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
};

module.exports.tags = ['metavault', 'yearn-v2-usdc'];
