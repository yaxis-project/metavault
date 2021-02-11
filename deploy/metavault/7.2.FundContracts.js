module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        const Vault = await deployments.get('yAxisMetaVault');
        const Unirouter = await deployments.get('MockUniswapRouter');
        const StableSwap3Pool = await deployments.get('MockStableSwap3Pool');

        await execute(
            'YAX',
            { from: deployer },
            'mint',
            Vault.address,
            ethers.utils.parseEther('1000')
        );
        await execute(
            'YAX',
            { from: deployer },
            'mint',
            Unirouter.address,
            ethers.utils.parseEther('1000')
        );
        await execute(
            'WETH',
            { from: deployer },
            'mint',
            Unirouter.address,
            ethers.utils.parseEther('1000')
        );
        await execute(
            'DAI',
            { from: deployer },
            'mint',
            Unirouter.address,
            ethers.utils.parseEther('1000')
        );
        await execute(
            'USDC',
            { from: deployer },
            'mint',
            Unirouter.address,
            ethers.utils.parseEther('1000')
        );
        await execute(
            'USDT',
            { from: deployer },
            'mint',
            Unirouter.address,
            ethers.utils.parseEther('1000')
        );
        await execute(
            'DAI',
            { from: deployer },
            'mint',
            deployer,
            ethers.utils.parseEther('10000000000000')
        );
        await execute('USDC', { from: deployer }, 'mint', deployer, '10000000000000000000');
        await execute('USDT', { from: deployer }, 'mint', deployer, '10000000000000000000');
        await execute(
            'DAI',
            { from: deployer },
            'approve',
            StableSwap3Pool.address,
            ethers.constants.MaxUint256
        );
        await execute(
            'USDC',
            { from: deployer },
            'approve',
            StableSwap3Pool.address,
            ethers.constants.MaxUint256
        );
        await execute(
            'USDT',
            { from: deployer },
            'approve',
            StableSwap3Pool.address,
            ethers.constants.MaxUint256
        );
        await execute(
            'MockStableSwap3Pool',
            { from: deployer },
            'add_liquidity',
            [ethers.utils.parseEther('200000000'), '200000000000000', '200000000000000'],
            0
        );
    }
};

module.exports.tags = ['metavault'];
