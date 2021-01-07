const { ether, send } = require('@openzeppelin/test-helpers');
const { MAX, fromWei, fromWeiWithDecimals, verbose } = require('../helpers/common');

const MockERC20 = artifacts.require('MockERC20');
const PickleJar = artifacts.require('PickleJar');
const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');
const StrategyControllerV1 = artifacts.require('StrategyControllerV1');
const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const StrategyCurve3Crv = artifacts.require('StrategyCurve3Crv');
const StrategyPickle3Crv = artifacts.require('StrategyPickle3Crv');
const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultHarvester = artifacts.require('yAxisMetaVaultHarvester');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');

const deployer = '0x5661bF295f48F499A70857E8A6450066a8D16400';
const multisig = '0xC1d40e197563dF727a4d3134E8BD1DeF4B498C6f';
const timelock = '0x66C5c16d13a38461648c1D097f219762D374B412';
const stakingPool = '0xeF31Cb88048416E301Fee1eA13e7664b887BA7e8';
const user = '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE';

contract('StrategyControllerV2: live', async (accounts) => {
    accounts[0] = deployer;
    accounts[1] = multisig;
    accounts[2] = timelock;
    accounts[3] = user;

    before(async () => {
        await network.provider.request({
            method: 'hardhat_reset',
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.MAINNET_RPC_URL
                    }
                }
            ]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [user]
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

        await send.ether(user, deployer, ether('100'), { from: user });
        await send.ether(user, multisig, ether('100'), { from: user });
        await send.ether(user, timelock, ether('100'), { from: user });

        this.YAX = '0xb1dC9124c395c1e97773ab855d66E879f053A289';
        this.DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
        this.USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        this.USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        this.WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        this.T3CRV = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
        this.CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52';
        this.PICKLE = '0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5';
        this.VAULT = '0xBFbEC72F2450eF9Ab742e4A27441Fa06Ca79eA6a';
        this.STABLESWAP3POOL = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
        this.OLDCONTROLLER = '0x2ebE1461D2Fc6dabF079882CFc51e5013BbA49B6';
        this.OLDSTRATEGYCRV = '0xd721d16a685f63A4e8C4e8c5988b76Bec6A85c90';
        this.GAUGE = '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A';
        this.MINTER = '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0';
        this.PJAR = '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33';
        this.PCHEF = '0xbD17B1ce622d73bD438b9E658acA5996dc394b0d';
        this.UNISWAP = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

        this.yax = await MockERC20.at(this.YAX);
        this.dai = await MockERC20.at(this.DAI);
        this.usdc = await MockERC20.at(this.USDC);
        this.usdt = await MockERC20.at(this.USDT);
        this.t3crv = await MockERC20.at(this.T3CRV);
        this.vault = await yAxisMetaVault.at(this.VAULT);
        this.oldController = await StrategyControllerV1.at(this.OLDCONTROLLER);
        this.pjar = await PickleJar.at(this.PJAR);

        await this.dai.approve(this.VAULT, MAX, { from: user });
        await this.usdc.approve(this.VAULT, MAX, { from: user });
        await this.usdt.approve(this.VAULT, MAX, { from: user });
        await this.t3crv.approve(this.VAULT, MAX, { from: user });
        await this.vault.approve(this.VAULT, MAX, { from: user });
    });

    after(async () => {
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [user]
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

    this.printBalances = async (title) => {
        // skips printing before the first test
        if (typeof this.controller != 'undefined') {
            console.log(title);
            console.log(
                'vault T3CRV:       ',
                fromWei(await this.t3crv.balanceOf(this.VAULT))
            );
            console.log(
                'vault MVLT:        ',
                fromWei(await this.vault.balanceOf(this.VAULT))
            );
            console.log('vault Supply:      ', fromWei(await this.vault.totalSupply()));
            console.log('--------------------');
            console.log('strategy T3CRV:    ', fromWei(await this.strategyCrv.balanceOf()));
            console.log('strategy PICKLE:   ', fromWei(await this.strategyPickle.balanceOf()));
            console.log('pjar T3CRV:        ', fromWei(await this.t3crv.balanceOf(this.PJAR)));
            console.log('pchef PJAR:        ', fromWei(await this.pjar.balanceOf(this.PCHEF)));
            console.log('--------------------');
            console.log(
                'user balances:      %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX',
                fromWei(await this.dai.balanceOf(user)),
                fromWeiWithDecimals(await this.usdc.balanceOf(user), 6),
                fromWeiWithDecimals(await this.usdt.balanceOf(user), 6),
                fromWei(await this.t3crv.balanceOf(user)),
                fromWei(await this.yax.balanceOf(user))
            );
            console.log(
                'user staked:       ',
                fromWei((await this.vault.userInfo(user)).amount)
            );
            console.log('--------------------');
        }
    };

    beforeEach(async () => {
        if (verbose) {
            await this.printBalances('\n====== BEFORE ======');
        }
    });

    afterEach(async () => {
        if (verbose) {
            await this.printBalances('\n====== AFTER ======');
        }
    });

    it('should deploy new contracts', async () => {
        this.manager = await yAxisMetaVaultManager.new(this.YAX, { from: deployer });

        this.controller = await StrategyControllerV2.new(this.manager.address, {
            from: deployer
        });

        this.harvester = await yAxisMetaVaultHarvester.new(
            this.manager.address,
            this.controller.address,
            { from: deployer }
        );

        this.converter = await StableSwap3PoolConverter.new(
            this.DAI,
            this.USDC,
            this.USDT,
            this.T3CRV,
            this.STABLESWAP3POOL,
            this.manager.address,
            { from: deployer }
        );

        this.strategyCrv = await StrategyCurve3Crv.new(
            this.T3CRV,
            this.CRV,
            this.WETH,
            this.T3CRV,
            this.DAI,
            this.USDC,
            this.USDT,
            this.GAUGE,
            this.MINTER,
            this.STABLESWAP3POOL,
            this.controller.address,
            this.manager.address,
            this.UNISWAP,
            { from: deployer }
        );

        this.strategyPickle = await StrategyPickle3Crv.new(
            this.T3CRV,
            this.PJAR,
            this.PICKLE,
            this.WETH,
            this.T3CRV,
            this.DAI,
            this.USDC,
            this.USDT,
            this.STABLESWAP3POOL,
            this.controller.address,
            this.manager.address,
            this.UNISWAP,
            { from: deployer }
        );
    });

    it('should prepare the old controller and vault', async () => {
        await this.oldController.setInvestEnabled(false, { from: multisig });
        await this.oldController.withdrawAll(this.OLDSTRATEGYCRV, {
            from: multisig
        });
    });

    it('should setup the vault manager', async () => {
        await this.manager.setVaultStatus(this.VAULT, true, { from: deployer });
        assert.isTrue(await this.manager.vaults(this.VAULT));
        await this.manager.setControllerStatus(this.controller.address, true, {
            from: deployer
        });
        assert.isTrue(await this.manager.controllers(this.controller.address));
        await this.manager.setTreasury(multisig, { from: deployer });
        assert.equal(multisig, await this.manager.treasury());
        await this.manager.setStakingPool(stakingPool, { from: deployer });
        assert.equal(stakingPool, await this.manager.stakingPool());
        await this.manager.setHarvester(this.harvester.address, { from: deployer });
        assert.equal(this.harvester.address, await this.manager.harvester());
    });

    it('should setup the new strategies and harvester', async () => {
        await this.strategyPickle.setStableForLiquidity(this.DAI, { from: deployer });
        await this.harvester.setVaultManager(this.manager.address, { from: deployer });
        assert.equal(this.manager.address, await this.harvester.vaultManager());
        await this.harvester.setController(this.controller.address, { from: deployer });
        assert.equal(this.controller.address, await this.harvester.controller());
        await this.harvester.setHarvester(deployer, true, { from: deployer });
        assert.isTrue(await this.harvester.isHarvester(deployer));
        await this.harvester.addStrategy(this.T3CRV, this.strategyCrv.address, 86400, {
            from: deployer
        });
        await this.harvester.addStrategy(this.T3CRV, this.strategyPickle.address, 43200, {
            from: deployer
        });
        const strategyAddresses = await this.harvester.strategyAddresses(this.T3CRV);
        assert.equal(2, strategyAddresses.length);
        assert.equal(this.strategyCrv.address, strategyAddresses[0]);
        assert.equal(this.strategyPickle.address, strategyAddresses[1]);
    });

    it('should setup the new controller', async () => {
        await this.controller.setConverter(this.T3CRV, this.DAI, this.converter.address, {
            from: deployer
        });
        await this.controller.setConverter(this.T3CRV, this.USDT, this.converter.address, {
            from: deployer
        });
        await this.controller.setConverter(this.T3CRV, this.USDC, this.converter.address, {
            from: deployer
        });
        assert.equal(
            this.converter.address,
            await this.controller.converters(this.T3CRV, this.DAI)
        );
        assert.equal(
            this.converter.address,
            await this.controller.converters(this.T3CRV, this.USDT)
        );
        assert.equal(
            this.converter.address,
            await this.controller.converters(this.T3CRV, this.USDC)
        );
        await this.controller.setVault(this.T3CRV, this.VAULT, { from: deployer });
        assert.equal(this.VAULT, await this.controller.vaults(this.T3CRV));
        await this.controller.addStrategy(this.T3CRV, this.strategyCrv.address, 0, {
            from: deployer
        });
        await this.controller.addStrategy(
            this.T3CRV,
            this.strategyPickle.address,
            ether('1000000'),
            { from: deployer }
        );
        const strategies = await this.controller.strategies(this.T3CRV);
        assert.equal(2, strategies.length);
        assert.equal(this.strategyCrv.address, strategies[0]);
        assert.equal(this.strategyPickle.address, strategies[1]);
    });

    it('should pass governance and strategist over', async () => {
        await this.manager.setStrategist(multisig, { from: deployer });
        assert.equal(multisig, await this.manager.strategist());
        await this.manager.setGovernance(timelock, { from: deployer });
        assert.equal(timelock, await this.manager.governance());
    });

    it('should set the new controller on the vault', async () => {
        assert.equal(this.OLDCONTROLLER, await this.vault.controller());
        await this.vault.setController(this.controller.address, { from: timelock });
        assert.equal(this.controller.address, await this.vault.controller());
    });

    it('should call earn to transfer funds to Curve strategy', async () => {
        assert.equal(0, await this.strategyCrv.balanceOf());
        await this.vault.earn({ from: deployer });
        assert.isTrue((await this.strategyCrv.balanceOf()).gt(ether('1000000')));
    });

    it('should send new deposits go to the Pickle strategy', async () => {
        assert.equal(0, await this.strategyPickle.balanceOf());
        await this.vault.deposit(ether('100'), this.DAI, 1, true, { from: user });
        assert.isTrue((await this.strategyPickle.balanceOf()).gt(ether('100')));
    });

    it('should harvest', async () => {
        await this.harvester.harvestNextStrategy(this.T3CRV, { from: deployer });
    });
});
