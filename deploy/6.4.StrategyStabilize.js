module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let {
        DAI,
        STBZ,
        WETH,
        zpaDAI,
        STBZOperator,
        deployer,
        unirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');
    let poolId = 0;

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('STBZ', {
            from: deployer,
            contract: 'MockERC20',
            log: true,
            args: ['Stabilize Token', 'STBZ', 18]
        });
        STBZ = await deployments.get('STBZ');
        STBZ = STBZ.address;
        await deploy('zpaDAI', {
            from: deployer,
            contract: 'MockzpaToken',
            log: true,
            args: ['Stabilize Token DAI', 'zpa-DAI', dai.address]
        });
        const zpaDai = await deployments.get('zpaDAI');
        zpaDAI = zpaDai.address;
        const deployedSTBZPool = await deploy('MockStabilizePool', {
            from: deployer,
            log: true,
            args: [zpaDai.address, STBZ, 100]
        });
        const mockStabilizePool = await deployments.get('MockStabilizePool');
        STBZOperator = mockStabilizePool.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        if (deployedSTBZPool.newlyDeployed) {
            await execute(
                'STBZ',
                { from: deployer },
                'mint',
                router.address,
                ethers.utils.parseEther('1000')
            );
            await execute(
                'STBZ',
                { from: deployer },
                'mint',
                mockStabilizePool.address,
                ethers.utils.parseEther('1000')
            );
        }
    } else {
        poolId = zpaDAI.poolId;
    }

    const deployedStrategy = await deploy('StrategyStabilize', {
        from: deployer,
        log: true,
        args: [
            DAI,
            zpaDAI,
            STBZOperator,
            poolId,
            STBZ,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
    const Strategy = await deployments.get('StrategyStabilize');
    if (deployedStrategy.newlyDeployed) {
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }
};
