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
const StrategyPickle3Crv = artifacts.require('StrategyPickle3Crv');

const MockPickleJar = artifacts.require('MockPickleJar');
const MockPickleMasterChef = artifacts.require('MockPickleMasterChef');
const MockCurveGauge = artifacts.require('MockCurveGauge');
const MockCurveMinter = artifacts.require('MockCurveMinter');

const MockERC20 = artifacts.require('MockERC20');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');
const MockUniswapRouter = artifacts.require('MockUniswapRouter');

contract('yAxisMetaVaultHarvester', async (accounts) => {
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

    let vharvester;
    let VHARVESTER;

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

    let mstrategyCrv2;
    let MSTRATEGYCRV2;

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
            _startBlock
        );
        MVAULT = mvault.address;

        // constructor (IERC20 _yax)
        vmanager = await yAxisMetaVaultManager.new(YAX);
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
            VMANAGER
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

        vharvester = await yAxisMetaVaultHarvester.new(VMANAGER, MCONTROLLER);
        VHARVESTER = vharvester.address;

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
            VMANAGER
        );
        MSTRATEGYCRV = mstrategyCrv.address;
        mstrategyCrv2 = await StrategyCurve3Crv.new(
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
            VMANAGER
        );
        MSTRATEGYCRV2 = mstrategyCrv2.address;

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
            VMANAGER
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
        await vmanager.setHarvester(VHARVESTER);
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
        await mcontroller.addStrategy(T3CRV, MSTRATEGYCRV, 0);
        await mcontroller.addStrategy(T3CRV, MSTRATEGYPICKLE, 0);
        await mcontroller.addStrategy(T3CRV, MSTRATEGYCRV2, 0);

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

    it('should set the controller', async () => {
        await expectRevert(
            vharvester.setController(MCONTROLLER, { from: bob }),
            '!strategist'
        );
        const tx = await vharvester.setController(MCONTROLLER);
        expectEvent(tx.receipt, 'ControllerSet', {
            controller: MCONTROLLER
        });
        assert.equal(MCONTROLLER, await vharvester.controller());
    });

    it('should set the vault manager', async () => {
        await expectRevert(vharvester.setVaultManager(VMANAGER, { from: bob }), '!strategist');
        const tx = await vharvester.setVaultManager(VMANAGER);
        expectEvent(tx.receipt, 'VaultManagerSet', {
            vaultManager: VMANAGER
        });
        assert.equal(VMANAGER, await vharvester.vaultManager());
    });

    it('should set harvesters', async () => {
        await expectRevert(vharvester.setHarvester(bob, true, { from: bob }), '!strategist');
        const tx = await vharvester.setHarvester(deployer, true, { from: deployer });
        assert.isTrue(await vharvester.isHarvester(deployer));
        expectEvent(tx.receipt, 'HarvesterSet', {
            harvester: deployer,
            status: true
        });
    });

    it('should add strategies', async () => {
        await expectRevert(
            vharvester.addStrategy(T3CRV, MSTRATEGYCRV, 0, { from: bob }),
            '!strategist'
        );
        const tx = await vharvester.addStrategy(T3CRV, MSTRATEGYCRV, 0);
        expectEvent(tx.receipt, 'StrategyAdded', {
            token: T3CRV,
            strategy: MSTRATEGYCRV,
            timeout: '0'
        });
    });

    it('should harvest added strategies', async () => {
        await expectRevert(
            vharvester.harvest(MCONTROLLER, MSTRATEGYCRV, { from: bob }),
            '!harvester'
        );
        const tx = await vharvester.harvest(MCONTROLLER, MSTRATEGYCRV);
        expectEvent(tx.receipt, 'Harvest', {
            controller: MCONTROLLER,
            strategy: MSTRATEGYCRV
        });
    });

    it('should add additional strategies', async () => {
        let tx = await vharvester.addStrategy(T3CRV, MSTRATEGYPICKLE, 300);
        expectEvent(tx.receipt, 'StrategyAdded', {
            token: T3CRV,
            strategy: MSTRATEGYPICKLE,
            timeout: '300'
        });

        let strategies = await vharvester.strategies(T3CRV);
        assert.equal(300, strategies.timeout);
        assert.equal(0, strategies.lastCalled);
        let strategyAddresses = await vharvester.strategyAddresses(T3CRV);
        assert.equal(2, strategyAddresses.length);
        assert.equal(MSTRATEGYCRV, strategyAddresses[0]);
        assert.equal(MSTRATEGYPICKLE, strategyAddresses[1]);

        tx = await vharvester.addStrategy(T3CRV, MSTRATEGYCRV2, 600);
        expectEvent(tx.receipt, 'StrategyAdded', {
            token: T3CRV,
            strategy: MSTRATEGYCRV2,
            timeout: '600'
        });

        strategies = await vharvester.strategies(T3CRV);
        assert.equal(600, strategies.timeout);
        assert.equal(0, strategies.lastCalled);
        strategyAddresses = await vharvester.strategyAddresses(T3CRV);
        assert.equal(3, strategyAddresses.length);
        assert.equal(MSTRATEGYCRV, strategyAddresses[0]);
        assert.equal(MSTRATEGYPICKLE, strategyAddresses[1]);
        assert.equal(MSTRATEGYCRV2, strategyAddresses[2]);
    });

    it('should rotate harvesting strategies', async () => {
        const tx = await vharvester.harvestNextStrategy(T3CRV);
        expectEvent(tx.receipt, 'Harvest', {
            controller: MCONTROLLER,
            strategy: MSTRATEGYCRV
        });

        let strategyAddresses = await vharvester.strategyAddresses(T3CRV);
        assert.equal(3, strategyAddresses.length);
        assert.equal(MSTRATEGYPICKLE, strategyAddresses[0]);
        assert.equal(MSTRATEGYCRV2, strategyAddresses[1]);
        assert.equal(MSTRATEGYCRV, strategyAddresses[2]);
    });

    it('should not allow harvestNextStrategy until timeout has passed', async () => {
        assert.isFalse(await vharvester.canHarvest(T3CRV));
        await expectRevert(vharvester.harvestNextStrategy(T3CRV), '!canHarvest');

        await time.increase(601);

        assert.isTrue(await vharvester.canHarvest(T3CRV));
        const tx = await vharvester.harvestNextStrategy(T3CRV);
        expectEvent(tx.receipt, 'Harvest', {
            controller: MCONTROLLER,
            strategy: MSTRATEGYPICKLE
        });

        let strategyAddresses = await vharvester.strategyAddresses(T3CRV);
        assert.equal(3, strategyAddresses.length);
        assert.equal(MSTRATEGYCRV2, strategyAddresses[0]);
        assert.equal(MSTRATEGYCRV, strategyAddresses[1]);
        assert.equal(MSTRATEGYPICKLE, strategyAddresses[2]);
    });

    it('should remove strategies', async () => {
        await expectRevert(
            vharvester.removeStrategy(T3CRV, MSTRATEGYCRV2, 300, { from: bob }),
            '!strategist'
        );
        await expectRevert(vharvester.removeStrategy(T3CRV, bob, 300), '!found');
        const tx = await vharvester.removeStrategy(T3CRV, MSTRATEGYCRV2, 300);
        expectEvent(tx.receipt, 'StrategyRemoved', {
            token: T3CRV,
            strategy: MSTRATEGYCRV2,
            timeout: '300'
        });

        let strategyAddresses = await vharvester.strategyAddresses(T3CRV);
        assert.equal(2, strategyAddresses.length);
        assert.equal(MSTRATEGYCRV, strategyAddresses[1]);
        assert.equal(MSTRATEGYPICKLE, strategyAddresses[0]);
    });
});
