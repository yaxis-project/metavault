module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
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
            log: true,
            args: ['dForce', 'DF', 18]
        });
        DF = await deployments.get('DF');
        DF = DF.address;
        await deploy('dDAI', {
            from: deployer,
            contract: 'MockDErc20',
            log: true,
            args: ['dForce DAI', 'dDAI', dai.address]
        });
        const dDai = await deployments.get('dDAI');
        dDAI = dDai.address;
        const deployedDRewards = await deploy('MockDRewards', {
            from: deployer,
            log: true,
            args: [dDai.address, DF, 100]
        });
        const mockDRewards = await deployments.get('MockDRewards');
        dRewardsDAI = mockDRewards.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        if (deployedDRewards.newlyDeployed) {
            await execute(
                'DF',
                { from: deployer },
                'mint',
                router.address,
                ethers.utils.parseEther('1000')
            );
            await execute(
                'DF',
                { from: deployer },
                'mint',
                mockDRewards.address,
                ethers.utils.parseEther('1000')
            );
        }
    }

    const deployedStrategy = await deploy('StrategyDforce', {
        from: deployer,
        log: true,
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
