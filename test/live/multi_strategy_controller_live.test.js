const { ether, send } = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const yAxisMetaVaultHarvester = artifacts.require('yAxisMetaVaultHarvester');

const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

const StrategyControllerV1 = artifacts.require('StrategyControllerV1');
const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const StrategyCurve3Crv = artifacts.require('StrategyCurve3Crv');
const StrategyPickle3Crv = artifacts.require('StrategyPickle3Crv');

const PickleJar = artifacts.require('PickleJar');

const MockERC20 = artifacts.require('MockERC20');

const verbose = process.env.VERBOSE;

function fromWeiWithDecimals(num, decimals = 18) {
    num = Number.parseFloat(String(num));
    for (let i = 0; i < decimals; i++) num = num * 0.1;
    return num.toFixed(2);
}

const deployer = '0x5661bF295f48F499A70857E8A6450066a8D16400';
const multisig = '0xC1d40e197563dF727a4d3134E8BD1DeF4B498C6f';
const timelock = '0x66C5c16d13a38461648c1D097f219762D374B412';
const stakingPool = '0xeF31Cb88048416E301Fee1eA13e7664b887BA7e8';
const bob = '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE';

contract('multi_strategy_controller_live.test', async (accounts) => {
    const { fromWei } = web3.utils;

    accounts[0] = deployer;
    accounts[1] = multisig;
    accounts[2] = timelock;
    accounts[3] = bob;

    const MAX = web3.utils.toTwosComplement(-1);

    let YAX, DAI, USDC, USDT, WETH, T3CRV, CRV; // addresses
    let yax, dai, usdc, usdt, t3crv; // MockERC20s

    let mvault;
    let MVAULT;

    let vmanager;
    let VMANAGER;

    let vharvester;
    let VHARVESTER;

    let converter;
    let CONVERTER;

    let STABLESWAP3POOL;

    let GAUGE;

    let MINTER;

    let pjar;
    let PJAR;

    let PCHEF;

    let PICKLE;

    let mcontroller;
    let MCONTROLLER;

    let oldController;
    let OLDCONTROLLER;

    let OLDMSTRATEGYCRV;

    let mstrategyCrv;
    let MSTRATEGYCRV;

    let mstrategyPickle;
    let MSTRATEGYPICKLE;

    before(async () => {
        await network.provider.request({
            method: 'hardhat_reset',
            params: [
                {
                    forking: {
                        jsonRpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
                    }
                }
            ]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [bob]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [deployer]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [multisig]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [timelock]
        });
        await send.ether(bob, deployer, ether('100'), { from: bob });
        await send.ether(bob, multisig, ether('100'), { from: bob });
        await send.ether(bob, timelock, ether('100'), { from: bob });
        YAX = '0xb1dC9124c395c1e97773ab855d66E879f053A289';
        DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
        USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        T3CRV = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
        CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52';
        PICKLE = '0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5';

        MVAULT = '0xBFbEC72F2450eF9Ab742e4A27441Fa06Ca79eA6a';
        STABLESWAP3POOL = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
        OLDCONTROLLER = '0x2ebE1461D2Fc6dabF079882CFc51e5013BbA49B6';
        OLDMSTRATEGYCRV = '0xd721d16a685f63A4e8C4e8c5988b76Bec6A85c90';
        GAUGE = '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A';
        MINTER = '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0';
        PJAR = '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33';
        PCHEF = '0xbD17B1ce622d73bD438b9E658acA5996dc394b0d';

        yax = await MockERC20.at(YAX);
        dai = await MockERC20.at(DAI);
        usdc = await MockERC20.at(USDC);
        usdt = await MockERC20.at(USDT);
        t3crv = await MockERC20.at(T3CRV);

        mvault = await yAxisMetaVault.at(MVAULT);
        oldController = await StrategyControllerV1.at(OLDCONTROLLER);
        pjar = await PickleJar.at(PJAR);

        await dai.approve(MVAULT, MAX, { from: bob });
        await usdc.approve(MVAULT, MAX, { from: bob });
        await usdt.approve(MVAULT, MAX, { from: bob });
        await t3crv.approve(MVAULT, MAX, { from: bob });
        await mvault.approve(MVAULT, MAX, { from: bob });
    });

    after(async () => {
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [bob]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [deployer]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [multisig]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [timelock]
        });
        await network.provider.request({
            method: 'hardhat_reset',
            params: []
        });
    });

    async function printBalances(title) {
        console.log(title);
        console.log('mvault T3CRV:       ', fromWei(await t3crv.balanceOf(MVAULT)));
        console.log('mvault MVLT:        ', fromWei(await mvault.balanceOf(MVAULT)));
        console.log('mvault Supply:      ', fromWei(await mvault.totalSupply()));
        console.log('--------------------');
        if (typeof MCONTROLLER != 'undefined') {
            console.log('mstrategy T3CRV:    ', fromWei(await mstrategyCrv.balanceOf()));
            console.log('mstrategy PICKLE:   ', fromWei(await mstrategyPickle.balanceOf()));
            console.log('pjar T3CRV:         ', fromWei(await t3crv.balanceOf(PJAR)));
            console.log('pchef PJAR:         ', fromWei(await pjar.balanceOf(PCHEF)));
            console.log('--------------------');
        }
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

    it('should deploy new contracts', async () => {
        vmanager = await yAxisMetaVaultManager.new(YAX, { from: deployer });
        VMANAGER = vmanager.address;

        mcontroller = await StrategyControllerV2.new(VMANAGER, { from: deployer });
        MCONTROLLER = mcontroller.address;

        vharvester = await yAxisMetaVaultHarvester.new(VMANAGER, MCONTROLLER, {
            from: deployer
        });
        VHARVESTER = vharvester.address;

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
    });

    it('should prepare the old controller and vault', async () => {
        await oldController.setInvestEnabled(false, { from: multisig });
        await oldController.withdrawAll(OLDMSTRATEGYCRV, {
            from: multisig
        });
    });

    it('should setup the vault manager', async () => {
        await vmanager.setVaultStatus(MVAULT, true, { from: deployer });
        assert.isTrue(await vmanager.vaults(MVAULT));
        await vmanager.setControllerStatus(MCONTROLLER, true, { from: deployer });
        assert.isTrue(await vmanager.controllers(MCONTROLLER));
        await vmanager.setTreasury(multisig, { from: deployer });
        assert.equal(multisig, await vmanager.treasury());
        await vmanager.setStakingPool(stakingPool, { from: deployer });
        assert.equal(stakingPool, await vmanager.stakingPool());
        await vmanager.setHarvester(VHARVESTER, { from: deployer });
        assert.equal(VHARVESTER, await vmanager.harvester());
    });

    it('should setup the new strategies and harvester', async () => {
        await mstrategyPickle.setStableForLiquidity(DAI, { from: deployer });
        await vharvester.setVaultManager(VMANAGER, { from: deployer });
        assert.equal(VMANAGER, await vharvester.vaultManager());
        await vharvester.setController(MCONTROLLER, { from: deployer });
        assert.equal(MCONTROLLER, await vharvester.controller());
        await vharvester.setHarvester(deployer, true, { from: deployer });
        assert.isTrue(await vharvester.isHarvester(deployer));
        await vharvester.addStrategy(T3CRV, MSTRATEGYCRV, 86400, { from: deployer });
        await vharvester.addStrategy(T3CRV, MSTRATEGYPICKLE, 43200, { from: deployer });
        const strategyAddresses = await vharvester.strategyAddresses(T3CRV);
        assert.equal(2, strategyAddresses.length);
        assert.equal(MSTRATEGYCRV, strategyAddresses[0]);
        assert.equal(MSTRATEGYPICKLE, strategyAddresses[1]);
    });

    it('should setup the new controller', async () => {
        await mcontroller.setConverter(T3CRV, DAI, CONVERTER, { from: deployer });
        await mcontroller.setConverter(T3CRV, USDT, CONVERTER, { from: deployer });
        await mcontroller.setConverter(T3CRV, USDC, CONVERTER, { from: deployer });
        assert.equal(CONVERTER, await mcontroller.converters(T3CRV, DAI));
        assert.equal(CONVERTER, await mcontroller.converters(T3CRV, USDT));
        assert.equal(CONVERTER, await mcontroller.converters(T3CRV, USDC));
        await mcontroller.setVault(T3CRV, MVAULT, { from: deployer });
        assert.equal(MVAULT, await mcontroller.vaults(T3CRV));
        await mcontroller.addStrategy(T3CRV, MSTRATEGYCRV, 0, { from: deployer });
        await mcontroller.addStrategy(T3CRV, MSTRATEGYPICKLE, ether('1000000'), {
            from: deployer
        });
        const strategies = await mcontroller.strategies(T3CRV);
        assert.equal(2, strategies.length);
        assert.equal(MSTRATEGYCRV, strategies[0]);
        assert.equal(MSTRATEGYPICKLE, strategies[1]);
    });

    it('should pass governance and strategist over', async () => {
        await vmanager.setStrategist(multisig, { from: deployer });
        assert.equal(multisig, await vmanager.strategist());
        await vmanager.setGovernance(timelock, { from: deployer });
        assert.equal(timelock, await vmanager.governance());
    });

    it('should set the new controller on the vault', async () => {
        assert.equal(OLDCONTROLLER, await mvault.controller());
        await mvault.setController(MCONTROLLER, { from: timelock });
        assert.equal(MCONTROLLER, await mvault.controller());
    });

    it('should call earn to transfer funds to Curve strategy', async () => {
        assert.equal(0, await mstrategyCrv.balanceOf());
        await mvault.earn({ from: deployer });
        assert.isTrue((await mstrategyCrv.balanceOf()).gt(ether('1000000')));
    });

    it('should send new deposits go to the Pickle strategy', async () => {
        assert.equal(0, await mstrategyPickle.balanceOf());
        await mvault.deposit(ether('100'), DAI, 1, true, { from: bob });
        assert.isTrue((await mstrategyPickle.balanceOf()).gt(ether('100')));
    });
});
