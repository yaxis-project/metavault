const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { setupTestV3 } = require('../helpers/setup');

describe('Controller', () => {
    let deployer, treasury;
    let manager, controller, vault, dai, strategyCrv;

    beforeEach(async () => {
        const config = await setupTestV3(['NativeStrategyCurve3Crv']);
        [deployer, treasury, ,] = await ethers.getSigners();
        manager = config.manager;
        controller = config.controller;
        vault = config.stableVault;
        dai = config.dai;
        await manager.setGovernance(treasury.address);

        const StrategyCrv = await deployments.get('NativeStrategyCurve3Crv');
        strategyCrv = await ethers.getContractAt(
            'NativeStrategyCurve3Crv',
            StrategyCrv.address,
            deployer
        );
    });

    it('should deploy with expected state', async () => {
        expect(await controller.manager()).to.equal(manager.address);
        expect(await controller.globalInvestEnabled()).to.be.true;
        expect(await controller.maxStrategies()).to.equal(10);
    });

    describe('addStrategy', () => {
        it('should revert if the strategy is not allowed', async () => {
            await expect(
                controller.addStrategy(
                    vault.address,
                    dai.address,
                    strategyCrv.address,
                    0,
                    86400
                )
            ).to.be.revertedWith('!allowedStrategy');
        });

        context('when the strategy is allowed', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
            });

            it('should revert if there is no vault for the token', async () => {
                await expect(
                    controller.addStrategy(
                        vault.address,
                        dai.address,
                        strategyCrv.address,
                        0,
                        86400
                    )
                ).to.be.revertedWith('!_token');
            });

            context('when the token is added', () => {
                beforeEach(async () => {
                    await manager.connect(treasury).setAllowedToken(dai.address, true);
                    await manager.addToken(vault.address, dai.address);
                });

                it('should add the strategy', async () => {
                    await controller.addStrategy(
                        vault.address,
                        dai.address,
                        strategyCrv.address,
                        0,
                        86400
                    );
                });
            });
        });
    });
});
