/* eslint-disable no-case-declarations */
module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy } = deployments;
    const { DAI, DF, WETH, dDAI, dRewardsDAI, deployer, unirouter } = await getNamedAccounts();
    const chainId = await getChainId();
    const controller = await deployments.get('StrategyControllerV2');
    const vaultManager = await deployments.get('yAxisMetaVaultManager');
    const Converter = await deployments.get('StableSwap3PoolConverter');

    if (chainId == '1') {
        await deploy('StrategyDforce', {
            from: deployer,
            args: [
                DAI,
                dDAI,
                dRewardsDAI,
                DF,
                Converter.address,
                controller.address,
                vaultManager.address,
                WETH,
                unirouter
            ]
        });
    } else {
        const dai = await deployments.get('DAI');
        const weth = await deployments.get('WETH');
        await deploy('DF', {
            from: deployer,
            contract: 'MockERC20',
            args: ['dForce', 'DF', 18]
        });
        const DF = await deployments.get('DF');
        const df = await ethers.getContractAt('MockERC20', DF.address, deployer);
        await deploy('dDAI', {
            from: deployer,
            contract: 'MockDErc20',
            args: ['dForce DAI', 'dDAI', dai.address]
        });
        const dDai = await deployments.get('dDAI');
        await deploy('MockDRewards', {
            from: deployer,
            args: [dDai.address, DF.address, 100]
        });
        const mockDRewards = await deployments.get('MockDRewards');
        const router = await deployments.get('MockUniswapRouter');
        await deploy('StrategyDforce', {
            from: deployer,
            args: [
                dai.address,
                dDai.address,
                mockDRewards.address,
                DF.address,
                Converter.address,
                controller.address,
                vaultManager.address,
                weth.address,
                router.address
            ]
        });
        await df.mint(router.address, ethers.utils.parseEther('1000'));
        await df.mint(mockDRewards.address, ethers.utils.parseEther('1000'));
    }
    const Strategy = await deployments.get('StrategyDforce');
    const converter = await ethers.getContractAt(
        'StableSwap3PoolConverter',
        Converter.address,
        deployer
    );
    await converter.setStrategy(Strategy.address, true);
};
