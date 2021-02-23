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
            { from: deployer, log: true },
            'setStakingPool',
            stakingPool
        );
    }
    if (!(await vaultManager.vaults(vault3crv))) {
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer, log: true },
            'setVaultStatus',
            vault3crv,
            true
        );
    }
    if (!(await vaultManager.controllers(Controller.address))) {
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer, log: true },
            'setControllerStatus',
            Controller.address,
            true
        );
    }
    if ((await vaultManager.harvester()) != Harvester.address) {
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer, log: true },
            'setHarvester',
            Harvester.address
        );
    }
    if ((await vaultManager.treasury()) != treasury) {
        await execute(
            'yAxisMetaVaultManager',
            { from: deployer, log: true },
            'setTreasury',
            treasury
        );
    }

    if (!(await harvester.isHarvester(deployer))) {
        await execute(
            'yAxisMetaVaultHarvester',
            { from: deployer, log: true },
            'setHarvester',
            deployer,
            true
        );
    }
    if ((await harvester.vaultManager()) != VaultManager.address) {
        await execute(
            'yAxisMetaVaultHarvester',
            { from: deployer, log: true },
            'setVaultManager',
            VaultManager.address
        );
    }
    if ((await harvester.controller()) != Controller.address) {
        await execute(
            'yAxisMetaVaultHarvester',
            { from: deployer, log: true },
            'setController',
            Controller.address
        );
    }

    if ((await controller.vaults(T3CRV)) != vault3crv) {
        await execute(
            'StrategyControllerV2',
            { from: deployer, log: true },
            'setConverter',
            T3CRV,
            DAI,
            Converter.address
        );
        await execute(
            'StrategyControllerV2',
            { from: deployer, log: true },
            'setConverter',
            T3CRV,
            USDC,
            Converter.address
        );
        await execute(
            'StrategyControllerV2',
            { from: deployer, log: true },
            'setConverter',
            T3CRV,
            USDT,
            Converter.address
        );
        await execute(
            'StrategyControllerV2',
            { from: deployer, log: true },
            'setVault',
            T3CRV,
            vault3crv
        );

        // mainnet
        if (chainId == '1' && (await controller.strategies(T3CRV)).length < 1) {
            await execute(
                'StrategyControllerV2',
                { from: deployer, log: true },
                'addStrategy',
                T3CRV,
                StrategyCurve3Crv.address,
                0,
                ethers.constants.AddressZero,
                true,
                86400
            );
        }
    }
};

module.exports.tags = ['metavault', 'live'];
