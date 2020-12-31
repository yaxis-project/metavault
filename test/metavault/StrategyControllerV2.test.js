const { constants, ether, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');

const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

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

contract('StrategyControllerV2', async (accounts) => {
    const { fromWei } = web3.utils;
    const deployer = accounts[0];
    const treasury = accounts[1];
    const stakingPool = accounts[2];
    const bob = accounts[3];

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = ether('1000');

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

    let pickle;
    let PICKLE;

    let pjar;
    let PJAR;

    let pchef;
    let PCHEF;

    let mcontroller;
    let MCONTROLLER;

    let mstrategyCrv;
    let MSTRATEGYCRV;

    let mstrategyPickle;
    let MSTRATEGYPICKLE;

    let unirouter;
    let UNIROUTER;

    before(async () => {
        yax = await MockERC20.new('yAxis', 'YAX', 18);
        dai = await MockERC20.new('Dai Stablecoin', 'DAI', 18);
        usdc = await MockERC20.new('USD Coin', 'USDC', 6);
        usdt = await MockERC20.new('Tether', 'USDT', 6);
        weth = await MockERC20.new('Wrapped ETH', 'WETH', 18);
        t3crv = await MockERC20.new('Curve.fi DAI/USDC/USDT', '3Crv', 18);
        crv = await MockERC20.new('Curve DAO Token', 'CRV', 18);
        pickle = await MockERC20.new('Pickle', 'PICKLE', 18);

        YAX = yax.address;
        DAI = dai.address;
        USDC = usdc.address;
        USDT = usdt.address;
        WETH = weth.address;
        T3CRV = t3crv.address;
        CRV = crv.address;
        PICKLE = pickle.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IERC20 _tokenYAX, uint _yaxPerBlock, uint _startBlock)
        const _yaxPerBlock = ether('1');
        const _startBlock = 1;
        mvault = await yAxisMetaVault.new(
            DAI,
            USDC,
            USDT,
            T3CRV,
            YAX,
            _yaxPerBlock,
            _startBlock,
            { from: deployer }
        );
        MVAULT = mvault.address;

        // constructor (IERC20 _yax)
        vmanager = await yAxisMetaVaultManager.new(YAX, { from: deployer });
        VMANAGER = vmanager.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV)
        stableSwap3Pool = await MockStableSwap3Pool.new(DAI, USDC, USDT, T3CRV);
        STABLESWAP3POOL = stableSwap3Pool.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IStableSwap3Pool _stableSwap3Pool, IVaultManager _vaultMaster)
        converter = await StableSwap3PoolConverter.new(
            DAI,
            USDC,
            USDT,
            T3CRV,
            STABLESWAP3POOL,
            VMANAGER,
            { from: deployer }
        );
        CONVERTER = converter.address;

        gauge = await MockCurveGauge.new(T3CRV);
        GAUGE = gauge.address;

        minter = await MockCurveMinter.new(CRV);
        MINTER = minter.address;

        await crv.mint(MINTER, ether('10'));

        // constructor (IERC20 _t3crv)
        pjar = await MockPickleJar.new(T3CRV);
        PJAR = pjar.address;

        // constructor(IERC20 _pickleToken, IERC20 _lpToken)
        pchef = await MockPickleMasterChef.new(PICKLE, PJAR);
        PCHEF = pchef.address;

        await pickle.mint(PCHEF, INIT_BALANCE);

        mcontroller = await StrategyControllerV2.new(VMANAGER);
        MCONTROLLER = mcontroller.address;

        // constructor(address _want, address _crv, address _weth, address _t3crv,
        //         address _dai, address _usdc, address _usdt,
        //         Gauge _gauge, Mintr _crvMintr,
        //         IStableSwap3Pool _stableSwap3Pool, address _controller, IVaultManager _vaultManager)
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
            { from: deployer }
        );
        MSTRATEGYCRV = mstrategyCrv.address;

        // constructor(address _want, address _p3crv, address _pickle, address _weth, address _t3crv, address _dai, address _usdc, address _usdt, address _controller, IVaultManager _vaultManager)
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
            { from: deployer }
        );
        MSTRATEGYPICKLE = mstrategyPickle.address;

        unirouter = await MockUniswapRouter.new(constants.ZERO_ADDRESS);
        UNIROUTER = unirouter.address;
        yax.mint(UNIROUTER, INIT_BALANCE);
        weth.mint(UNIROUTER, INIT_BALANCE);
        crv.mint(UNIROUTER, INIT_BALANCE);
        dai.mint(UNIROUTER, INIT_BALANCE);

        await mvault.setConverter(CONVERTER);
        await mvault.setVaultManager(VMANAGER);
        await vmanager.setVaultStatus(MVAULT, true);
        await vmanager.setTreasury(treasury);
        await vmanager.setStakingPool(stakingPool);
        await vmanager.setWithdrawalProtectionFee(0);
        await mvault.setController(MCONTROLLER);
        await mcontroller.setVault(T3CRV, MVAULT);
        await mstrategyCrv.setUnirouter(UNIROUTER);
        await mstrategyCrv.approveForSpender(WETH, UNIROUTER, MAX);
        await mstrategyCrv.approveForSpender(CRV, UNIROUTER, MAX);
        await mstrategyPickle.setPickleMasterChef(PCHEF);
        await mstrategyPickle.setStableForLiquidity(DAI);
        await mstrategyPickle.setUnirouter(UNIROUTER);

        await dai.approve(MVAULT, MAX, { from: bob });
        await usdc.approve(MVAULT, MAX, { from: bob });
        await usdt.approve(MVAULT, MAX, { from: bob });
        await t3crv.approve(MVAULT, MAX, { from: bob });
        await mvault.approve(MVAULT, MAX, { from: bob });

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
        console.log('mvault T3CRV:     ', fromWei(await t3crv.balanceOf(MVAULT)));
        console.log('mvault MVLT:      ', fromWei(await mvault.balanceOf(MVAULT)));
        console.log('mvault Supply:    ', fromWei(await mvault.totalSupply()));
        console.log('------------------');
        console.log('mcontroller T3CRV:', fromWei(await t3crv.balanceOf(MCONTROLLER)));
        console.log('mstrategy T3CRV:  ', fromWei(await mstrategyCrv.balanceOf()));
        console.log('mstrategy PICKLE: ', fromWei(await mstrategyPickle.balanceOf()));
        console.log('pjar T3CRV:       ', fromWei(await t3crv.balanceOf(PJAR)));
        console.log('pchef PJAR:       ', fromWei(await pjar.balanceOf(PCHEF)));
        console.log('------------------');
        console.log(
            'bob balances:      %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX',
            fromWei(await dai.balanceOf(bob)),
            fromWeiWithDecimals(await usdc.balanceOf(bob), 6),
            fromWeiWithDecimals(await usdt.balanceOf(bob), 6),
            fromWei(await t3crv.balanceOf(bob)),
            fromWei(await yax.balanceOf(bob))
        );
        console.log('bob MVLT:         ', fromWei(await mvault.balanceOf(bob)));
        console.log('------------------');
        console.log('treasury YAX:     ', fromWei(await yax.balanceOf(treasury)));
        console.log('stakingPool YAX:  ', fromWei(await yax.balanceOf(stakingPool)));
        console.log('------------------');
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

    it('should deploy with expected state', async () => {
        assert.equal(MCONTROLLER, await mvault.controller());
        assert.equal(T3CRV, await mvault.token());
        assert.equal(MVAULT, await mcontroller.vaults(T3CRV));
    });

    it('should not allow unpermissioned callers', async () => {
        await expectRevert(mcontroller.setVault(bob, bob, { from: bob }), '!strategist');
        await expectRevert(mcontroller.removeStrategy(bob, bob, { from: bob }), '!strategist');
        await expectRevert(mcontroller.addStrategy(bob, bob, 0, { from: bob }), '!governance');
        await expectRevert(mcontroller.setVaultManager(bob, { from: bob }), '!governance');
        await expectRevert(mcontroller.setCap(bob, bob, 0, { from: bob }), '!strategist');
        await expectRevert(mcontroller.setInvestEnabled(false, { from: bob }), '!strategist');
        await expectRevert(mcontroller.setMaxStrategies(5, { from: bob }), '!strategist');
        await expectRevert(mcontroller.withdrawAll(bob, { from: bob }), '!strategist');
        await expectRevert(
            mcontroller.inCaseTokensGetStuck(bob, 0, { from: bob }),
            '!strategist'
        );
        await expectRevert(
            mcontroller.inCaseStrategyGetStuck(bob, bob, { from: bob }),
            '!strategist'
        );
        await expectRevert(mcontroller.claimInsurance(bob, { from: bob }), '!governance');
        await expectRevert(mcontroller.harvestStrategy(bob, { from: bob }), '!harvester');
    });

    it('should add a strategy', async () => {
        const tx = await mcontroller.addStrategy(T3CRV, MSTRATEGYCRV, 0);
        await expectEvent.inTransaction(tx.tx, mcontroller, 'StrategyAdded', {
            token: T3CRV,
            strategy: MSTRATEGYCRV,
            cap: '0'
        });
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(1, strategies.length);
        assert.equal(MSTRATEGYCRV, strategies[0]);
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, ether('1'));
        assert.equal(MSTRATEGYCRV, strategy);
    });

    it('should deposit into first strategy', async () => {
        const _amount = ether('10');
        await expectRevert(
            mvault.deposit(_amount, DAI, ether('100'), true, { from: bob }),
            'slippage'
        );
        assert.equal(0, await mcontroller.balanceOf(T3CRV));
        const tx = await mvault.deposit(_amount, DAI, 1, true, { from: bob });
        assert.equal(String(await dai.balanceOf(bob)), ether('990'));
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Earn', {
            strategy: MSTRATEGYCRV
        });
    });

    it('should obey maximum strategies amount', async () => {
        await mcontroller.setMaxStrategies(1);
        await expectRevert(
            mcontroller.addStrategy(T3CRV, MSTRATEGYPICKLE, ether('10')),
            '!maxStrategies'
        );
        await mcontroller.setMaxStrategies(10);
    });

    it('should add an additional strategy', async () => {
        await mcontroller.addStrategy(T3CRV, MSTRATEGYPICKLE, ether('10'));
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(2, strategies.length);
        assert.equal(MSTRATEGYCRV, strategies[0]);
        assert.equal(MSTRATEGYPICKLE, strategies[1]);
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, ether('1'));
        assert.equal(MSTRATEGYPICKLE, strategy);
    });

    it('should deposit into second strategy', async () => {
        const _amount = ether('10');
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, _amount);
        assert.equal(MSTRATEGYPICKLE, strategy);
        const tx = await mvault.deposit(_amount, DAI, 1, true, { from: bob });
        assert.equal(String(await dai.balanceOf(bob)), ether('980'));
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Earn', {
            strategy: MSTRATEGYPICKLE
        });
    });

    it('should reorder strategies', async () => {
        const tx = await mcontroller.reorderStrategies(T3CRV, MSTRATEGYCRV, MSTRATEGYPICKLE);
        await expectEvent.inTransaction(tx.tx, mcontroller, 'StrategiesReordered', {
            token: T3CRV,
            strategy1: MSTRATEGYCRV,
            strategy2: MSTRATEGYPICKLE
        });
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(2, strategies.length);
        assert.equal(MSTRATEGYPICKLE, strategies[0]);
        assert.equal(MSTRATEGYCRV, strategies[1]);
        await mcontroller.reorderStrategies(T3CRV, MSTRATEGYPICKLE, MSTRATEGYCRV);
    });

    it('should withdraw excess funds when reducing a strategy cap', async () => {
        const _amount = ether('5');
        const before = await t3crv.balanceOf(MVAULT);
        await mcontroller.setCap(T3CRV, MSTRATEGYPICKLE, _amount);
        const after = await t3crv.balanceOf(MVAULT);
        const change = after.sub(before);
        const diff = _amount.sub(change);
        assert.isTrue(diff.lt(ether('0.01')));
    });

    it('should deposit into first strategy when cap of second is reached', async () => {
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, ether('1'));
        assert.equal(MSTRATEGYCRV, strategy);
        const _amount = ether('10');
        await expectRevert(mcontroller.earn(T3CRV, _amount), '!vault');
        const tx = await mvault.deposit(_amount, DAI, 1, true, { from: bob });
        assert.equal(String(await dai.balanceOf(bob)), ether('970'));
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Earn', {
            strategy: MSTRATEGYCRV
        });
    });

    it('should withdraw small amounts', async () => {
        const _amount = ether('5');
        const strategies = await mcontroller.getBestStrategyWithdraw(T3CRV, _amount);
        assert.equal(MSTRATEGYCRV, strategies._strategies[0]);
        assert.equal(constants.ZERO_ADDRESS, strategies._strategies[1]);
        await expectRevert(mcontroller.withdraw(T3CRV, _amount), '!vault');
        await mvault.withdraw(_amount, DAI, { from: bob });
        // this seems to be the best way to assert balances with _tiny_ changes
        const diff = ether('975').sub(await dai.balanceOf(bob));
        assert.isTrue(diff.lt(ether('0.1')));
    });

    it('should deposit large amounts into a single strategy', async () => {
        const _amount = ether('50');
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, _amount);
        assert.equal(MSTRATEGYCRV, strategy);
        const tx = await mvault.deposit(_amount, DAI, 1, true, { from: bob });
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Earn', {
            strategy: MSTRATEGYCRV
        });
        const diff = ether('925').sub(await dai.balanceOf(bob));
        assert.isTrue(diff.lt(ether('0.1')));
    });

    it('should withdraw large amounts from multiple strategies', async () => {
        const _amount = ether('70');
        const strategies = await mcontroller.getBestStrategyWithdraw(T3CRV, _amount);
        assert.equal(MSTRATEGYCRV, strategies._strategies[0]);
        assert.equal(MSTRATEGYPICKLE, strategies._strategies[1]);
        await mvault.withdraw(_amount, DAI, { from: bob });
        // this seems to be the best way to assert balances with _tiny_ changes
        const diff = ether('995').sub(await dai.balanceOf(bob));
        assert.isTrue(diff.lt(ether('0.2')));
    });

    it('should remove strategies', async () => {
        const tx = await mcontroller.removeStrategy(T3CRV, MSTRATEGYPICKLE);
        await expectEvent.inTransaction(tx.tx, mcontroller, 'StrategyRemoved', {
            token: T3CRV,
            strategy: MSTRATEGYPICKLE
        });
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(1, strategies.length);
        assert.equal(MSTRATEGYCRV, strategies[0]);
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, ether('1'));
        assert.equal(MSTRATEGYCRV, strategy);
    });

    it('should deposit/earn to the remaining strategy', async () => {
        const _amount = ether('5');
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, _amount);
        assert.equal(MSTRATEGYCRV, strategy);
        const tx = await mvault.deposit(_amount, DAI, 1, true, { from: bob });
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Earn', {
            strategy: MSTRATEGYCRV
        });
        const diff = ether('990').sub(await dai.balanceOf(bob));
        assert.isTrue(diff.lt(ether('0.2')));
    });

    it('should allow all strategies to be removed', async () => {
        await mcontroller.removeStrategy(T3CRV, MSTRATEGYCRV);
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(0, strategies.length);
    });

    it('should allow deposits without strategies', async () => {
        const _amount = ether('5');
        await mvault.deposit(_amount, DAI, 1, true, { from: bob });
        const diff = ether('985').sub(await dai.balanceOf(bob));
        assert.isTrue(diff.lt(ether('0.2')));
    });

    it('should earn to a newly added strategy', async () => {
        await mcontroller.addStrategy(T3CRV, MSTRATEGYCRV, 0);
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(1, strategies.length);
        assert.equal(MSTRATEGYCRV, strategies[0]);
        const strategy = await mcontroller.getBestStrategyEarn(T3CRV, ether('1'));
        assert.equal(MSTRATEGYCRV, strategy);
        const tx = await mvault.earn();
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Earn', {
            strategy: MSTRATEGYCRV
        });
    });

    it('should harvest strategy through controller', async () => {
        assert.isTrue(ether('1').eq(await mvault.getPricePerFullShare()));
        const tx = await mcontroller.harvestStrategy(MSTRATEGYCRV);
        await expectEvent.inTransaction(tx.tx, mcontroller, 'Harvest', {
            strategy: MSTRATEGYCRV
        });
        const diff = ether('1.04').sub(await mvault.getPricePerFullShare());
        assert.isTrue(diff.lt(ether('0.001')));
    });
});
