const { INIT_BALANCE, MAX } = require('../test/helpers/common');
const { constants, ether } = require('@openzeppelin/test-helpers');
const { getChainId, getNamedAccounts } = require('hardhat');
const MockCurveGauge = artifacts.require('MockCurveGauge');
const MockCurveMinter = artifacts.require('MockCurveMinter');
const MockERC20 = artifacts.require('MockERC20');
const MockPickleJar = artifacts.require('MockPickleJar');
const MockPickleMasterChef = artifacts.require('MockPickleMasterChef');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');
const MockUniswapRouter = artifacts.require('MockUniswapRouter');
const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');
const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const StrategyCurve3Crv = artifacts.require('StrategyCurve3Crv');
const StrategyDforce = artifacts.require('StrategyDforce');
const StrategyPickle3Crv = artifacts.require('StrategyPickle3Crv');
const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const yAxisMetaVaultHarvester = artifacts.require('yAxisMetaVaultHarvester');

const deployKovan = async (accounts) => {
    await deployMocks(accounts);

    this.vault = await yAxisMetaVault.new(
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        accounts.T3CRV,
        accounts.YAX
    );
    this.manager = await yAxisMetaVaultManager.new(accounts.YAX);
    this.controller = await StrategyControllerV2.new(this.manager.address);
    this.harvester = await yAxisMetaVaultHarvester.new(
        this.manager.address,
        this.controller.address
    );
    this.converter = await StableSwap3PoolConverter.new(
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        accounts.T3CRV,
        this.stableSwap3Pool,
        this.manager.address
    );
    this.strategyCrv = await StrategyCurve3Crv.new(
        accounts.T3CRV,
        accounts.CRV,
        accounts.WETH,
        accounts.T3CRV,
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        this.gauge,
        this.minter,
        this.stableSwap3Pool,
        this.controller.address,
        this.manager.address
    );
    this.strategyPickle = await StrategyPickle3Crv.new(
        accounts.T3CRV,
        this.pjar,
        accounts.PICKLE,
        accounts.WETH,
        accounts.T3CRV,
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        this.stableSwap3Pool,
        this.controller.address,
        this.manager.address
    );
    this.strategyDforce = await StrategyDforce.new(
        accounts.DAI.address,
        this.dDAI.address,
        this.dRewardsDAI.address,
        accounts.DF.address,
        this.converter.address,
        this.controller.address,
        this.manager.address,
        accounts.WETH.address
    );

    await this.manager.setVaultStatus(this.vault.address, true);
    await setupContracts(accounts);
    await setupMocks(accounts);
    await this.vault.setController(this.controller.address);
};

const deployMainnet = async (accounts) => {
    this.manager = await yAxisMetaVaultManager.new(accounts.YAX);
    this.controller = await StrategyControllerV2.new(this.manager.address);
    this.harvester = await yAxisMetaVaultHarvester.new(
        this.manager.address,
        this.controller.address
    );
    this.converter = await StableSwap3PoolConverter.new(
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        accounts.T3CRV,
        accounts.stableSwap3Pool,
        this.manager.address
    );
    this.strategyCrv = await StrategyCurve3Crv.new(
        accounts.T3CRV,
        accounts.CRV,
        accounts.WETH,
        accounts.T3CRV,
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        accounts.gauge,
        accounts.minter,
        accounts.stableSwap3Pool,
        this.controller.address,
        this.manager.address
    );
    this.strategyPickle = await StrategyPickle3Crv.new(
        accounts.T3CRV,
        accounts.pjar,
        accounts.PICKLE,
        accounts.WETH,
        accounts.T3CRV,
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        accounts.stableSwap3Pool,
        this.controller.address,
        this.manager.address
    );

    await this.manager.setVaultStatus(accounts.vault3crv, true);
    await setupContracts(accounts);
};

const deployMocks = async (accounts) => {
    this.stableSwap3Pool = await MockStableSwap3Pool.new(
        accounts.DAI,
        accounts.USDC,
        accounts.USDT,
        accounts.T3CRV
    );
    this.unirouter = await MockUniswapRouter.new(constants.ZERO_ADDRESS);
    this.gauge = await MockCurveGauge.new(accounts.T3CRV);
    this.minter = await MockCurveMinter.new(accounts.CRV);
    this.pjar = await MockPickleJar.new(accounts.T3CRV);
    this.pchef = await MockPickleMasterChef.new(accounts.PICKLE, this.pjar.address);
};

const setupContracts = async (accounts) => {
    await this.manager.setControllerStatus(this.controller.address, true);
    await this.manager.setTreasury(accounts.multisig);
    await this.manager.setStakingPool(accounts.stakingPool);
    await this.manager.setHarvester(this.harvester.address);
    await this.strategyPickle.setStableForLiquidity(accounts.DAI);
    await this.harvester.setVaultManager(this.manager.address);
    await this.harvester.setController(this.controller.address);
    await this.harvester.setHarvester(accounts.deployer, true);
    await this.harvester.addStrategy(accounts.T3CRV, this.strategyCrv.address, 86400);
    await this.harvester.addStrategy(accounts.T3CRV, this.strategyPickle.address, 43200);
    await this.controller.setConverter(accounts.T3CRV, accounts.DAI, this.converter.address);
    await this.controller.setConverter(accounts.T3CRV, accounts.USDT, this.converter.address);
    await this.controller.setConverter(accounts.T3CRV, accounts.USDC, this.converter.address);
    await this.controller.setVault(accounts.T3CRV, accounts.vault3crv);
    await this.controller.addStrategy(accounts.T3CRV, this.strategyCrv.address, 0);
    await this.controller.addStrategy(
        accounts.T3CRV,
        this.strategyPickle.address,
        ether('1000000')
    );
    await this.manager.setStrategist(accounts.multisig);
    await this.manager.setGovernance(accounts.timelock);
};

const setupMocks = async (accounts) => {
    this.yax = await MockERC20.at(accounts.YAX);
    this.dai = await MockERC20.at(accounts.DAI);
    this.usdc = await MockERC20.at(accounts.USDC);
    this.usdt = await MockERC20.at(accounts.USDT);
    this.weth = await MockERC20.at(accounts.WETH);
    this.crv = await MockERC20.at(accounts.CRV);
    this.pickle = await MockERC20.at(accounts.PICKLE);
    await this.yax.mint(this.vault.address, INIT_BALANCE);
    await this.dai.mint(this.stableSwap3Pool.address, INIT_BALANCE);
    await this.usdc.mint(this.stableSwap3Pool.address, '1000000000');
    await this.usdt.mint(this.stableSwap3Pool.address, '1000000000');
    await this.t3crv.mint(this.stableSwap3Pool.address, INIT_BALANCE);
    await this.yax.mint(this.unirouter.address, INIT_BALANCE);
    await this.weth.mint(this.unirouter.address, INIT_BALANCE);
    await this.dai.mint(this.unirouter.address, INIT_BALANCE);
    await this.usdc.mint(this.unirouter.address, INIT_BALANCE);
    await this.usdt.mint(this.unirouter.address, INIT_BALANCE);
    await this.crv.mint(this.minter.address, INIT_BALANCE);
    await this.strategyCrv.approveForSpender(accounts.CRV, this.unirouter.address, MAX);
    await this.strategyPickle.setStableForLiquidity(accounts.DAI);
    await this.strategyPickle.approveForSpender(accounts.PICKLE, this.unirouter.address, MAX);
    await this.pickle.mint(this.pchef.address, INIT_BALANCE);
};

(async () => {
    const accounts = await getNamedAccounts();
    const chainId = await getChainId();
    try {
        switch (chainId) {
            case '1':
                await deployMainnet(accounts);
                break;
            case '42':
                await deployKovan(accounts);
                break;
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
