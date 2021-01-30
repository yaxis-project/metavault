module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    let { DAI, USDC, USDT, T3CRV, deployer, stableSwap3Pool } = await getNamedAccounts();
    const chainId = await getChainId();
    const manager = await deployments.get('yAxisMetaVaultManager');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
    }

    await deploy('StableSwap3PoolConverter', {
        from: deployer,
        log: true,
        args: [DAI, USDC, USDT, T3CRV, stableSwap3Pool, manager.address]
    });
};

module.exports.tags = ['metavault', 'live'];
