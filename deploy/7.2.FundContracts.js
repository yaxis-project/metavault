/* eslint-disable no-case-declarations */

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        const YAX = await deployments.get('YAX');
        const yax = await ethers.getContractAt('MockERC20', YAX.address, deployer);
        const WETH = await deployments.get('WETH');
        const weth = await ethers.getContractAt('MockERC20', WETH.address, deployer);
        const DAI = await deployments.get('DAI');
        const dai = await ethers.getContractAt('MockERC20', DAI.address, deployer);
        const USDC = await deployments.get('USDC');
        const usdc = await ethers.getContractAt('MockERC20', USDC.address, deployer);
        const USDT = await deployments.get('USDT');
        const usdt = await ethers.getContractAt('MockERC20', USDT.address, deployer);
        const T3CRV = await deployments.get('T3CRV');
        const t3crv = await ethers.getContractAt('MockERC20', T3CRV.address, deployer);
        const Vault = await deployments.get('yAxisMetaVault');
        const Unirouter = await deployments.get('MockUniswapRouter');
        const StableSwap3Pool = await deployments.get('MockStableSwap3Pool');

        await yax.mint(Vault.address, ethers.utils.parseEther('1000'), { from: deployer });
        await dai.mint(StableSwap3Pool.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
        await usdc.mint(StableSwap3Pool.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
        await usdt.mint(StableSwap3Pool.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
        await t3crv.mint(StableSwap3Pool.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
        await yax.mint(Unirouter.address, ethers.utils.parseEther('1000'), { from: deployer });
        await weth.mint(Unirouter.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
        await dai.mint(Unirouter.address, ethers.utils.parseEther('1000'), { from: deployer });
        await usdc.mint(Unirouter.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
        await usdt.mint(Unirouter.address, ethers.utils.parseEther('1000'), {
            from: deployer
        });
    }
};
