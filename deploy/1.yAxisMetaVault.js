module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const chainId = await getChainId();
    const { deployer, DAI, USDC, USDT, T3CRV, YAX } = await getNamedAccounts();

    if (chainId == '42') {
        await deploy('yAxisMetaVault', {
            from: deployer,
            args: [DAI, USDC, USDT, T3CRV, YAX, '10000000000000', 1]
        });
    }
};
