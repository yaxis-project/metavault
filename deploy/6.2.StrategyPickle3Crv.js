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

    if (chainId == '1') {
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
        const Strategy = await deployments.get('StrategyPickle3Crv');
        const strategy = await ethers.getContractAt(
            'StrategyPickle3Crv',
            Strategy.address,
            deployer
        );
        await strategy.setStableForLiquidity(DAI);
    } else {
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const weth = await deployments.get('WETH');
        const t3crv = await deployments.get('T3CRV');
        await deploy('PICKLE', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Pickle', 'PICKLE', 18]
        });
        const PICKLE = await deployments.get('PICKLE');
        const pickle = await ethers.getContractAt('MockERC20', PICKLE.address, deployer);
        await deploy('MockPickleJar', {
            from: deployer,
            args: [t3crv.address]
        });
        const mockPickleJar = await deployments.get('MockPickleJar');
        await deploy('MockPickleMasterChef', {
            from: deployer,
            args: [PICKLE.address, mockPickleJar.address]
        });
        const pchef = await deployments.get('MockPickleMasterChef');
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        const mockUnirouter = await deployments.get('MockUniswapRouter');
        await deploy('StrategyPickle3Crv', {
            from: deployer,
            args: [
                t3crv.address,
                mockPickleJar.address,
                PICKLE.address,
                weth.address,
                t3crv.address,
                dai.address,
                usdc.address,
                usdt.address,
                mockStableSwap3Pool.address,
                controller.address,
                manager.address,
                mockUnirouter.address
            ]
        });
        const Strategy = await deployments.get('StrategyPickle3Crv');
        const strategy = await ethers.getContractAt(
            'StrategyPickle3Crv',
            Strategy.address,
            deployer
        );
        await strategy.setPickleMasterChef(pchef.address);
        await strategy.setStableForLiquidity(dai.address);
        await pickle.mint(pchef.address, ethers.utils.parseEther('1000'));
    }
};
