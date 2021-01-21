module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { DAI, IDLE, COMP, WETH, idleDAI, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        await deploy('COMP', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Compound', 'COMP', 18]
        });
        const comp = await deployments.get('COMP');
        COMP = comp.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('IDLE', {
            from: deployer,
            contract: 'MockERC20',
            log: true,
            args: ['IDLE Token', 'IDLE', 18]
        });
        IDLE = await deployments.get('IDLE');
        IDLE = IDLE.address;
        const deployedIdleDAI = await deploy('idleDAI', {
            from: deployer,
            contract: 'MockIdleToken',
            log: true,
            args: ['Idle Token DAI', 'idleDAIYield', dai.address, IDLE, COMP]
        });
        const idleDai = await deployments.get('idleDAI');
        idleDAI = idleDai.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        if (deployedIdleDAI.newlyDeployed) {
            await execute(
                'IDLE',
                { from: deployer },
                'mint',
                router.address,
                ethers.utils.parseEther('1000')
            );
            await execute(
                'COMP',
                { from: deployer },
                'mint',
                router.address,
                ethers.utils.parseEther('1000')
            );
            await execute(
                'IDLE',
                { from: deployer },
                'mint',
                idleDai.address,
                ethers.utils.parseEther('1000')
            );
            await execute(
                'COMP',
                { from: deployer },
                'mint',
                idleDai.address,
                ethers.utils.parseEther('1000')
            );
        }
    }

    const deployedStrategy = await deploy('StrategyIdle', {
        from: deployer,
        log: true,
        args: [
            DAI,
            idleDAI,
            IDLE,
            COMP,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        ]
    });

    if (deployedStrategy.newlyDeployed) {
        const Strategy = await deployments.get('StrategyIdle');
        await execute(
            'StableSwap3PoolConverter',
            { from: deployer },
            'setStrategy',
            Strategy.address,
            true
        );
    }
};
