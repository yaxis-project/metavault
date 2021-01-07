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

    switch (chainId) {
        case '1':
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
            break;
        case '42':
            const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            const mockGauge = await deployments.get('MockCurveGauge');
            const mockMinter = await deployments.get('MockCurveMinter');
            const mockUnirouter = await deployments.get('MockUniswapRouter');
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
                    mockGauge.address,
                    mockMinter.address,
                    mockStableSwap3Pool.address,
                    controller.address,
                    manager.address,
                    mockUnirouter.address
                ]
            });
            break;
    }
};
