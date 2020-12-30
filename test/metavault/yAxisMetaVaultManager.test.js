const { constants, ether, expectRevert } = require('@openzeppelin/test-helpers');

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

contract('yAxisMetaVaultManager', async (accounts) => {
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

    it('should deploy with expected state', async () => {
        assert.equal(YAX, await vmanager.yax());
        assert.equal(deployer, await vmanager.governance());
        assert.equal(deployer, await vmanager.strategist());
        assert.equal(deployer, await vmanager.harvester());
        assert.equal(2000, await vmanager.stakingPoolShareFee());
        assert.equal(20000e18, await vmanager.treasuryBalance());
        assert.equal(500, await vmanager.treasuryFee());
        assert.equal(10, await vmanager.withdrawalProtectionFee());
    });

    it('should set the insurance fee', async () => {
        assert.equal(0, await vmanager.insuranceFee());
        await expectRevert(vmanager.setInsuranceFee(1, { from: bob }), '!governance');
        await vmanager.setInsuranceFee(1);
        assert.equal(1, await vmanager.insuranceFee());
    });

    it('should set the staking pool', async () => {
        assert.equal(constants.ZERO_ADDRESS, await vmanager.stakingPool());
        await expectRevert(vmanager.setStakingPool(stakingPool, { from: bob }), '!governance');
        await vmanager.setStakingPool(stakingPool);
        assert.equal(stakingPool, await vmanager.stakingPool());
    });

    it('should set the staking pool fee', async () => {
        assert.equal(2000, await vmanager.stakingPoolShareFee());
        await expectRevert(vmanager.setStakingPoolShareFee(1, { from: bob }), '!governance');
        await vmanager.setStakingPoolShareFee(1);
        assert.equal(1, await vmanager.stakingPoolShareFee());
    });

    it('should set the treasury', async () => {
        assert.equal(constants.ZERO_ADDRESS, await vmanager.treasury());
        await expectRevert(vmanager.setTreasury(treasury, { from: bob }), '!governance');
        await vmanager.setTreasury(treasury);
        assert.equal(treasury, await vmanager.treasury());
    });

    it('should set the treasury balance', async () => {
        assert.equal(20000e18, await vmanager.treasuryBalance());
        await expectRevert(vmanager.setTreasuryBalance(1, { from: bob }), '!governance');
        await vmanager.setTreasuryBalance(1);
        assert.equal(1, await vmanager.treasuryBalance());
    });

    it('should set the treasury fee', async () => {
        assert.equal(500, await vmanager.treasuryFee());
        await expectRevert(vmanager.setTreasuryFee(1, { from: bob }), '!governance');
        await vmanager.setTreasuryFee(1);
        assert.equal(1, await vmanager.treasuryFee());
    });

    it('should set the withdrawal protection fee', async () => {
        assert.equal(10, await vmanager.withdrawalProtectionFee());
        await expectRevert(
            vmanager.setWithdrawalProtectionFee(1, { from: bob }),
            '!governance'
        );
        await vmanager.setWithdrawalProtectionFee(1);
        assert.equal(1, await vmanager.withdrawalProtectionFee());
    });

    it('should set the YAX token', async () => {
        assert.equal(YAX, await vmanager.yax());
        await expectRevert(vmanager.setYax(bob, { from: bob }), '!governance');
        await vmanager.setYax(bob);
        assert.equal(bob, await vmanager.yax());
    });

    it('should set the strategist', async () => {
        assert.equal(deployer, await vmanager.strategist());
        await expectRevert(vmanager.setStrategist(bob, { from: bob }), '!governance');
        await vmanager.setStrategist(bob);
        assert.equal(bob, await vmanager.strategist());
    });

    it('should set the governance', async () => {
        assert.equal(deployer, await vmanager.governance());
        await expectRevert(vmanager.setGovernance(bob, { from: bob }), '!governance');
        await vmanager.setGovernance(bob);
        assert.equal(bob, await vmanager.governance());
    });
});
