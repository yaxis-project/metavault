/* eslint-disable no-case-declarations */
module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { CRV, DAI, USDC, USDT, T3CRV, PICKLE, deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    switch (chainId) {
        case '42':
            await deploy('MockUniswapRouter', {
                from: deployer,
                args: ['0x0000000000000000000000000000000000000000']
            });
            await deploy('MockStableSwap3Pool', {
                from: deployer,
                args: [DAI, USDC, USDT, T3CRV]
            });
            await deploy('MockCurveGauge', {
                from: deployer,
                args: [T3CRV]
            });
            await deploy('MockCurveMinter', {
                from: deployer,
                args: [CRV]
            });
            await deploy('MockPickleJar', {
                from: deployer,
                args: [T3CRV]
            });
            const mockPickleJar = await deployments.get('MockPickleJar');
            await deploy('MockPickleMasterChef', {
                from: deployer,
                args: [PICKLE, mockPickleJar.address]
            });
            break;
    }
};
