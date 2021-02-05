module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    let { USDT, WETH, deployer, unirouter, flamIncomeUSDT } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId != '1') {
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        await deploy('flamIncomeUSDT', {
            from: deployer,
            contract: 'MockFlamIncomeVault',
            log: true,
            args: [USDT]
        });
        const flamIncomeUsdt = await deployments.get('flamIncomeUSDT');
        flamIncomeUSDT = flamIncomeUsdt.address;
    }

    await deploy('StrategyFlamIncome', {
        from: deployer,
        log: true,
        args: [
            flamIncomeUSDT,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
};

module.exports.tags = ['metavault'];
