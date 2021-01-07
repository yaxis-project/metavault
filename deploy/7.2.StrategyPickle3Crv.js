/* eslint-disable no-case-declarations */
module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const {
        DAI,
        USDC,
        USDT,
        T3CRV,
        WETH,
        PICKLE,
        pjar,
        deployer,
        stableSwap3Pool,
        unirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const manager = await deployments.get('yAxisMetaVaultManager');

    switch (chainId) {
        case '1':
            await deploy('StrategyPickle3Crv', {
                from: deployer,
                args: [
                    T3CRV,
                    pjar,
                    PICKLE,
                    WETH,
                    T3CRV,
                    DAI,
                    USDC,
                    USDT,
                    stableSwap3Pool,
                    controller.address,
                    manager.address,
                    unirouter
                ]
            });
            break;
        case '42':
            const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            const mockPickleJar = await deployments.get('MockPickleJar');
            const mockUnirouter = await deployments.get('MockUniswapRouter');
            await deploy('StrategyPickle3Crv', {
                from: deployer,
                args: [
                    T3CRV,
                    mockPickleJar.address,
                    PICKLE,
                    WETH,
                    T3CRV,
                    DAI,
                    USDC,
                    USDT,
                    mockStableSwap3Pool.address,
                    controller.address,
                    manager.address,
                    mockUnirouter.address
                ]
            });
            break;
    }
};
