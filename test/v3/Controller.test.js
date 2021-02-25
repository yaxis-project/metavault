const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers } = hardhat;
const { setupTestV3 } = require('../helpers/setup');

describe('Controller', () => {
    let treasury;
    let manager, controller;

    beforeEach(async () => {
        const config = await setupTestV3();
        [, treasury, ,] = await ethers.getSigners();
        manager = config.manager;
        controller = config.controller;
        await manager.setGovernance(treasury.address);
    });

    it('should deploy with expected state', async () => {
        expect(await controller.manager()).to.equal(manager.address);
        expect(await controller.globalInvestEnabled()).to.be.true;
        expect(await controller.maxStrategies()).to.equal(10);
    });
});
