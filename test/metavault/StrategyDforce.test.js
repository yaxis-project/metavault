const { constants, ether } = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const yAxisMetaVaultHarvester = artifacts.require('yAxisMetaVaultHarvester');

const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

const StrategyControllerV2 = artifacts.require('StrategyControllerV2');
const StrategyDforce = artifacts.require('StrategyDforce');

const MockERC20 = artifacts.require('MockERC20');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');
const MockUniswapRouter = artifacts.require('MockUniswapRouter');
const MockDErc20 = artifacts.require('MockDErc20');
const MockDRewards = artifacts.require('MockDRewards');

const verbose = process.env.VERBOSE;

const { fromWei } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);
const INIT_BALANCE = ether('1000');

function fromWeiWithDecimals(num, decimals = 18) {
    num = Number.parseFloat(String(num));
    for (let i = 0; i < decimals; i++) num = num * 0.1;
    return num.toFixed(2);
}

contract('StrategyDforce', async ([deployer, treasury, stakingPool, bob]) => {
    before(async () => {
        // Token deployments
        this.yax = await MockERC20.new('yAxis', 'YAX', 18);
        this.dai = await MockERC20.new('Dai Stablecoin', 'DAI', 18);
        this.usdc = await MockERC20.new('USD Coin', 'USDC', 6);
        this.usdt = await MockERC20.new('Tether', 'USDT', 6);
        this.weth = await MockERC20.new('Wrapped ETH', 'WETH', 18);
        this.t3crv = await MockERC20.new('Curve.fi DAI/USDC/USDT', '3Crv', 18);

        this.df = await MockERC20.new('dForce', 'DF', 18);
        this.dDai = await MockDErc20.new('dForce DAI', 'dDAI', this.dai.address);
        this.dRewards = await MockDRewards.new(this.dDai.address, this.df.address, 100);

        // Protocol contract deployments
        this.vaultManager = await yAxisMetaVaultManager.new(this.yax.address);
        this.vault = await yAxisMetaVault.new(
            this.dai.address,
            this.usdc.address,
            this.usdt.address,
            this.t3crv.address,
            this.yax.address,
            ether('1'),
            1
        );
        this.controller = await StrategyControllerV2.new(this.vaultManager.address);
        this.harvester = await yAxisMetaVaultHarvester.new(
            this.vaultManager.address,
            this.controller.address
        );
        this.stableSwap3Pool = await MockStableSwap3Pool.new(
            this.dai.address,
            this.usdc.address,
            this.usdt.address,
            this.t3crv.address
        );
        this.converter = await StableSwap3PoolConverter.new(
            this.dai.address,
            this.usdc.address,
            this.usdt.address,
            this.t3crv.address,
            this.stableSwap3Pool.address,
            this.vaultManager.address
        );
        this.unirouter = await MockUniswapRouter.new(constants.ZERO_ADDRESS);

        // Strategy contract deployment
        this.strategy = await StrategyDforce.new(
            this.dai.address,
            this.dDai.address,
            this.dRewards.address,
            this.df.address,
            this.converter.address,
            this.controller.address,
            this.vaultManager.address,
            this.weth.address
        );

        // Protocol setup
        await this.vault.setConverter(this.converter.address);
        await this.vault.setVaultManager(this.vaultManager.address);
        await this.vault.setTreasuryWallet(treasury);
        await this.vault.setController(this.controller.address);
        await this.vaultManager.setVaultStatus(this.vault.address, true);
        await this.vaultManager.setControllerStatus(this.controller.address, true);
        await this.vaultManager.setTreasury(treasury);
        await this.vaultManager.setStakingPool(stakingPool);
        // await this.vaultManager.setWithdrawalProtectionFee(0);
        // await this.vaultManager.setStakingPoolShareFee(0);
        // await this.vaultManager.setTreasuryFee(0);
        await this.vaultManager.setHarvester(this.harvester.address);
        await this.harvester.setController(this.controller.address);
        await this.harvester.addStrategy(this.t3crv.address, this.strategy.address, 0);
        await this.harvester.setHarvester(deployer, true);
        await this.controller.setVault(this.t3crv.address, this.vault.address);
        await this.controller.setConverter(
            this.t3crv.address,
            this.dai.address,
            this.converter.address
        );
        await this.controller.addStrategy(this.t3crv.address, this.strategy.address, 0);
        await this.converter.setStrategy(this.strategy.address, true);
        await this.strategy.setUnirouter(this.unirouter.address);
        await this.strategy.approveForSpender(this.weth.address, this.unirouter.address, MAX);
        await this.strategy.approveForSpender(this.df.address, this.unirouter.address, MAX);

        // Fund addresses
        await this.yax.mint(this.vault.address, INIT_BALANCE);
        await this.dai.mint(this.stableSwap3Pool.address, INIT_BALANCE);
        await this.usdc.mint(this.stableSwap3Pool.address, '1000000000');
        await this.usdt.mint(this.stableSwap3Pool.address, '1000000000');
        await this.t3crv.mint(this.stableSwap3Pool.address, INIT_BALANCE);
        await this.yax.mint(this.unirouter.address, INIT_BALANCE);
        await this.weth.mint(this.unirouter.address, INIT_BALANCE);
        await this.dai.mint(this.unirouter.address, INIT_BALANCE);
        await this.usdc.mint(this.unirouter.address, INIT_BALANCE);
        await this.usdt.mint(this.unirouter.address, INIT_BALANCE);

        // Strategy-specific setup
        await this.df.mint(this.unirouter.address, INIT_BALANCE);
        await this.df.mint(this.dRewards.address, INIT_BALANCE);

        // Bob setup
        await this.dai.mint(bob, INIT_BALANCE);
        await this.usdc.mint(bob, '1000000000');
        await this.usdt.mint(bob, '1000000000');
        await this.t3crv.mint(bob, INIT_BALANCE);

        await this.dai.approve(this.vault.address, MAX, { from: bob });
        await this.usdc.approve(this.vault.address, MAX, { from: bob });
        await this.usdt.approve(this.vault.address, MAX, { from: bob });
        await this.t3crv.approve(this.vault.address, MAX, { from: bob });
        await this.vault.approve(this.vault.address, MAX, { from: bob });
    });

    this.printBalances = async (title) => {
        console.log(title);
        console.log(
            'vault 3CRV:     ',
            fromWei(await this.t3crv.balanceOf(this.vault.address))
        );
        console.log(
            'vault MVLT:     ',
            fromWei(await this.vault.balanceOf(this.vault.address))
        );
        console.log('vault Supply:   ', fromWei(await this.vault.totalSupply()));
        console.log('-------------------');
        console.log(
            'bob balances:    %s DAI/ %s USDC/ %s USDT/ %s 3CRV/ %s YAX',
            fromWei(await this.dai.balanceOf(bob)),
            fromWeiWithDecimals(await this.usdc.balanceOf(bob), 6),
            fromWeiWithDecimals(await this.usdt.balanceOf(bob), 6),
            fromWei(await this.t3crv.balanceOf(bob)),
            fromWei(await this.yax.balanceOf(bob))
        );
        console.log('bob staked:     ', fromWei((await this.vault.userInfo(bob)).amount));
        console.log('-------------------');
        console.log('stakingPool YAX:', fromWei(await this.yax.balanceOf(stakingPool)));
        console.log('treasury YAX:   ', fromWei(await this.yax.balanceOf(treasury)));
        console.log('-------------------');
    };

    beforeEach(async () => {
        if (verbose) {
            await this.printBalances('\n====== BEFORE ======');
        }
        assert.equal(0, await this.t3crv.balanceOf(this.controller.address));
        assert.equal(0, await this.t3crv.balanceOf(this.strategy.address));
        assert.equal(0, await this.dai.balanceOf(this.strategy.address));
    });

    afterEach(async () => {
        if (verbose) {
            await this.printBalances('\n====== AFTER ======');
        }
        assert.equal(0, await this.t3crv.balanceOf(this.controller.address));
        assert.equal(0, await this.t3crv.balanceOf(this.strategy.address));
        assert.equal(0, await this.dai.balanceOf(this.strategy.address));
    });

    it('should deploy with initial state set', async () => {
        // BaseStrategy
        assert.equal(this.dai.address, await this.strategy.want());
        assert.equal(this.weth.address, await this.strategy.weth());
        assert.equal(this.controller.address, await this.strategy.controller());
        assert.equal(this.vaultManager.address, await this.strategy.vaultManager());
        assert.equal(this.unirouter.address, await this.strategy.unirouter());

        // Implementation
        assert.equal(this.dDai.address, await this.strategy.dToken());
        assert.equal(this.dRewards.address, await this.strategy.pool());
        assert.equal(this.df.address, await this.strategy.DF());
        assert.equal(this.converter.address, await this.strategy.converter());
    });

    it('should deposit DAI', async () => {
        const _amount = ether('10');
        await this.vault.deposit(_amount, this.dai.address, 1, true, { from: bob });
        assert.equal(String(await this.dai.balanceOf(bob)), ether('990'));
        assert.isTrue((await this.controller.balanceOf(this.t3crv.address)).gt(ether('9')));
        assert.isTrue(ether('1').eq(await this.vault.getPricePerFullShare()));
    });

    it('should harvest', async () => {
        assert.isTrue(ether('1').eq(await this.vault.getPricePerFullShare()));
        assert.equal(0, await this.yax.balanceOf(stakingPool));
        assert.equal(0, await this.yax.balanceOf(treasury));
        await this.harvester.harvestNextStrategy(this.t3crv.address);
        assert.isTrue((await this.vault.getPricePerFullShare()).gt(ether('1')));
        assert.isTrue((await this.yax.balanceOf(stakingPool)).gte(ether('0.095')));
        assert.isTrue((await this.yax.balanceOf(treasury)).gte(ether('0.023')));
    });

    it('should withdraw to DAI', async () => {
        assert.isTrue(ether('10.02').eq((await this.vault.userInfo(bob)).amount));
        await this.vault.withdraw(ether('5'), this.dai.address, { from: bob });
        assert.isTrue(ether('5.02').eq((await this.vault.userInfo(bob)).amount));
        assert.isTrue((await this.dai.balanceOf(bob)).gte(ether('994.99')));
    });

    it('should withdrawAll to 3CRV', async () => {
        await this.vault.withdrawAll(this.t3crv.address, { from: bob });
        assert.equal(0, await this.vault.balanceOf(bob));
        assert.equal(0, await this.t3crv.balanceOf(this.controller.address));
        assert.equal(0, await this.t3crv.balanceOf(this.strategy.address));
        assert.equal(0, await this.vault.totalSupply());
        assert.isTrue((await this.t3crv.balanceOf(bob)).gte(ether('1005')));
    });

    it('should deposit USDT', async () => {
        const _amount = '10000000';
        assert.equal(0, await this.strategy.balanceOfPool());
        assert.equal(0, await this.controller.balanceOf(this.t3crv.address));
        await this.vault.deposit(_amount, this.usdt.address, 1, true, { from: bob });
        assert.isTrue((await this.strategy.balanceOfPool()).gt(ether('9')));
        assert.isTrue((await this.controller.balanceOf(this.t3crv.address)).gt(ether('9')));
        assert.isTrue((await this.vault.getPricePerFullShare()).gte(ether('1')));
    });

    it('should withdrawAll by controller', async () => {
        assert.equal(0, await this.t3crv.balanceOf(this.controller.address));
        assert.isTrue((await this.t3crv.balanceOf(this.vault.address)).lt(ether('1')));
        await this.controller.withdrawAll(this.strategy.address);
        assert.isTrue((await this.t3crv.balanceOf(this.vault.address)).gte(ether('9.99')));
    });
});
