const { constants, ether } = require('@openzeppelin/test-helpers');
const { INIT_BALANCE, MAX, fromWei, fromWeiWithDecimals } = require('./common');
const MockERC20 = artifacts.require('MockERC20');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');
const MockUniswapRouter = artifacts.require('MockUniswapRouter');
const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');
const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const yAxisMetaVaultHarvester = artifacts.require('yAxisMetaVaultHarvester');

exports.afterStrategySetup = async () => {
    await setupProtocol();
    await fundContracts();
    await setupUser();
};

exports.beforeStrategySetup = async (accounts) => {
    await setupAccounts(accounts);
    await deployTokenContracts();
    await deployProtocolContracts();
};

const deployProtocolContracts = async () => {
    globalThis.vaultManager = await yAxisMetaVaultManager.new(globalThis.yax.address);
    globalThis.vault = await yAxisMetaVault.new(
        globalThis.dai.address,
        globalThis.usdc.address,
        globalThis.usdt.address,
        globalThis.t3crv.address,
        globalThis.yax.address,
        ether('1'),
        1
    );
    globalThis.controller = await StrategyControllerV2.new(globalThis.vaultManager.address);
    globalThis.harvester = await yAxisMetaVaultHarvester.new(
        globalThis.vaultManager.address,
        globalThis.controller.address
    );
    globalThis.stableSwap3Pool = await MockStableSwap3Pool.new(
        globalThis.dai.address,
        globalThis.usdc.address,
        globalThis.usdt.address,
        globalThis.t3crv.address
    );
    globalThis.converter = await StableSwap3PoolConverter.new(
        globalThis.dai.address,
        globalThis.usdc.address,
        globalThis.usdt.address,
        globalThis.t3crv.address,
        globalThis.stableSwap3Pool.address,
        globalThis.vaultManager.address
    );
    globalThis.router = await MockUniswapRouter.new(constants.ZERO_ADDRESS);
};

exports.deployProtocolContracts = deployProtocolContracts;

const deployTokenContracts = async () => {
    globalThis.yax = await MockERC20.new('yAxis', 'YAX', 18);
    globalThis.dai = await MockERC20.new('Dai Stablecoin', 'DAI', 18);
    globalThis.usdc = await MockERC20.new('USD Coin', 'USDC', 6);
    globalThis.usdt = await MockERC20.new('Tether', 'USDT', 6);
    globalThis.weth = await MockERC20.new('Wrapped ETH', 'WETH', 18);
    globalThis.t3crv = await MockERC20.new('Curve.fi DAI/USDC/USDT', '3Crv', 18);
};

exports.deployTokenContracts = deployTokenContracts;

const fundContracts = async () => {
    await globalThis.yax.mint(globalThis.vault.address, INIT_BALANCE);
    await globalThis.dai.mint(globalThis.stableSwap3Pool.address, INIT_BALANCE);
    await globalThis.usdc.mint(globalThis.stableSwap3Pool.address, '1000000000');
    await globalThis.usdt.mint(globalThis.stableSwap3Pool.address, '1000000000');
    await globalThis.t3crv.mint(globalThis.stableSwap3Pool.address, INIT_BALANCE);
    await globalThis.yax.mint(globalThis.router.address, INIT_BALANCE);
    await globalThis.weth.mint(globalThis.router.address, INIT_BALANCE);
    await globalThis.dai.mint(globalThis.router.address, INIT_BALANCE);
    await globalThis.usdc.mint(globalThis.router.address, INIT_BALANCE);
    await globalThis.usdt.mint(globalThis.router.address, INIT_BALANCE);
};

exports.fundContracts = fundContracts;

exports.printBalances = async (title) => {
    console.log(title);
    console.log(
        'vault 3CRV:     ',
        fromWei(await globalThis.t3crv.balanceOf(globalThis.vault.address))
    );
    console.log(
        'vault MVLT:     ',
        fromWei(await globalThis.vault.balanceOf(globalThis.vault.address))
    );
    console.log('vault Supply:   ', fromWei(await globalThis.vault.totalSupply()));
    console.log('-------------------');
    console.log(
        'user balances:   %s DAI/ %s USDC/ %s USDT/ %s 3CRV/ %s YAX',
        fromWei(await globalThis.dai.balanceOf(globalThis.user)),
        fromWeiWithDecimals(await globalThis.usdc.balanceOf(globalThis.user), 6),
        fromWeiWithDecimals(await globalThis.usdt.balanceOf(globalThis.user), 6),
        fromWei(await globalThis.t3crv.balanceOf(globalThis.user)),
        fromWei(await globalThis.yax.balanceOf(globalThis.user))
    );
    console.log(
        'user staked:    ',
        fromWei((await globalThis.vault.userInfo(globalThis.user)).amount)
    );
    console.log('-------------------');
    console.log(
        'stakingPool YAX:',
        fromWei(await globalThis.yax.balanceOf(globalThis.stakingPool))
    );
    console.log(
        'treasury YAX:   ',
        fromWei(await globalThis.yax.balanceOf(globalThis.treasury))
    );
    console.log('-------------------');
};

const setupAccounts = (accounts) => {
    globalThis.deployer = accounts[0];
    globalThis.treasury = accounts[1];
    globalThis.stakingPool = accounts[2];
    globalThis.user = accounts[3];
};

exports.setupAccounts = setupAccounts;

const setupProtocol = async () => {
    await globalThis.vault.setConverter(globalThis.converter.address);
    await globalThis.vault.setVaultManager(globalThis.vaultManager.address);
    await globalThis.vault.setTreasuryWallet(globalThis.treasury);
    await globalThis.vault.setController(globalThis.controller.address);
    await globalThis.vaultManager.setVaultStatus(globalThis.vault.address, true);
    await globalThis.vaultManager.setControllerStatus(globalThis.controller.address, true);
    await globalThis.vaultManager.setTreasury(globalThis.treasury);
    await globalThis.vaultManager.setStakingPool(globalThis.stakingPool);
    await globalThis.vaultManager.setHarvester(globalThis.harvester.address);
    await globalThis.harvester.setController(globalThis.controller.address);
    await globalThis.harvester.addStrategy(
        globalThis.t3crv.address,
        globalThis.strategy.address,
        0
    );
    await globalThis.harvester.setHarvester(globalThis.deployer, true);
    await globalThis.controller.setVault(globalThis.t3crv.address, globalThis.vault.address);
    await globalThis.controller.setConverter(
        globalThis.t3crv.address,
        globalThis.dai.address,
        globalThis.converter.address
    );
    await globalThis.controller.addStrategy(
        globalThis.t3crv.address,
        globalThis.strategy.address,
        0
    );
    await globalThis.converter.setStrategy(globalThis.strategy.address, true);
    await globalThis.strategy.setRouter(globalThis.router.address);
};

exports.setupProtocol = setupProtocol;

const setupUser = async () => {
    await globalThis.dai.mint(globalThis.user, INIT_BALANCE);
    await globalThis.usdc.mint(globalThis.user, '1000000000');
    await globalThis.usdt.mint(globalThis.user, '1000000000');
    await globalThis.t3crv.mint(globalThis.user, INIT_BALANCE);
    await globalThis.dai.approve(globalThis.vault.address, MAX, { from: globalThis.user });
    await globalThis.usdc.approve(globalThis.vault.address, MAX, { from: globalThis.user });
    await globalThis.usdt.approve(globalThis.vault.address, MAX, { from: globalThis.user });
    await globalThis.t3crv.approve(globalThis.vault.address, MAX, { from: globalThis.user });
    await globalThis.vault.approve(globalThis.vault.address, MAX, { from: globalThis.user });
};

exports.setupUser = setupUser;
