const {expectRevert, time} = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

const StrategyControllerV1 = artifacts.require('StrategyControllerV1');
const StrategyPickle3Crv = artifacts.require('StrategyPickle3Crv');

const MockPickleJar = artifacts.require('MockPickleJar');
const MockPickleMasterChef = artifacts.require('MockPickleMasterChef');
const MockERC20 = artifacts.require('MockERC20');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');
const MockUniswapRouter = artifacts.require('MockUniswapRouter');

const verbose = process.env.VERBOSE;

function fromWeiWithDecimals(num, decimals = 18) {
    num = Number.parseFloat(String(num));
    for (let i = 0; i < decimals; i++) num = num * 0.1;
    return num.toFixed(2);
}

async function advanceBlocks(blocks) {
    for (let i = 0; i < blocks; i++) {
        await time.advanceBlock();
    }
}

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const treasuryWallet = '0x362Db1c17db4C79B51Fe6aD2d73165b1fe9BaB4a';

contract('recuse_stuck_fund.test', async (accounts) => {
    const { toWei } = web3.utils;
    const { fromWei } = web3.utils;
    const alice = accounts[0];
    const bob = accounts[1];
    const stakingPool = accounts[2];

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = toWei('1000');

    let YAX; let DAI; let USDC; let USDT; let WETH; let T3CRV; let PICKLE; // addresses
    let yax; let dai; let usdc; let usdt; let weth; let t3crv; let pickle; // MockERC20s

    let mvault;
    let MVAULT;

    let vmanager;
    let VMANAGER;

    let stableSwap3Pool;
    let STABLESWAP3POOL;

    let converter;
    let CONVERTER;

    let pjar;
    let PJAR;

    let pchef;
    let PCHEF;

    let mcontroller;
    let MCONTROLLER;

    let mstrategy;
    let MSTRATEGY;

    let unirouter;
    let UNIROUTER;

    before(async () => {
        yax = await MockERC20.new('yAxis', 'YAX', 18);
        dai = await MockERC20.new('Dai Stablecoin', 'DAI', 18);
        usdc = await MockERC20.new('USD Coin', 'USDC', 6);
        usdt = await MockERC20.new('Tether', 'USDT', 6);
        weth = await MockERC20.new('Wrapped ETH', 'WETH', 18);
        t3crv = await MockERC20.new('Curve.fi DAI/USDC/USDT', '3Crv', 18);
        pickle = await MockERC20.new('Pickle', 'PICKLE', 18);

        YAX = yax.address;
        DAI = dai.address;
        USDC = usdc.address;
        USDT = usdt.address;
        WETH = weth.address;
        T3CRV = t3crv.address;
        PICKLE = pickle.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IERC20 _tokenYAX, uint _yaxPerBlock, uint _startBlock)
        const _yaxPerBlock = toWei('1');
        const _startBlock = 1;
        mvault = await yAxisMetaVault.new(DAI, USDC, USDT, T3CRV, YAX, _yaxPerBlock, _startBlock);
        MVAULT = mvault.address;

        // constructor (IERC20 _yax)
        vmanager = await yAxisMetaVaultManager.new(YAX);
        VMANAGER = vmanager.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV)
        stableSwap3Pool = await MockStableSwap3Pool.new(DAI, USDC, USDT, T3CRV);
        STABLESWAP3POOL = stableSwap3Pool.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IStableSwap3Pool _stableSwap3Pool, IVaultManager _vaultMaster)
        converter = await StableSwap3PoolConverter.new(DAI, USDC, USDT, T3CRV, STABLESWAP3POOL, VMANAGER);
        CONVERTER = converter.address;

        // constructor (IERC20 _t3crv)
        pjar = await MockPickleJar.new(T3CRV);
        PJAR = pjar.address;

        // constructor(IERC20 _pickleToken, IERC20 _lpToken)
        pchef = await MockPickleMasterChef.new(PICKLE, PJAR);
        PCHEF = pchef.address;

        await pickle.mint(PCHEF, INIT_BALANCE);

        mcontroller = await StrategyControllerV1.new();
        MCONTROLLER = mcontroller.address;

        // constructor(address _want, address _p3crv, address _pickle, address _weth, address _t3crv, address _dai, address _usdc, address _usdt, address _controller, IVaultManager _vaultManager)
        mstrategy = await StrategyPickle3Crv.new(T3CRV, PJAR, PICKLE, WETH, T3CRV, DAI, USDC, USDT, STABLESWAP3POOL, MCONTROLLER, VMANAGER);
        MSTRATEGY = mstrategy.address;

        unirouter = await MockUniswapRouter.new(ADDRESS_ZERO);
        UNIROUTER = unirouter.address;
        yax.mint(UNIROUTER, INIT_BALANCE);
        weth.mint(UNIROUTER, INIT_BALANCE);
        pickle.mint(UNIROUTER, INIT_BALANCE);
        dai.mint(UNIROUTER, INIT_BALANCE);

        await mvault.setConverter(CONVERTER);
        await mvault.setVaultManager(VMANAGER);
        await vmanager.setVaultStatus(MVAULT, true);
        await vmanager.setPerformanceReward(alice);
        await vmanager.setStakingPool(stakingPool);
        await vmanager.setWithdrawalProtectionFee(0);
        await mvault.setController(MCONTROLLER);
        await mcontroller.setVault(T3CRV, MVAULT);
        await mcontroller.approveStrategy(T3CRV, MSTRATEGY);
        await mcontroller.setStrategy(T3CRV, MSTRATEGY, false);
        await mstrategy.setPickleMasterChef(PCHEF);
        await mstrategy.setStableForLiquidity(DAI);
        await mstrategy.setUnirouter(UNIROUTER);

        await dai.approve(MVAULT, MAX, {from: bob});
        await usdc.approve(MVAULT, MAX, {from: bob});
        await usdt.approve(MVAULT, MAX, {from: bob});
        await t3crv.approve(MVAULT, MAX, {from: bob});
        await mvault.approve(MVAULT, MAX, {from: bob});

        await yax.mint(MVAULT, INIT_BALANCE);
        await dai.mint(STABLESWAP3POOL, INIT_BALANCE);
        await usdc.mint(STABLESWAP3POOL, '1000000000');
        await usdt.mint(STABLESWAP3POOL, '1000000000');
        await t3crv.mint(STABLESWAP3POOL, INIT_BALANCE);

        await dai.mint(bob, INIT_BALANCE);
        await usdc.mint(bob, '1000000000');
        await usdt.mint(bob, '1000000000');
        await t3crv.mint(bob, INIT_BALANCE);
    });

    async function printBalances(title) {
        console.log(title);
        console.log('mvault T3CRV:    ', fromWei(await t3crv.balanceOf(MVAULT)));
        console.log('mvault MVLT:     ', fromWei(await mvault.balanceOf(MVAULT)));
        console.log('mvault Supply:   ', fromWei(await mvault.totalSupply()));
        console.log('-------------------');
        console.log('mcontroller T3CRV:    ', fromWei(await t3crv.balanceOf(MCONTROLLER)));
        console.log('mstrategy T3CRV:      ', fromWei(await t3crv.balanceOf(MSTRATEGY)));
        console.log('pjar T3CRV:           ', fromWei(await t3crv.balanceOf(PJAR)));
        console.log('pchef PJAR:           ', fromWei(await pjar.balanceOf(PCHEF)));
        console.log('-------------------');
        console.log('bob balances: %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX', fromWei(await dai.balanceOf(bob)),
            fromWeiWithDecimals(await usdc.balanceOf(bob), 6),
            fromWeiWithDecimals(await usdt.balanceOf(bob), 6),
            fromWei(await t3crv.balanceOf(bob)),
            fromWei(await yax.balanceOf(bob)));
        console.log('bob MVLT:        ', fromWei(await mvault.balanceOf(bob)));
        console.log('-------------------');
        console.log('deployer WETH:   ', fromWei(await weth.balanceOf(alice)));
        console.log('stakingPool YAX: ', fromWei(await yax.balanceOf(stakingPool)));
        console.log('-------------------');
    }

    async function printStakeInfo(account_name, account) {
        console.log('yaxPerBlock:        ', fromWei(await mvault.yaxPerBlock()));
        console.log('lastRewardBlock:    ', String(await mvault.lastRewardBlock()));
        console.log('accYaxPerShare:     ', fromWei(await mvault.accYaxPerShare()));
        const userInfo = await mvault.userInfo(account);
        console.log('%s UserInfo:        ', account_name, JSON.stringify(userInfo));
        console.log('%s amount:          ', account_name, fromWei(userInfo.amount));
        console.log('-------------------');
    }

    describe('rescue stuck fund in controller & strategy should work', () => {
        it('deposit', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE deposit ===');
            }
            const _amount = toWei('10');
            await mvault.deposit(_amount, DAI, 1, true, {from: bob});
            assert.equal(String(await dai.balanceOf(bob)), toWei('990'));
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(toWei('9.519')), 10 ** -12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(toWei('1')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER deposit ===');
            }
        });

        it('stuck WETH in strategy', async () => {
            assert.equal(String(await weth.balanceOf(MSTRATEGY)), toWei('0'));
            await weth.mint(MSTRATEGY, toWei('1'));
            assert.equal(String(await weth.balanceOf(MSTRATEGY)), toWei('1'));
            assert.equal(String(await weth.balanceOf(alice)), toWei('0')); // governance has no WETH
            await mcontroller.inCaseStrategyGetStuck(MSTRATEGY, WETH);
            assert.equal(String(await weth.balanceOf(MSTRATEGY)), toWei('0'));
            assert.equal(String(await weth.balanceOf(alice)), toWei('1')); // governance has WETH now
        });

        it('stuck WETH in controller', async () => {
            assert.equal(String(await weth.balanceOf(MCONTROLLER)), toWei('0'));
            await weth.mint(MCONTROLLER, toWei('1'));
            assert.equal(String(await weth.balanceOf(MCONTROLLER)), toWei('1'));
            assert.equal(String(await weth.balanceOf(alice)), toWei('1')); // governance has 1 WETH already
            await mcontroller.inCaseTokensGetStuck(WETH, toWei('1'));
            assert.equal(String(await weth.balanceOf(MCONTROLLER)), toWei('0'));
            assert.equal(String(await weth.balanceOf(alice)), toWei('2')); // governance has 2 WETH
        });

        it('stuck T3CRV (core) in strategy', async () => {
            assert.equal(String(await t3crv.balanceOf(MSTRATEGY)), toWei('0'));
            await t3crv.mint(MSTRATEGY, toWei('1'));
            assert.equal(String(await t3crv.balanceOf(MSTRATEGY)), toWei('1'));
            assert.equal(String(await t3crv.balanceOf(MCONTROLLER)), toWei('0')); // controller has no T3CRV
            await expectRevert(
                mcontroller.inCaseStrategyGetStuck(MSTRATEGY, T3CRV),
                'want'
            );
            await mstrategy.skim({from: bob});
            assert.equal(String(await t3crv.balanceOf(MSTRATEGY)), toWei('0'));
            assert.equal(String(await t3crv.balanceOf(MCONTROLLER)), toWei('1')); // controller has T3CRV now
            await mcontroller.inCaseTokensGetStuck(T3CRV, toWei('1'));
            assert.equal(String(await t3crv.balanceOf(MCONTROLLER)), toWei('0')); // controller has no T3CRV now
            assert.equal(String(await t3crv.balanceOf(alice)), toWei('1')); // governance has T3CRV now
        });
    });
});
