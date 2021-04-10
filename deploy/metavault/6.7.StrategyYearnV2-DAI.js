module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    let { DAI, WETH, yvDAI, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');
    const name = 'YearnV2: DAI';

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
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

    await deploy('StrategyYearnV2-DAI', {
        contract: 'StrategyYearnV2',
        from: deployer,
        log: true,
        args: [
            name,
            yvDAI,
            DAI,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
};

module.exports.tags = ['metavault', 'yearn-v2-dai'];
