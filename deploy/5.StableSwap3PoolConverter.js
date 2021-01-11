module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { DAI, USDC, USDT, T3CRV, deployer, stableSwap3Pool } = await getNamedAccounts();
    const chainId = await getChainId();
    const manager = await deployments.get('yAxisMetaVaultManager');

    if (chainId == '1') {
        await deploy('StableSwap3PoolConverter', {
            from: deployer,
            args: [DAI, USDC, USDT, T3CRV, stableSwap3Pool, manager.address]
        });
    } else {
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const t3crv = await deployments.get('T3CRV');
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        await deploy('StableSwap3PoolConverter', {
            from: deployer,
            args: [
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                mockStableSwap3Pool.address,
                manager.address
            ]
        });
    }
};
