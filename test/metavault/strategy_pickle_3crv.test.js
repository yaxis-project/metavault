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

contract('strategy_pickle3_crv.test', async (accounts) => {
    const { fromWei } = web3.utils;
    const deployer = accounts[0];
    const treasury = accounts[1];
    const stakingPool = accounts[2];
    const bob = accounts[3];

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = ether('1000');

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

        // constructor (IERC20 _t3crv)
        pjar = await MockPickleJar.new(T3CRV);
        PJAR = pjar.address;

        // constructor(IERC20 _pickleToken, IERC20 _lpToken)
        pchef = await MockPickleMasterChef.new(PICKLE, PJAR);
        PCHEF = pchef.address;

        await pickle.mint(PCHEF, INIT_BALANCE);

        mcontroller = await StrategyControllerV2.new(VMANAGER);
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
        await vmanager.setTreasury(treasury);
        await vmanager.setStakingPool(stakingPool);
        await vmanager.setWithdrawalProtectionFee(0);
        await mvault.setController(MCONTROLLER);
        await mcontroller.setVault(T3CRV, MVAULT);
        await mcontroller.addStrategy(T3CRV, MSTRATEGY, 0);
        await mstrategy.setPickleMasterChef(PCHEF);
        await mstrategy.setStableForLiquidity(DAI);
        await mstrategy.setUnirouter(UNIROUTER);
        await mstrategy.approveForSpender(PICKLE, UNIROUTER, MAX);
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

    describe('controller with strategy should work', () => {
        it('views', async () => {
            await expectRevert.unspecified(mcontroller.want(DAI));
            assert.equal(String(await mcontroller.want(T3CRV)), T3CRV);
            //assert.equal(String(await mcontroller.withdrawFee(T3CRV, ether('1000'))), ether('5'));
        });

        it('deposit', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE deposit ===');
            }
            const _amount = ether('10');
            await mvault.deposit(_amount, DAI, 1, true, {from: bob});
            assert.equal(String(await dai.balanceOf(bob)), ether('990'));
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(ether('9.519')), 10 ** -12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER deposit ===');
            }
        });

        it('strategy harvest by controller', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE strategy harvest by controller ===');
            }
            await expectRevert(
                mcontroller.harvestStrategy(MSTRATEGY, {from: bob}),
                '!harvester'
            );
            await mcontroller.harvestStrategy(MSTRATEGY);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1.070685643564356500')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER strategy harvest by controller ===');
            }
        });

        it('strategy harvest directly', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE strategy harvest directly ===');
            }
            await expectRevert(
                mstrategy.harvest({from: bob}),
                '!authorized'
            );
            await mstrategy.harvest();
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1.288002006053328100')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER strategy harvest directly ===');
            }
        });

        it('bob withdraw DAI', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE bob withdraw DAI ===');
            }
            await mvault.withdraw(ether('5'), DAI, {from: bob});
            assert.equal(String(await mvault.balanceOf(bob)), ether('0'));
            assert.ok(Number.parseFloat(await dai.balanceOf(bob)) >= Number.parseFloat(ether('994.99')), "less DAI then expected!");
            if (verbose) {
                await printBalances('\n=== AFTER bob withdraw DAI ===');
            }
        });

        it('bob withdrawAll to T3CRV', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE bob withdrawAll to T3CRV ===');
            }
            await mvault.withdrawAll(T3CRV, {from: bob});
            assert.equal(String(await mvault.balanceOf(bob)), ether('0'));
            // assert.equal(String(await t3crv.balanceOf(MVAULT)), ether('0'));
            assert.equal(String(await t3crv.balanceOf(MCONTROLLER)), ether('0'));
            assert.equal(String(await t3crv.balanceOf(MSTRATEGY)), ether('0'));
            // assert.equal(String(await t3crv.balanceOf(PJAR)), ether('0'));
            assert.equal(String(await t3crv.balanceOf(PCHEF)), ether('0'));
            assert.equal(String(await mvault.totalSupply()), ether('0'));
            assert.ok(Number.parseFloat(await t3crv.balanceOf(bob)) >= Number.parseFloat(ether('1005')), "less T3CRV then expected!");
            if (verbose) {
                await printBalances('\n=== AFTER bob withdrawAll to T3CRV ===');
            }
        });

        it('withdrawAll by controller', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE withdrawAll by controller ===');
            }
            await mcontroller.withdrawAll(MSTRATEGY);
            if (verbose) {
                await printBalances('\n=== AFTER withdrawAll by controller ===');
            }
        });

        it('bob deposit 10 USDT', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE bob deposit 10 USDT ===');
            }
            const _amount = ether('10');
            await mvault.deposit(_amount, DAI, 1, true, {from: bob});
            assert.approximately(Number(await mstrategy.balanceOfPool()), Number(ether('9.519')), 10 ** -12);
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(ether('9.519')), 10 ** -12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER bob deposit 10 USDT ===');
            }
        });

        it('harvest => auto-reinvest', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE harvest => auto-reinvest ===');
            }
            assert.approximately(Number(await pickle.balanceOf(MSTRATEGY)), Number(ether('2.880972308867020300')), 10 ** -12);
            await mcontroller.harvestStrategy(MSTRATEGY);
            assert.approximately(Number(await pickle.balanceOf(MSTRATEGY)), Number(ether('0.9424752475247525')), 10 ** -12);
            assert.approximately(Number(await mstrategy.balanceOfPool()), Number(ether('14.569830790767913000')), 10 ** -12);
            assert.approximately(Number(await mcontroller.balanceOf(T3CRV)), Number(ether('14.569830790767913000')), 10 ** -12);
            assert.approximately(Number(await mvault.getPricePerFullShare()), Number(ether('1.504074929218354700')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER harvest => auto-reinvest ===');
            }
        });

        it('harvest => auto-reinvest', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE harvest => auto-reinvest ===');
            }
            assert.approximately(Number(await pickle.balanceOf(MSTRATEGY)), Number(ether('0.9424752475247525')), 10 ** -12);
            const harvester = await yAxisMetaVaultHarvester.new(VMANAGER);
            await vmanager.setHarvester(harvester.address);
            await harvester.setController(MCONTROLLER);
            await harvester.addStrategy(T3CRV, MSTRATEGY, 0);
            await harvester.setHarvester(bob, true);
            assert.isTrue(await harvester.isHarvester(bob));
            await harvester.harvest(MCONTROLLER, MSTRATEGY, {from: bob});
            assert.approximately(Number(await pickle.balanceOf(MSTRATEGY)), Number(ether('1.442557504036427000')), 10 ** -12);
            await harvester.harvest(MCONTROLLER, MSTRATEGY, {from: bob});
            if (verbose) {
                await printBalances('\n=== AFTER harvest => auto-reinvest ===');
            }
            await mvault.withdrawAll(T3CRV, {from: bob});
        });

        it('claim Insurance Fund to auto-compounding', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE claim Insurance Fund to auto-compounding ===');
            }
            await mstrategy.withdrawAll();
            await vmanager.setInsuranceFee(10); // 0.1%
            await vmanager.setWithdrawalProtectionFee(10); // 0.1%
            await mcontroller.setInvestEnabled(false); // disabled invest
            const _amount = ether('10');
            await mvault.deposit(_amount, T3CRV, 1, true, {from: bob});
            assert.approximately(Number(await mvault.balance()), Number(ether('9.99')), 10 ** -12);
            assert.approximately(Number(await mvault.insurance()), Number(ether('0.01')), 10 ** -12);
            assert.approximately(Number(await mstrategy.balanceOfPool()), Number(ether('0')), 10 ** -12);
            await mcontroller.claimInsurance(MVAULT);
            assert.approximately(Number(await mvault.balance()), Number(ether('10')), 10 ** -12);
            assert.approximately(Number(await mvault.insurance()), Number(ether('0')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER claim Insurance Fund to auto-compounding ===');
            }
            await mvault.withdrawAll(T3CRV, {from: bob});
        });

        it('claim Insurance Fund by governance', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE claim Insurance Fund by governance ===');
            }
            await mstrategy.withdrawAll();
            await vmanager.setInsuranceFee(10); // 0.1%
            await vmanager.setWithdrawalProtectionFee(10); // 0.1%
            await mcontroller.setInvestEnabled(false); // disabled invest
            const _amount = ether('10');
            await mvault.deposit(_amount, T3CRV, 1, true, {from: bob});
            assert.approximately(Number(await t3crv.balanceOf(treasuryWallet)), Number(ether('0')), 10 ** -12);
            assert.approximately(Number(await mvault.insurance()), Number(ether('0.01')), 10 ** -12);
            await mvault.claimInsurance();
            assert.approximately(Number(await t3crv.balanceOf(treasuryWallet)), Number(ether('0.01')), 10 ** -12);
            assert.approximately(Number(await mvault.insurance()), Number(ether('0')), 10 ** -12);
            if (verbose) {
                await printBalances('\n=== AFTER claim Insurance Fund by governance ===');
            }
            await mvault.withdrawAll(T3CRV, {from: bob});
        });
    });
});
