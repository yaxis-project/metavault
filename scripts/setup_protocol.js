const { MAX } = require('../test/helpers/common');
const { ether } = require('@openzeppelin/test-helpers');
const hardhat = require('hardhat');
const { deployments, getChainId, getNamedAccounts, web3 } = hardhat;

(async () => {
    const {
        CRV,
        DAI,
        PICKLE,
        T3CRV,
        USDC,
        USDT,
        WETH,
        deployer,
        multisig,
        stakingPool,
        timelock,
        vault3crv
    } = await getNamedAccounts();
    let vault;
    const chainId = await getChainId();
    switch (chainId) {
        case '1':
            vault = vault3crv;
            break;
        case '42':
            vault = await deployments.get('yAxisMetaVault');
            vault = vault.address;
            break;
    }
    const Manager = await deployments.get('yAxisMetaVaultManager');
    const manager = new web3.eth.Contract(Manager.abi, Manager.address);
    const Controller = await deployments.get('StrategyControllerV2');
    const controller = new web3.eth.Contract(Controller.abi, Controller.address);
    const StrategyPickle = await deployments.get('StrategyPickle3Crv');
    const strategyPickle = new web3.eth.Contract(StrategyPickle.abi, StrategyPickle.address);
    const StrategyCurve = await deployments.get('StrategyCurve3Crv');
    const strategyCurve = new web3.eth.Contract(StrategyCurve.abi, StrategyCurve.address);
    const Harvester = await deployments.get('yAxisMetaVaultHarvester');
    const harvester = new web3.eth.Contract(Harvester.abi, Harvester.address);
    const Converter = await deployments.get('StableSwap3PoolConverter');

    // setup the vault manager
    await manager.methods.setVaultStatus(vault, true).send({ from: deployer });
    await manager.methods
        .setControllerStatus(Controller.address, true)
        .send({ from: deployer });
    await manager.methods.setTreasury(multisig).send({ from: deployer });
    await manager.methods.setStakingPool(stakingPool).send({ from: deployer });
    await manager.methods.setHarvester(Harvester.address).send({ from: deployer });

    // setup the strategies
    await strategyPickle.methods.setStableForLiquidity(DAI).send({ from: deployer });
    if (chainId != '1') {
        const Unirouter = await deployments.get('MockUniswapRouter');
        const PickleMasterChef = await deployments.get('MockPickleMasterChef');
        // These can only be set once for the same address
        try {
            await strategyCurve.methods
                .setUnirouter(Unirouter.address)
                .send({ from: deployer });
            await strategyCurve.methods
                .approveForSpender(CRV, Unirouter.address, MAX)
                .send({ from: deployer });
            await strategyCurve.methods
                .approveForSpender(WETH, Unirouter.address, MAX)
                .send({ from: deployer });
            await strategyPickle.methods
                .setUnirouter(Unirouter.address)
                .send({ from: deployer });
            await strategyPickle.methods
                .approveForSpender(PICKLE, Unirouter.address, MAX)
                .send({ from: deployer });
            await strategyPickle.methods
                .approveForSpender(WETH, Unirouter.address, MAX)
                .send({ from: deployer });
            await strategyPickle.methods
                .setPickleMasterChef(PickleMasterChef.address)
                .send({ from: deployer });
        } catch (error) {} // eslint-disable-line no-empty
    }

    // setup the harvester
    await harvester.methods.setVaultManager(Manager.address).send({ from: deployer });
    await harvester.methods.setController(Controller.address).send({ from: deployer });
    await harvester.methods.setHarvester(deployer, true).send({ from: deployer });
    await harvester.methods
        .addStrategy(T3CRV, StrategyCurve.address, 86400)
        .send({ from: deployer });
    await harvester.methods
        .addStrategy(T3CRV, StrategyPickle.address, 43200)
        .send({ from: deployer });

    // setup the new controller
    await controller.methods
        .setConverter(T3CRV, DAI, Converter.address)
        .send({ from: deployer });
    await controller.methods
        .setConverter(T3CRV, USDC, Converter.address)
        .send({ from: deployer });
    await controller.methods
        .setConverter(T3CRV, USDT, Converter.address)
        .send({ from: deployer });
    try {
        await controller.methods.setVault(T3CRV, vault).send({ from: deployer });
    } catch (error) {} // eslint-disable-line no-empty
    const strategies = await controller.methods.strategies(T3CRV).call();
    // Don't add unless this is a fresh setup
    if (strategies.length == 0) {
        await controller.methods
            .addStrategy(T3CRV, StrategyCurve.address, 0)
            .send({ from: deployer });
        await controller.methods
            .addStrategy(T3CRV, StrategyPickle.address, ether('1000000'))
            .send({ from: deployer });
    }

    // pass governance and strategist over
    await manager.methods.setStrategist(multisig).send({ from: deployer });
    await manager.methods.setGovernance(timelock).send({ from: deployer });
})();
