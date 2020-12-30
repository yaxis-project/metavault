const {
    constants,
    ether,
    expectEvent,
    expectRevert,
    time
} = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const yAxisMetaVaultHarvester = artifacts.require('yAxisMetaVaultHarvester');

const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const StrategyCurve3Crv = artifacts.require('StrategyCurve3Crv');

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

async function advanceBlocks(blocks) {
    for (let i = 0; i < blocks; i++) {
        await time.advanceBlock();
    }
}

contract('StrategyCurve3Crv', async (accounts) => {
    const { fromWei } = web3.utils;
    const deployer = accounts[0];
    const treasury = accounts[1];
    const stakingPool = accounts[2];
    const bob = accounts[3];

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = ether('1000');

    let YAX; let DAI; let USDC; let USDT; let WETH; let T3CRV; let CRV; // addresses
    let yax; let dai; let usdc; let usdt; let weth; let t3crv; let crv; // MockERC20s

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
        crv = await MockERC20.new('Curve.fi', 'CRV', 18);

        YAX = yax.address;
        DAI = dai.address;
        USDC = usdc.address;
        USDT = usdt.address;
        WETH = weth.address;
        T3CRV = t3crv.address;
        CRV = crv.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IERC20 _tokenYAX, uint _yaxPerBlock, uint _startBlock)
        const _yaxPerBlock = ether('1');
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

        gauge = await MockCurveGauge.new(T3CRV);
        GAUGE = gauge.address;

        minter = await MockCurveMinter.new(CRV);
        MINTER = minter.address;

        await crv.mint(MINTER, INIT_BALANCE);

        mcontroller = await StrategyControllerV2.new(VMANAGER);
        MCONTROLLER = mcontroller.address;

        // constructor(address _want, address _crv, address _weth, address _t3crv,
        //         address _dai, address _usdc, address _usdt,
        //         Gauge _gauge, Mintr _crvMintr,
        //         IStableSwap3Pool _stableSwap3Pool, address _controller, IVaultManager _vaultManager)
        mstrategy = await StrategyCurve3Crv.new(T3CRV, CRV, WETH, T3CRV, DAI, USDC, USDT, GAUGE, MINTER, STABLESWAP3POOL, MCONTROLLER, VMANAGER);
        MSTRATEGY = mstrategy.address;

        unirouter = await MockUniswapRouter.new(constants.ZERO_ADDRESS);
        UNIROUTER = unirouter.address;
        yax.mint(UNIROUTER, INIT_BALANCE);
        weth.mint(UNIROUTER, INIT_BALANCE);
        crv.mint(UNIROUTER, INIT_BALANCE);
        dai.mint(UNIROUTER, INIT_BALANCE);

        await mvault.setConverter(CONVERTER);
        await mvault.setVaultManager(VMANAGER);
        await mvault.setTreasuryWallet(treasury);
        await vmanager.setVaultStatus(MVAULT, true);
        await vmanager.setTreasury(treasury);
        await vmanager.setStakingPool(stakingPool);
        await vmanager.setWithdrawalProtectionFee(0);
        await mvault.setController(MCONTROLLER);
        await mcontroller.setVault(T3CRV, MVAULT);
        await mcontroller.addStrategy(T3CRV, MSTRATEGY, 0);
        await mstrategy.setUnirouter(UNIROUTER);
        await mstrategy.approveForSpender(CRV, UNIROUTER, MAX);
        await mstrategy.approveForSpender(WETH, UNIROUTER, MAX);

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
        console.log('-------------------');
        console.log('bob balances: %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX', fromWei(await dai.balanceOf(bob)),
            fromWeiWithDecimals(await usdc.balanceOf(bob), 6),
            fromWeiWithDecimals(await usdt.balanceOf(bob), 6),
            fromWei(await t3crv.balanceOf(bob)),
            fromWei(await yax.balanceOf(bob)));
        console.log('bob MVLT:        ', fromWei(await mvault.balanceOf(bob)));
        console.log('-------------------');
        console.log('deployer WETH:   ', fromWei(await weth.balanceOf(deployer)));
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

    describe('controller with strategy should work', () => {
        it('views', async () => {
            await expectRevert.unspecified(mcontroller.want(DAI));
            assert.equal(String(await mcontroller.want(T3CRV)), T3CRV);
            assert.equal(String(await mcontroller.withdrawFee(T3CRV, ether('1000'))), ether('0'));
        });

        it('deposit', async () => {
            const _amount = ether('10');
            await mvault.deposit(_amount, DAI, 1, true, {from: bob});
            assert.equal(String(await dai.balanceOf(bob)), ether('990'));
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(ether('9.519')), 10 ** -12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1')), 10 ** -12);
        });

        it('strategy harvest by controller', async () => {
            await expectRevert(
                mcontroller.harvestStrategy(MSTRATEGY, {from: bob}),
                '!harvester'
            );
            await mcontroller.harvestStrategy(MSTRATEGY);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('8.5')), 10 ** -12);
        });

        it('strategy harvest directly', async () => {
            await expectRevert(
                mstrategy.harvest({from: bob}),
                '!authorized'
            );
            await mstrategy.harvest();
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('22.75')), 10 ** -12);
        });

        it('bob withdraw DAI', async () => {
            await mvault.withdraw(ether('5'), DAI, {from: bob});
            assert.equal(String(await mvault.balanceOf(bob)), ether('0'));
            assert.ok(Number.parseFloat(await dai.balanceOf(bob)) >= Number.parseFloat(ether('994.99')), "less DAI then expected!");
        });

        it('bob withdrawAll to T3CRV', async () => {
            await mvault.withdrawAll(T3CRV, {from: bob});
            assert.equal(String(await mvault.balanceOf(bob)), ether('0'));
            assert.equal(String(await t3crv.balanceOf(MCONTROLLER)), ether('0'));
            assert.equal(String(await t3crv.balanceOf(MSTRATEGY)), ether('0'));
            assert.equal(String(await mvault.totalSupply()), ether('0'));
            assert.ok(Number.parseFloat(await t3crv.balanceOf(bob)) >= Number.parseFloat(ether('1005')), "less T3CRV then expected!");
        });

        it('withdrawAll by controller', async () => {
            await mcontroller.withdrawAll(MSTRATEGY);
        });

        it('bob deposit 10 USDT', async () => {
            const _amount = ether('10');
            await mvault.deposit(_amount, DAI, 1, true, {from: bob});
            assert.approximately(Number(await mstrategy.balanceOfPool()), Number(ether('9.519')), 10 ** 12);
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(ether('9.519')), 10 ** 12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1.0')), 10 ** -12);
        });

        it('harvest => auto-reinvest', async () => {
            assert.approximately(Number(await crv.balanceOf(MSTRATEGY)), Number(ether('0')), 10 ** -12);
            await mcontroller.harvestStrategy(MSTRATEGY);
            assert.approximately(Number(await crv.balanceOf(MSTRATEGY)), Number(ether('0')), 10 ** -12);
            assert.approximately(Number(await mstrategy.balanceOfPool()), Number(ether('213.1755')), 10 ** 12);
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(ether('213.1755')), 10 ** 12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('21.325')), 10 ** 6);
        });

        it('harvest => auto-reinvest', async () => {
            assert.approximately(Number(await crv.balanceOf(MSTRATEGY)), Number(ether('0')), 10 ** -12);
            const harvester = await yAxisMetaVaultHarvester.new(VMANAGER, MCONTROLLER);
            await vmanager.setHarvester(harvester.address);
            await harvester.setController(MCONTROLLER);
            await harvester.addStrategy(T3CRV, MSTRATEGY, 0);
            await harvester.setHarvester(bob, true);
            assert.isTrue(await harvester.isHarvester(bob));
            await harvester.harvest(MCONTROLLER, MSTRATEGY, {from: bob});
            assert.approximately(Number(await crv.balanceOf(MSTRATEGY)), Number(ether('0')), 10 ** -12);
            await crv.mint(MINTER, INIT_BALANCE);
            await t3crv.mint(STABLESWAP3POOL, INIT_BALANCE);
            await harvester.harvest(MCONTROLLER, MSTRATEGY, {from: bob});
            await mvault.withdrawAll(T3CRV, {from: bob});
        });

        it('claim Insurance Fund by governance', async () => {
            await mstrategy.withdrawAll();
            await vmanager.setInsuranceFee(10); // 0.1%
            await vmanager.setWithdrawalProtectionFee(10); // 0.1%
            await mcontroller.setInvestEnabled(false); // disabled invest
            const _amount = ether('10');
            await mvault.deposit(_amount, T3CRV, 1, true, {from: bob});
            assert.approximately(Number(await t3crv.balanceOf(treasury)), Number(ether('0')), 10 ** -12);
            assert.approximately(Number(await mvault.insurance()), Number(ether('0.01')), 10 ** -12);
            await mvault.claimInsurance();
            assert.approximately(Number(await t3crv.balanceOf(treasury)), Number(ether('0.01')), 10 ** -12);
            assert.approximately(Number(await mvault.insurance()), Number(ether('0')), 10 ** -12);
            await mvault.withdrawAll(T3CRV, {from: bob});
        });
    });
});
