/* eslint-disable no-case-declarations */
module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { DAI, USDC, USDT, T3CRV, deployer, stableSwap3Pool } = await getNamedAccounts();
    const chainId = await getChainId();
    const manager = await deployments.get('yAxisMetaVaultManager');

    switch (chainId) {
        case '1':
            await deploy('StableSwap3PoolConverter', {
                from: deployer,
                args: [DAI, USDC, USDT, T3CRV, stableSwap3Pool, manager.address]
            });
            break;
        case '42':
            const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            await deploy('StableSwap3PoolConverter', {
                from: deployer,
                args: [DAI, USDC, USDT, T3CRV, mockStableSwap3Pool.address, manager.address]
            });
            break;
    }
};
