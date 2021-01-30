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
    let dai, usdc, vault, manager, controller;

    beforeEach(async () => {
        const config = await setupTestCanonical();
        dai = config.dai;
        usdc = config.usdc;
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
        expect((await vault.getTokens()).length).to.equal(0);
    });

    describe('addToken', () => {
        it('should revert when called by an address other than the controller', async () => {
            await expect(vault.addToken(dai.address)).to.be.revertedWith('!controller');
        });

        it('should add a token when called through the controller', async () => {
            await expect(controller.addVaultToken(dai.address, vault.address))
                .to.emit(vault, 'TokenAdded')
                .withArgs(dai.address);
            expect((await vault.getTokens()).length).to.equal(1);
            expect(await vault.tokens(0)).to.equal(dai.address);
        });

        context('when adding multiple tokens', () => {
            beforeEach(async () => {
                await expect(controller.addVaultToken(dai.address, vault.address))
                    .to.emit(vault, 'TokenAdded')
                    .withArgs(dai.address);
            });

            it('should append to the tokens', async () => {
                await expect(controller.addVaultToken(usdc.address, vault.address))
                    .to.emit(vault, 'TokenAdded')
                    .withArgs(usdc.address);
                expect((await vault.getTokens()).length).to.equal(2);
                expect(await vault.tokens(1)).to.equal(usdc.address);
            });
        });
    });
});
