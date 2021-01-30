const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestCanonical } = require('../helpers/setup');

describe('CanonicalVault', () => {
    let user, dai, usdc, usdt, t3crv, vault, manager, controller, yax;

    beforeEach(async () => {
        const config = await setupTestCanonical();
        user = config.user;
        dai = config.dai;
        usdc = config.usdc;
        usdt = config.usdt;
        t3crv = config.t3crv;
        yax = config.yax;
        manager = config.manager;
        controller = config.controller;
        vault = config.stableVault;
    });

    it('should deploy with expected state', async () => {
        expect(await vault.manager()).to.equal(manager.address);
        expect(await vault.controller()).to.equal(controller.address);
        expect(await vault.min()).to.equal(9500);
        expect(await vault.earnLowerlimit()).to.equal(ether('500'));
        expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
    });
});
