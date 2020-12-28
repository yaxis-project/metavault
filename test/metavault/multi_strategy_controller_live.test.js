const {
    constants,
    ether,
    expectEvent,
    expectRevert,
    send
} = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');

const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

const StrategyControllerV1 = artifacts.require('StrategyControllerV1');
const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const StrategyCurve3Crv = artifacts.require('StrategyCurve3Crv');
const StrategyPickle3Crv = artifacts.require('StrategyPickle3Crv');

const MockPickleJar = artifacts.require('MockPickleJar');
const MockPickleMasterChef = artifacts.require('MockPickleMasterChef');
const MockCurveGauge = artifacts.require('MockCurveGauge');
const MockCurveMinter = artifacts.require('MockCurveMinter');

const MockERC20 = artifacts.require('MockERC20');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');
const MockUniswapRouter = artifacts.require('MockUniswapRouter');

const verbose = process.env.VERBOSE;

function fromWeiWithDecimals(num, decimals = 18) {
    num = Number.parseFloat(String(num));
    for (let i = 0; i < decimals; i++) num = num * 0.1;
    return num.toFixed(2);
}

const treasuryWallet = '0x362Db1c17db4C79B51Fe6aD2d73165b1fe9BaB4a';
const deployer = '0x5661bF295f48F499A70857E8A6450066a8D16400';
const multisig = '0xC1d40e197563dF727a4d3134E8BD1DeF4B498C6f';
const timelock = '0x66C5c16d13a38461648c1D097f219762D374B412';
const bob = '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE';

contract('multi_strategy_controller_live.test', async (accounts) => {
    const {toWei} = web3.utils;
    const {fromWei} = web3.utils;

    accounts[0] = deployer;
    accounts[1] = multisig;
    accounts[2] = timelock;
    accounts[3] = bob;

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = toWei('1000');

    let YAX, DAI, USDC, USDT, WETH, T3CRV, CRV; // addresses
    let yax, dai, usdc, usdt, weth, t3crv, crv; // MockERC20s

    let mvault;
    let MVAULT;

    let vmanager;
    let VMANAGER;

    let stableSwap3Pool;
    let STABLESWAP3POOL;

    let converter;
    let CONVERTER;

    let gauge;
    let GAUGE;

    let minter;
    let MINTER;

    let pjar;
    let PJAR;

    let pchef;
    let PCHEF;

    let mcontroller;
    let MCONTROLLER;

    let oldController;
    let OLDCONTROLLER;

    let mstrategyCrv;
    let MSTRATEGYCRV;

    let mstrategyPickle;
    let MSTRATEGYPICKLE;

    let unirouter;
    let UNIROUTER;

    before(async () => {
        await send.ether(bob, deployer, ether('100'));
        await send.ether(bob, multisig, ether('100'));
        await send.ether(bob, timelock, ether('100'));
        YAX = '0xb1dC9124c395c1e97773ab855d66E879f053A289';
        DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
        USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        T3CRV = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
        CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52';
        PICKLE = '0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5';

        MVAULT = '0xBFbEC72F2450eF9Ab742e4A27441Fa06Ca79eA6a';
        VMANAGER = '0x9cD645330E64b07810Dde54dEe1240060071f6aa';
        STRATEGISTS = '0x738080868c83D65582d51bA63CC9f23064F92E41';
        STABLESWAP3POOL = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
        OLDCONTROLLER = '0x2ebE1461D2Fc6dabF079882CFc51e5013BbA49B6';
        CONVERTER = '0xA5c16eb6eBD72BC72c70Fca3e4faCf389AD4aBE7';
        GAUGE = '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A';
        MINTER = '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0';
        PJAR = '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33';
        PCHEF = '0xbD17B1ce622d73bD438b9E658acA5996dc394b0d';
        UNIROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

        yax = await MockERC20.at(YAX);
        dai = await MockERC20.at(DAI);
        usdc = await MockERC20.at(USDC);
        usdt = await MockERC20.at(USDT);
        weth = await MockERC20.at(WETH);
        t3crv = await MockERC20.at(T3CRV);
        crv = await MockERC20.at(CRV);
        pickle = await MockERC20.at(PICKLE);

        mvault = await yAxisMetaVault.at(MVAULT);
        oldController = await StrategyControllerV1.at(OLDCONTROLLER);
        vmanager = await yAxisMetaVaultManager.at(YAX);
        stableSwap3Pool = await MockStableSwap3Pool.at(STABLESWAP3POOL);
        converter = await StableSwap3PoolConverter.at(CONVERTER);
        gauge = await MockCurveGauge.at(GAUGE);
        minter = await MockCurveMinter.at(MINTER);
        pjar = await MockPickleJar.at(PJAR);
        pchef = await MockPickleMasterChef.at(PCHEF);

        mcontroller = await StrategyControllerV2.new({from: deployer});
        MCONTROLLER = mcontroller.address;


        mstrategyCrv = await StrategyCurve3Crv.new(
            T3CRV,
            CRV,
            WETH,
            T3CRV,
            DAI,
            USDC,
            USDT,
            GAUGE,
            MINTER,
            STABLESWAP3POOL,
            MCONTROLLER,
            VMANAGER,
            {from: deployer}
        );
        MSTRATEGYCRV = mstrategyCrv.address;

        mstrategyPickle = await StrategyPickle3Crv.new(
            T3CRV,
            PJAR,
            PICKLE,
            WETH,
            T3CRV,
            DAI,
            USDC,
            USDT,
            STABLESWAP3POOL,
            MCONTROLLER,
            VMANAGER,
            {from: deployer}
        );
        MSTRATEGYPICKLE = mstrategyPickle.address;


        await dai.approve(MVAULT, MAX, {from: bob});
        await usdc.approve(MVAULT, MAX, {from: bob});
        await usdt.approve(MVAULT, MAX, {from: bob});
        await t3crv.approve(MVAULT, MAX, {from: bob});
        await mvault.approve(MVAULT, MAX, {from: bob});
    });

    async function printBalances(title) {
        console.log(title);
        console.log('mvault T3CRV:       ', fromWei(await t3crv.balanceOf(MVAULT)));
        console.log('mvault MVLT:        ', fromWei(await mvault.balanceOf(MVAULT)));
        console.log('mvault Supply:      ', fromWei(await mvault.totalSupply()));
        console.log('--------------------');
        console.log('mcontroller T3CRV:  ', fromWei(await t3crv.balanceOf(MCONTROLLER)));
        console.log('oldController T3CRV:', fromWei(await t3crv.balanceOf(OLDCONTROLLER)));
        console.log('mstrategy T3CRV:    ', fromWei(await mstrategyCrv.balanceOf()));
        console.log('mstrategy PICKLE:   ', fromWei(await mstrategyPickle.balanceOf()));
        console.log('pjar T3CRV:         ', fromWei(await t3crv.balanceOf(PJAR)));
        console.log('pchef PJAR:         ', fromWei(await pjar.balanceOf(PCHEF)));
        console.log('--------------------');
        console.log(
            'bob balances:        %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX',
            fromWei(await dai.balanceOf(bob)),
            fromWeiWithDecimals(await usdc.balanceOf(bob), 6),
            fromWeiWithDecimals(await usdt.balanceOf(bob), 6),
            fromWei(await t3crv.balanceOf(bob)),
            fromWei(await yax.balanceOf(bob))
        );
        console.log('bob MVLT:           ', fromWei(await mvault.balanceOf(bob)));
        console.log('--------------------');
    }

    beforeEach(async () => {
        if (verbose) {
            await printBalances('\n====== BEFORE ======');
        }
    });

    afterEach(async () => {
        if (verbose) {
            await printBalances('\n====== AFTER ======');
        }
    });

    it('should prepare the old controller and vault', async () => {
        await oldController.setInvestEnabled(false, {from: multisig});
        await oldController.withdrawAll(
            '0xd721d16a685f63A4e8C4e8c5988b76Bec6A85c90',
            {from: multisig}
        );
    });

    it('should setup the new strategies', async () => {
        await mstrategyPickle.setStableForLiquidity(DAI, {from: deployer});
        await mstrategyCrv.setGovernance(multisig, {from: deployer});
        await mstrategyPickle.setGovernance(multisig, {from: deployer});
    });

    it('should setup the new controller', async () => {
        await mcontroller.setVault(T3CRV, MVAULT, {from: deployer});
        await mcontroller.addStrategy(T3CRV, MSTRATEGYCRV, 0, {from: deployer});
        await mcontroller.addStrategy(
            T3CRV,
            MSTRATEGYPICKLE,
            ether('2000000'),
            {from: deployer}
        );
        await mcontroller.setHarvester(STRATEGISTS, {from: deployer});
        await mcontroller.setStrategist(multisig, {from: deployer});
        await mcontroller.setGovernance(timelock, {from: deployer});
    });

    it('should set the new controller on the vault', async () => {
        await mvault.setController(MCONTROLLER, {from: timelock});
    });

    it('should call earn to transfer funds to Curve strategy', async () => {
        await mvault.earn({from: deployer});
    });

    it('should send new deposits go to the Pickle strategy', async () => {
        await mvault.deposit(ether('100'), DAI, 1, true, {from: bob});
    });
});
