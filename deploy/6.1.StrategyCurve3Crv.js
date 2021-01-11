/* eslint-disable no-case-declarations */
module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const {
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

    if (chainId == '1') {
        await deploy('StrategyCurve3Crv', {
            from: deployer,
            args: [
                T3CRV,
                CRV,
                WETH,
                T3CRV,
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
    } else {
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const weth = await deployments.get('WETH');
        await deploy('CRV', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Curve.fi', 'CRV', 18]
        });
        const CRV = await deployments.get('CRV');
        const crv = await ethers.getContractAt('MockERC20', CRV.address, deployer);
        const t3crv = await deployments.get('T3CRV');
        await deploy('MockCurveGauge', {
            from: deployer,
            args: [t3crv.address]
        });
        await deploy('MockCurveMinter', {
            from: deployer,
            args: [CRV.address]
        });
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        const mockGauge = await deployments.get('MockCurveGauge');
        const mockMinter = await deployments.get('MockCurveMinter');
        const router = await deployments.get('MockUniswapRouter');
        await deploy('StrategyCurve3Crv', {
            from: deployer,
            args: [
                t3crv.address,
                CRV.address,
                weth.address,
                t3crv.address,
                dai.address,
                usdc.address,
                usdt.address,
                mockGauge.address,
                mockMinter.address,
                mockStableSwap3Pool.address,
                controller.address,
                manager.address,
                router.address
            ]
        });
        await crv.mint(mockMinter.address, ethers.utils.parseEther('1000'));
        await crv.mint(router.address, ethers.utils.parseEther('1000'));
    }
};
