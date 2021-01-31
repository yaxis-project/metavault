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
    let dai, usdc, usdt, t3crv, vault, manager, controller;

    beforeEach(async () => {
        const config = await setupTestCanonical();
        dai = config.dai;
        usdc = config.usdc;
        usdt = config.usdt;
        t3crv = config.t3crv;
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

            it('should revert when adding the same token twice', async () => {
                await expect(
                    controller.addVaultToken(dai.address, vault.address)
                ).to.be.revertedWith('vault');
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

    describe('removeToken', () => {
        beforeEach(async () => {
            await expect(controller.addVaultToken(dai.address, vault.address))
                .to.emit(vault, 'TokenAdded')
                .withArgs(dai.address);
        });

        it('should revert when called by an address other than the controller', async () => {
            await expect(vault.removeToken(dai.address)).to.be.revertedWith('!controller');
        });

        it('should revert when the token does not exist', async () => {
            await expect(
                controller.removeVaultToken(usdc.address, vault.address)
            ).to.be.revertedWith('!vault');
        });

        it('should remove a token when called through the controller', async () => {
            await expect(controller.removeVaultToken(dai.address, vault.address))
                .to.emit(vault, 'TokenRemoved')
                .withArgs(dai.address);
            expect((await vault.getTokens()).length).to.equal(0);
        });

        context('when removing multiple tokens', () => {
            beforeEach(async () => {
                await expect(controller.addVaultToken(usdc.address, vault.address))
                    .to.emit(vault, 'TokenAdded')
                    .withArgs(usdc.address);
                await expect(controller.addVaultToken(usdt.address, vault.address))
                    .to.emit(vault, 'TokenAdded')
                    .withArgs(usdt.address);
                await expect(controller.addVaultToken(t3crv.address, vault.address))
                    .to.emit(vault, 'TokenAdded')
                    .withArgs(t3crv.address);
                expect((await vault.getTokens()).length).to.equal(4);
            });

            it('should remove tokens from the beginning', async () => {
                await expect(controller.removeVaultToken(dai.address, vault.address))
                    .to.emit(vault, 'TokenRemoved')
                    .withArgs(dai.address);
                expect((await vault.getTokens()).length).to.equal(3);
                expect(await vault.tokens(0)).to.equal(t3crv.address);
                expect(await vault.tokens(1)).to.equal(usdc.address);
                expect(await vault.tokens(2)).to.equal(usdt.address);
            });

            it('should remove tokens from the middle', async () => {
                await expect(controller.removeVaultToken(usdc.address, vault.address))
                    .to.emit(vault, 'TokenRemoved')
                    .withArgs(usdc.address);
                expect((await vault.getTokens()).length).to.equal(3);
                expect(await vault.tokens(0)).to.equal(dai.address);
                expect(await vault.tokens(1)).to.equal(t3crv.address);
                expect(await vault.tokens(2)).to.equal(usdt.address);
            });

            it('should remove tokens from the end', async () => {
                await expect(controller.removeVaultToken(t3crv.address, vault.address))
                    .to.emit(vault, 'TokenRemoved')
                    .withArgs(t3crv.address);
                expect((await vault.getTokens()).length).to.equal(3);
                expect(await vault.tokens(0)).to.equal(dai.address);
                expect(await vault.tokens(1)).to.equal(usdc.address);
                expect(await vault.tokens(2)).to.equal(usdt.address);
            });
        });
    });
});
