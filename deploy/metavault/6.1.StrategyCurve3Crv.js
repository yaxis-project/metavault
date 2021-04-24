module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let {
        CRV,
        DAI,
        USDC,
        USDT,
        T3CRV,
        WETH,
        deployer,
        gauge,
        minter,
        stableSwap3Pool,
        unirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const manager = await deployments.get('yAxisMetaVaultManager');
    const name = 'Curve: 3CRV';

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('CRV', {
            from: deployer,
            contract: 'MockERC20',
            log: true,
            args: ['Curve.fi', 'CRV', 18]
        });
        let crv = await deployments.get('CRV');
        CRV = crv.address;
        crv = await ethers.getContractAt('MockERC20', CRV, deployer);
        await deploy('MockCurveGauge', {
            from: deployer,
            log: true,
            args: [t3crv.address]
        });
        const deployedMinter = await deploy('MockCurveMinter', {
            from: deployer,
            log: true,
            args: [crv.address]
        });
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
        const mockGauge = await deployments.get('MockCurveGauge');
        gauge = mockGauge.address;
        const mockMinter = await deployments.get('MockCurveMinter');
        minter = mockMinter.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;
        if (deployedMinter.newlyDeployed) {
            await execute(
                'CRV',
                { from: deployer },
                'mint',
                mockMinter.address,
                ethers.utils.parseEther('1000')
            );
            await execute(
                'CRV',
                { from: deployer },
                'mint',
                router.address,
                ethers.utils.parseEther('1000')
            );
        }
    }

    await deploy('StrategyCurve3Crv', {
        from: deployer,
        log: true,
        args: [
            name,
            T3CRV,
            CRV,
            WETH,
            DAI,
            USDC,
            USDT,
            gauge,
            minter,
            stableSwap3Pool,
            controller.address,
            manager.address,
            unirouter
        ]
    });
};

module.exports.tags = ['metavault', 'live', 'curve-3crv'];
