module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
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

    await deploy('StrategydYdXSoloMargin', {
        from: deployer,
        contract: 'StrategydYdXSoloMargin',
        log: true,
        args: [
            dYdXSoloMargin,
            3, // Market IDs are documented here: https://docs.dydx.exchange/#solo-markets
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
};

module.exports.tags = ['metavault'];
