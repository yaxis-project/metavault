module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    let { DAI, DF, WETH, dDAI, dRewardsDAI, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('DF', {
            from: deployer,
            contract: 'MockERC20',
            args: ['dForce', 'DF', 18]
        });
        DF = await deployments.get('DF');
        DF = DF.address;
        const df = await ethers.getContractAt('MockERC20', DF, deployer);
        await deploy('dDAI', {
            from: deployer,
            contract: 'MockDErc20',
            args: ['dForce DAI', 'dDAI', dai.address]
        });
        const dDai = await deployments.get('dDAI');
        dDAI = dDai.address;
        await deploy('MockDRewards', {
            from: deployer,
            args: [dDai.address, DF, 100]
        });
        const mockDRewards = await deployments.get('MockDRewards');
        dRewardsDAI = mockDRewards.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        await df.mint(router.address, ethers.utils.parseEther('1000'));
        await df.mint(mockDRewards.address, ethers.utils.parseEther('1000'));
    }

    await deploy('StrategyDforce', {
        from: deployer,
        args: [
            DAI,
            dDAI,
            dRewardsDAI,
            DF,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });
    const Strategy = await deployments.get('StrategyDforce');
    const converter = await ethers.getContractAt(
        'StableSwap3PoolConverter',
        Converter.address,
        deployer
    );
    if (!(await converter.strategies(Strategy.address))) {
        await converter.setStrategy(Strategy.address, true);
    }
};
