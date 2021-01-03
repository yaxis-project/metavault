const { INIT_BALANCE, MAX, ether, verbose } = require('../helpers/common');
const {
    afterStrategySetup,
    beforeStrategySetup,
    printBalances
} = require('../helpers/harness');

const StrategyDforce = artifacts.require('StrategyDforce');
const MockERC20 = artifacts.require('MockERC20');
const MockDErc20 = artifacts.require('MockDErc20');
const MockDRewards = artifacts.require('MockDRewards');

contract('StrategyDforce', async (accounts) => {
    before(async () => {
        await beforeStrategySetup(accounts);

        globalThis.df = await MockERC20.new('dForce', 'DF', 18);
        globalThis.dDai = await MockDErc20.new('dForce DAI', 'dDAI', globalThis.dai.address);
        globalThis.dRewards = await MockDRewards.new(
            globalThis.dDai.address,
            globalThis.df.address,
            100
        );
        globalThis.strategy = await StrategyDforce.new(
            globalThis.dai.address,
            globalThis.dDai.address,
            globalThis.dRewards.address,
            globalThis.df.address,
            globalThis.converter.address,
            globalThis.controller.address,
            globalThis.vaultManager.address,
            globalThis.weth.address
        );
        await globalThis.strategy.approveForSpender(
            globalThis.df.address,
            globalThis.unirouter.address,
            MAX
        );
        await globalThis.df.mint(globalThis.unirouter.address, INIT_BALANCE);
        await globalThis.df.mint(globalThis.dRewards.address, INIT_BALANCE);

        await afterStrategySetup();
    });

    beforeEach(async () => {
        if (verbose) {
            await printBalances('\n====== BEFORE ======');
        }
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.controller.address));
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.strategy.address));
        assert.equal(0, await globalThis.dai.balanceOf(globalThis.strategy.address));
    });

    afterEach(async () => {
        if (verbose) {
            await printBalances('\n====== AFTER ======');
        }
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.controller.address));
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.strategy.address));
        assert.equal(0, await globalThis.dai.balanceOf(globalThis.strategy.address));
    });

    it('should deploy with initial state set', async () => {
        // BaseStrategy
        assert.equal(globalThis.dai.address, await globalThis.strategy.want());
        assert.equal(globalThis.weth.address, await globalThis.strategy.weth());
        assert.equal(globalThis.controller.address, await globalThis.strategy.controller());
        assert.equal(
            globalThis.vaultManager.address,
            await globalThis.strategy.vaultManager()
        );
        assert.equal(globalThis.unirouter.address, await globalThis.strategy.unirouter());

        // Implementation
        assert.equal(globalThis.dDai.address, await globalThis.strategy.dToken());
        assert.equal(globalThis.dRewards.address, await globalThis.strategy.pool());
        assert.equal(globalThis.df.address, await globalThis.strategy.DF());
        assert.equal(globalThis.converter.address, await globalThis.strategy.converter());
    });

    it('should deposit DAI', async () => {
        const _amount = ether('10');
        await globalThis.vault.deposit(_amount, globalThis.dai.address, 1, true, {
            from: globalThis.user
        });
        assert.equal(String(await globalThis.dai.balanceOf(globalThis.user)), ether('990'));
        assert.isTrue(
            (await globalThis.controller.balanceOf(globalThis.t3crv.address)).gt(ether('9'))
        );
        assert.isTrue(ether('1').gte(await globalThis.vault.getPricePerFullShare()));
    });

    it('should harvest', async () => {
        assert.equal(0, await globalThis.yax.balanceOf(globalThis.stakingPool));
        assert.equal(0, await globalThis.yax.balanceOf(globalThis.treasury));
        await globalThis.harvester.harvestNextStrategy(globalThis.t3crv.address);
        assert.isTrue((await globalThis.vault.getPricePerFullShare()).gt(ether('1')));
        assert.isTrue(
            (await globalThis.yax.balanceOf(globalThis.stakingPool)).gte(ether('0.095'))
        );
        assert.isTrue(
            (await globalThis.yax.balanceOf(globalThis.treasury)).gte(ether('0.023'))
        );
    });

    it('should withdraw to DAI', async () => {
        assert.isTrue(
            ether('10.02').eq((await globalThis.vault.userInfo(globalThis.user)).amount)
        );
        await globalThis.vault.withdraw(ether('5'), globalThis.dai.address, {
            from: globalThis.user
        });
        assert.isTrue(
            ether('5.02').eq((await globalThis.vault.userInfo(globalThis.user)).amount)
        );
        assert.isTrue((await globalThis.dai.balanceOf(globalThis.user)).gte(ether('994.99')));
    });

    it('should withdrawAll to 3CRV', async () => {
        await globalThis.vault.withdrawAll(globalThis.t3crv.address, {
            from: globalThis.user
        });
        assert.equal(0, await globalThis.vault.balanceOf(globalThis.user));
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.controller.address));
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.strategy.address));
        assert.equal(0, await globalThis.vault.totalSupply());
        assert.isTrue((await globalThis.t3crv.balanceOf(globalThis.user)).gte(ether('1005')));
    });

    it('should deposit USDT', async () => {
        const _amount = '10000000';
        assert.equal(0, await globalThis.strategy.balanceOfPool());
        assert.equal(0, await globalThis.controller.balanceOf(globalThis.t3crv.address));
        await globalThis.vault.deposit(_amount, globalThis.usdt.address, 1, true, {
            from: globalThis.user
        });
        assert.isTrue((await globalThis.strategy.balanceOfPool()).gt(ether('9')));
        assert.isTrue(
            (await globalThis.controller.balanceOf(globalThis.t3crv.address)).gt(ether('9'))
        );
        assert.isTrue((await globalThis.vault.getPricePerFullShare()).gte(ether('1')));
    });

    it('should withdrawAll by controller', async () => {
        assert.equal(0, await globalThis.t3crv.balanceOf(globalThis.controller.address));
        assert.isTrue(
            (await globalThis.t3crv.balanceOf(globalThis.vault.address)).lt(ether('1'))
        );
        await globalThis.controller.withdrawAll(globalThis.strategy.address);
        assert.isTrue(
            (await globalThis.t3crv.balanceOf(globalThis.vault.address)).gte(ether('9.99'))
        );
    });
});
