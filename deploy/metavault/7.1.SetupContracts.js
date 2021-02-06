module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { execute } = deployments;
    const { ethers } = require('hardhat');
    let {
        DAI,
        USDC,
        USDT,
        T3CRV,
        deployer,
        stakingPool,
        treasury,
        vault3crv
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const VaultManager = await deployments.get('yAxisMetaVaultManager');
    const Harvester = await deployments.get('yAxisMetaVaultHarvester');
    const Controller = await deployments.get('StrategyControllerV2');
    const Converter = await deployments.get('StableSwap3PoolConverter');
    const vaultManager = await ethers.getContractAt(
        'yAxisMetaVaultManager',
        VaultManager.address,
        deployer
    );
    const harvester = await ethers.getContractAt(
        'yAxisMetaVaultHarvester',
        Harvester.address,
        deployer
    );
    const controller = await ethers.getContractAt(
        'StrategyControllerV2',
        Controller.address,
        deployer
    );
    const StrategyCurve3Crv = await deployments.get('StrategyCurve3Crv');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const Vault = await deployments.get('yAxisMetaVault');
        vault3crv = Vault.address;
        const vault = await ethers.getContractAt('yAxisMetaVault', Vault.address, deployer);

        if ((await vault.controller()) != controller.address) {
            await execute('yAxisMetaVault', { from: deployer }, 'setEarnLowerlimit', 0);
            await execute('yAxisMetaVault', { from: deployer }, 'setTotalDepositCap', 0);
            await execute(
                'yAxisMetaVault',
                { from: deployer },
                'setVaultManager',
                VaultManager.address
            );
            await execute(
                'yAxisMetaVault',
                { from: deployer },
                'setConverter',
                Converter.address
            );
            await execute(
                'yAxisMetaVault',
                { from: deployer },
                'setController',
                Controller.address
            );
        }
    }

    if ((await vaultManager.stakingPool()) != stakingPool) {
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer },
            'setVaultStatus',
            vault3crv,
            true
        );
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer },
            'setControllerStatus',
            Controller.address,
            true
        );
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer },
            'setHarvester',
            Harvester.address
        );
        await execute('yAxisMetaVaultManager', { from: deployer }, 'setTreasury', treasury);
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer },
            'setStakingPool',
            stakingPool
        );
    }

    if (!(await harvester.isHarvester(deployer))) {
        await execute(
            'yAxisMetaVaultHarvester',
            { from: deployer },
            'setVaultManager',
            VaultManager.address
        );
        await execute(
            'yAxisMetaVaultHarvester',
            { from: deployer },
            'setController',
            Controller.address
        );
        await execute(
            'yAxisMetaVaultHarvester',
            { from: deployer },
            'setHarvester',
            deployer,
            true
        );
    }

    if ((await controller.vaults(T3CRV)) != vault3crv) {
        await execute(
            'StrategyControllerV2',
            { from: deployer },
            'setConverter',
            T3CRV,
            DAI,
            Converter.address
        );
        await execute(
            'StrategyControllerV2',
            { from: deployer },
            'setConverter',
            T3CRV,
            USDC,
            Converter.address
        );
        await execute(
            'StrategyControllerV2',
            { from: deployer },
            'setConverter',
            T3CRV,
            USDT,
            Converter.address
        );
        await execute(
            'StrategyControllerV2',
            { from: deployer },
            'setVault',
            T3CRV,
            vault3crv
        );

        // mainnet
        if (chainId == '1' && (await controller.strategies(T3CRV)).length < 1) {
            await execute(
                'StrategyControllerV2',
                { from: deployer },
                'addStrategy',
                T3CRV,
                StrategyCurve3Crv.address,
                0,
                true,
                86400
            );
        }
    }
};

module.exports.tags = ['metavault', 'live'];
