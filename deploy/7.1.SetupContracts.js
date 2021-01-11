const hardhat = require('hardhat');
const { ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const {
        DAI,
        USDC,
        USDT,
        T3CRV,
        deployer,
        multisig,
        stakingPool,
        treasury,
        timelock,
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
    const StrategyPickle3Crv = await deployments.get('StrategyPickle3Crv');

    if (chainId == '1') {
        await vaultManager.setVaultStatus(vault3crv, true);
        await vaultManager.setControllerStatus(Controller.address, true);
        await vaultManager.setHarvester(Harvester.address);
        await vaultManager.setTreasury(treasury);
        await vaultManager.setStakingPool(stakingPool);

        await harvester.setVaultManager(VaultManager.address);
        await harvester.setController(Controller.address);
        await harvester.setHarvester(deployer, true);
        await harvester.addStrategy(T3CRV, StrategyCurve3Crv.address, 86400);
        await harvester.addStrategy(T3CRV, StrategyPickle3Crv.address, 43200);

        await controller.setConverter(T3CRV, DAI, Converter.address);
        await controller.setConverter(T3CRV, USDC, Converter.address);
        await controller.setConverter(T3CRV, USDT, Converter.address);
        await controller.setVault(T3CRV, vault3crv);
        await controller.addStrategy(T3CRV, StrategyCurve3Crv.address, 0);
        await controller.addStrategy(T3CRV, StrategyPickle3Crv.address, ether('1000000'));

        await vaultManager.setStrategist(multisig, { from: deployer });
        await vaultManager.setGovernance(timelock, { from: deployer });
    } else {
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const t3crv = await deployments.get('T3CRV');
        const Vault = await deployments.get('yAxisMetaVault');
        const vault = await ethers.getContractAt('yAxisMetaVault', Vault.address, deployer);

        await vaultManager.setVaultStatus(Vault.address, true);
        await vaultManager.setControllerStatus(Controller.address, true);
        await vaultManager.setHarvester(Harvester.address);
        await vaultManager.setTreasury(treasury);
        await vaultManager.setStakingPool(stakingPool);

        await harvester.setVaultManager(VaultManager.address);
        await harvester.setController(Controller.address);
        await harvester.setHarvester(deployer, true);

        await controller.setConverter(t3crv.address, dai.address, Converter.address);
        await controller.setConverter(t3crv.address, usdc.address, Converter.address);
        await controller.setConverter(t3crv.address, usdt.address, Converter.address);
        await controller.setVault(t3crv.address, Vault.address);

        await vault.setEarnLowerlimit(0);
        await vault.setTotalDepositCap(0);
        await vault.setVaultManager(VaultManager.address);
        await vault.setConverter(Converter.address);
        await vault.setController(Controller.address);
    }
};
