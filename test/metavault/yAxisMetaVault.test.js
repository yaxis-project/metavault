const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { advanceBlocks, setupTestMetavault } = require('../helpers/setup');

describe('yAxisMetaVault', () => {
    let user, dai, usdc, usdt, t3crv, vault, yax;

    before(async () => {
        const config = await setupTestMetavault();
        user = config.user;
        dai = config.dai;
        usdc = config.usdc;
        usdt = config.usdt;
        t3crv = config.t3crv;
        yax = config.yax;
        const Vault = await deployments.get('yAxisMetaVault');
        vault = await ethers.getContractAt('yAxisMetaVault', Vault.address, user);
    });

    it('should deposit', async () => {
        const _amount = ether('10');
        await expect(
            vault.deposit(_amount, dai.address, ether('100'), true)
        ).to.be.revertedWith('slippage');
        await vault.deposit(_amount, dai.address, 1, true);
        expect(await dai.balanceOf(user)).to.equal(ether('990'));
    });

    it('should depositAll', async () => {
        const _amounts = ['0', '10000000', '10000000', ether('10')];
        await vault.depositAll(_amounts, 1, true);
        expect(await dai.balanceOf(user)).to.equal(ether('990'));
        expect(await usdc.balanceOf(user)).to.equal('990000000');
        expect(await usdt.balanceOf(user)).to.equal('990000000');
        expect(await t3crv.balanceOf(user)).to.equal(ether('990'));
    });

    it('should stakeShares', async () => {
        const _amount = '10000000';
        await vault.deposit(_amount, usdc.address, 1, false);
        const _shares = await vault.balanceOf(user);
        expect(_shares).to.equal(ether('9.995'));
        await vault.stakeShares(_shares, { from: user });
        const userInfo = await vault.userInfo(user);
        expect(userInfo.amount).to.equal(ether('50'));
    });

    it('should pendingYax', async () => {
        await advanceBlocks(10);
        expect(await vault.pendingYax(user)).to.equal(ether('8.6'));
    });

    it('should unstake(0) for getting reward', async () => {
        const before = await yax.balanceOf(user);
        await advanceBlocks(10);
        await vault.unstake(0);
        const after = await yax.balanceOf(user);
        expect(after).to.be.above(before);
    });

    it('should unstake', async () => {
        await vault.unstake(ether('20'));
        const userInfo = await vault.userInfo(user);
        expect(userInfo.amount).to.equal(ether('30'));
    });

    it('should withdraw T3CRV', async () => {
        const before = await t3crv.balanceOf(user);
        await vault.withdraw(ether('5'), t3crv.address);
        const after = await t3crv.balanceOf(user);
        expect(await vault.balanceOf(user)).to.equal(ether('15'));
        expect(after).to.be.above(before);
    });

    it('should withdraw DAI', async () => {
        const before = await dai.balanceOf(user);
        await vault.withdraw(ether('5'), dai.address);
        const after = await dai.balanceOf(user);
        expect(await vault.balanceOf(user)).to.equal(ether('10'));
        expect(after).to.be.above(before);
    });

    it('should withdraw USDT', async () => {
        const before = await usdt.balanceOf(user);
        await vault.withdraw(ether('5'), usdt.address);
        const after = await usdt.balanceOf(user);
        expect(await vault.balanceOf(user)).to.equal(ether('5'));
        expect(after).to.be.above(before);
    });

    it('should withdraw need unstake', async () => {
        const before = await usdc.balanceOf(user);
        await vault.withdraw(ether('10'), usdc.address);
        const after = await usdc.balanceOf(user);
        expect(await vault.balanceOf(user)).to.equal(ether('0'));
        expect((await vault.userInfo(user)).amount).to.equal(ether('25'));
        expect(after).to.be.above(before);
    });

    it('should withdrawAll to USDC', async () => {
        const _amount = '5000000';
        const before = await vault.balanceOf(user);
        await vault.deposit(_amount, usdc.address, 1, false);
        const after = await vault.balanceOf(user);
        const beforeWithdrawAll = await usdc.balanceOf(user);
        expect(after).to.be.above(before);
        await vault.withdrawAll(usdc.address);
        expect((await vault.userInfo(user)).amount).to.equal(0);
        expect(await vault.balanceOf(user)).to.equal(0);
        expect(await usdc.balanceOf(user)).to.be.above(beforeWithdrawAll);
    });
});
