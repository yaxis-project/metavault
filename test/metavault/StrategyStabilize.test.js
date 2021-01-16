const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTest } = require('../helpers/setup');

describe('StrategyStabilize', () => {
    let strategy,
        deployer,
        stakingPool,
        treasury,
        user,
        yax,
        dai,
        usdt,
        t3crv,
        weth,
        vault,
        vaultManager,
        harvester,
        controller,
        router;

    before(async () => {
        const config = await setupTest();
        deployer = config.deployer;
        stakingPool = config.stakingPool;
        treasury = config.treasury;
        user = config.user;
        yax = config.yax;
        dai = config.dai;
        usdt = config.usdt;
        t3crv = config.t3crv;
        weth = config.weth;
        vault = config.vault;
        vaultManager = config.vaultManager;
        harvester = config.harvester;
        controller = config.controller;
        router = config.router;

        const Strategy = await deployments.get('StrategyStabilize');
        strategy = await ethers.getContractAt('StrategyStabilize', Strategy.address, deployer);

        await harvester.addStrategy(t3crv.address, Strategy.address, 0, { from: deployer });
        await controller.addStrategy(t3crv.address, Strategy.address, 0, { from: deployer });
    });

    beforeEach(async () => {
        expect(await t3crv.balanceOf(controller.address)).to.equal(0);
        expect(await t3crv.balanceOf(strategy.address)).to.equal(0);
    });

    afterEach(async () => {
        expect(await t3crv.balanceOf(controller.address)).to.equal(0);
        expect(await t3crv.balanceOf(strategy.address)).to.equal(0);
    });

    it('should deploy with initial state set', async () => {
        expect(await strategy.want()).to.equal(dai.address);
        expect(await strategy.weth()).to.equal(weth.address);
        expect(await strategy.controller()).to.equal(controller.address);
        expect(await strategy.vaultManager()).to.equal(vaultManager.address);
        expect(await strategy.router()).to.equal(router.address);
    });

    it('should deposit DAI', async () => {
        await vault.deposit(ether('10'), dai.address, 1, true, { from: user });
        expect(await dai.balanceOf(user)).to.equal(ether('990'));
        expect(await controller.balanceOf(t3crv.address)).to.be.above(ether('9'));
        expect(await vault.getPricePerFullShare()).to.be.least(ether('0.99999'));
    });

    it('should harvest', async () => {
        expect(await yax.balanceOf(stakingPool)).to.equal(0);
        expect(await yax.balanceOf(treasury)).to.equal(0);
        await harvester.harvestNextStrategy(t3crv.address);
        expect(await vault.getPricePerFullShare()).to.be.above(ether('1'));
        expect(await yax.balanceOf(stakingPool)).to.be.least(ether('0.095'));
        expect(await yax.balanceOf(treasury)).to.be.least(ether('0.023'));
    });

    it('should withdraw to DAI', async () => {
        expect((await vault.userInfo(user)).amount).to.equal(ether('10.02'));
        await vault.withdraw(ether('5'), dai.address, { from: user });
        expect((await vault.userInfo(user)).amount).to.equal(ether('5.02'));
        expect(await dai.balanceOf(user)).to.be.least(ether('994.99'));
    });

    it('should withdrawAll to 3CRV', async () => {
        await vault.withdrawAll(t3crv.address, { from: user });
        expect(await vault.balanceOf(user)).to.equal(0);
        expect(await vault.totalSupply()).to.equal(0);
        expect(await t3crv.balanceOf(user)).to.be.least(ether('1005'));
    });

    it('should deposit USDT', async () => {
        await vault.deposit('10000000', usdt.address, 1, true, { from: user });
        expect(await strategy.balanceOfPool()).to.be.above(ether('9'));
        expect(await controller.balanceOf(t3crv.address)).to.be.above(ether('9'));
        expect(await vault.getPricePerFullShare()).to.be.least(ether('0.99999'));
    });

    it('should withdrawAll by controller', async () => {
        expect(await t3crv.balanceOf(vault.address)).to.be.below(ether('1'));
        await controller.withdrawAll(strategy.address);
        const fee = await strategy.calculateZPATokenWithdrawFee(ether('10'));
        expect(await t3crv.balanceOf(vault.address)).to.be.least(ether('9.99').sub(fee));
    });
});
