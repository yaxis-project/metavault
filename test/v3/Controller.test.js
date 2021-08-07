const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Controller', () => {
    let deployer, treasury, user;
    let manager,
        controller,
        converter,
        vault,
        dai,
        t3crv,
        strategyCrv,
        harvester,
        unirouter,
        crv,
        weth,
        yax;

    beforeEach(async () => {
        await deployments.fixture(['v3']);
        [deployer, treasury, , user] = await ethers.getSigners();
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        const USDT = await deployments.get('USDT');
        const CRV = await deployments.deploy('CRV', {
            contract: 'MockERC20',
            from: deployer.address,
            args: ['Curve.fi', 'CRV', 18]
        });
        crv = await ethers.getContractAt('MockERC20', CRV.address);
        const WETH = await deployments.get('WETH');
        weth = await ethers.getContractAt('MockERC20', WETH.address);
        const YAX = await deployments.get('YaxisToken');
        yax = await ethers.getContractAt('MockERC20', YAX.address);
        converter = await deployments.get('StablesConverter');
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);
        const gauge = await deployments.deploy('MockCurveGauge', {
            from: deployer.address,
            args: [t3crv.address]
        });
        const minter = await deployments.deploy('MockCurveMinter', {
            from: deployer.address,
            args: [crv.address]
        });
        const router = await deployments.get('MockUniswapRouter');
        const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        unirouter = await ethers.getContractAt('MockUniswapRouter', router.address);

        const Vault = await deployments.deploy('Vault', {
            from: deployer.address,
            args: ['Vault: Stables', 'MV:S', manager.address]
        });
        vault = await ethers.getContractAt('Vault', Vault.address);

        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);

        const StrategyCrv = await deployments.deploy('NativeStrategyCurve3Crv', {
            from: deployer.address,
            args: [
                'Curve: 3CRV',
                T3CRV.address,
                CRV.address,
                WETH.address,
                DAI.address,
                USDC.address,
                USDT.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                Controller.address,
                Manager.address,
                unirouter.address
            ]
        });
        strategyCrv = await ethers.getContractAt(
            'NativeStrategyCurve3Crv',
            StrategyCrv.address,
            deployer
        );
    });

    it('should deploy with expected state', async () => {
        expect(await controller.manager()).to.be.equal(manager.address);
        expect(await controller.globalInvestEnabled()).to.be.true;
        expect(await controller.maxStrategies()).to.be.equal(10);
    });

    describe('addStrategy', () => {
        beforeEach(async () => {
            await controller.connect(deployer).setConverter(vault.address, converter.address);
        });

        it('should revert if the strategy is not allowed', async () => {
            await expect(
                controller.addStrategy(vault.address, strategyCrv.address, 0, 86400)
            ).to.be.revertedWith('!allowedStrategy');
        });

        context('when the strategy is allowed', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
            });

            it('should revert if called by an address other than the strategist', async () => {
                await expect(
                    controller
                        .connect(user)
                        .addStrategy(vault.address, strategyCrv.address, 0, 86400)
                ).to.be.revertedWith('!strategist');
            });

            context('when it is halted', () => {
                beforeEach(async () => {
                    await manager.connect(deployer).setHalted();
                });

                it('should revert', async () => {
                    await expect(
                        controller.addStrategy(vault.address, strategyCrv.address, 0, 86400)
                    ).to.be.revertedWith('halted');
                });
            });

            it('should add the strategy when called by the strategist', async () => {
                expect(controller.addStrategy(vault.address, strategyCrv.address, 0, 86400))
                    .to.emit(controller, 'StrategyAdded')
                    .withArgs(vault.address, strategyCrv.address, 0);
            });
        });
    });

    describe('inCaseStrategyGetStuck', () => {
        beforeEach(async () => {
            await dai.connect(user).faucet(1000);
            await dai.connect(user).transfer(strategyCrv.address, 1000);
            await manager.connect(treasury).setTreasury(treasury.address);
        });

        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller
                    .connect(user)
                    .inCaseStrategyGetStuck(strategyCrv.address, dai.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should get tokens from strategy', async () => {
            expect(await dai.balanceOf(treasury.address)).to.be.equal(0);
            await controller.inCaseStrategyGetStuck(strategyCrv.address, dai.address);
            expect(await dai.balanceOf(treasury.address)).to.be.equal(1000);
        });

        context('when it is halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should still get tokens from the strategy', async () => {
                expect(await dai.balanceOf(treasury.address)).to.be.equal(0);
                await controller.inCaseStrategyGetStuck(strategyCrv.address, dai.address);
                expect(await dai.balanceOf(treasury.address)).to.be.equal(1000);
            });
        });
    });

    describe('inCaseTokensGetStuck', () => {
        beforeEach(async () => {
            await dai.connect(user).faucet(1000);
            await dai.connect(user).transfer(controller.address, 1000);
            await manager.connect(treasury).setTreasury(treasury.address);
        });

        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller.connect(user).inCaseTokensGetStuck(dai.address, 1000)
            ).to.be.revertedWith('!strategist');
        });

        it('should get tokens from controller', async () => {
            expect(await dai.balanceOf(treasury.address)).to.be.equal(0);
            await controller.inCaseTokensGetStuck(dai.address, 1000);
            expect(await dai.balanceOf(treasury.address)).to.be.equal(1000);
        });

        context('when it is halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should still get tokens from the controller', async () => {
                expect(await dai.balanceOf(treasury.address)).to.be.equal(0);
                await controller.inCaseTokensGetStuck(dai.address, 1000);
                expect(await dai.balanceOf(treasury.address)).to.be.equal(1000);
            });
        });
    });

    describe('removeStrategy', () => {
        beforeEach(async () => {
            await controller.connect(deployer).setConverter(vault.address, converter.address);
            await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.addToken(vault.address, dai.address);
        });

        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller
                    .connect(user)
                    .removeStrategy(vault.address, strategyCrv.address, 86400)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert when strategy doesnt exist', async () => {
            await expect(controller.removeStrategy(vault.address, strategyCrv.address, 86400))
                .to.be.reverted;
        });

        context('when halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should revert', async () => {
                await expect(
                    controller.removeStrategy(vault.address, strategyCrv.address, 86400)
                ).to.be.revertedWith('halted');
            });
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await t3crv.connect(user).faucet(1000);
                await t3crv.connect(user).transfer(strategyCrv.address, 1000);
            });

            it('should remove the strategy and withdraw tokens', async () => {
                expect(await t3crv.balanceOf(controller.address)).to.be.equal(0);
                await expect(
                    controller.removeStrategy(vault.address, strategyCrv.address, 86400)
                )
                    .to.emit(controller, 'StrategyRemoved')
                    .withArgs(vault.address, strategyCrv.address);
                expect(await t3crv.balanceOf(controller.address)).to.be.equal(1000);
            });
        });
    });

    describe('reorderStrategies', () => {
        beforeEach(async () => {
            await controller.connect(deployer).setConverter(vault.address, converter.address);
        });

        it('should revert if not called by strategist', async () => {
            await expect(
                controller
                    .connect(user)
                    .reorderStrategies(vault.address, strategyCrv.address, strategyCrv.address)
            ).to.be.revertedWith('!strategist');
        });

        context('when it is halted', async () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should revert', async () => {
                await expect(
                    controller.reorderStrategies(
                        vault.address,
                        strategyCrv.address,
                        strategyCrv.address
                    )
                ).to.be.revertedWith('halted');
            });
        });

        context('when the vault is not allowed', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedVault(vault.address, false);
            });

            it('should revert', async () => {
                await expect(
                    controller.reorderStrategies(
                        vault.address,
                        strategyCrv.address,
                        strategyCrv.address
                    )
                ).to.be.revertedWith('!_vault');
            });
        });

        it('should revert if strategy isnt allowed', async () => {
            await expect(
                controller.reorderStrategies(
                    vault.address,
                    strategyCrv.address,
                    strategyCrv.address
                )
            ).to.be.revertedWith('!_strategy1');
        });

        context('when the strategy is allowed', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
            });

            it('should reorder the strategies', async () => {
                await expect(
                    controller.reorderStrategies(
                        vault.address,
                        strategyCrv.address,
                        strategyCrv.address
                    )
                )
                    .to.emit(controller, 'StrategiesReordered')
                    .withArgs(vault.address, strategyCrv.address, strategyCrv.address);
            });

            it('should revert if a strategy doesnt exist', async () => {
                await expect(
                    controller.reorderStrategies(
                        vault.address,
                        strategyCrv.address,
                        user.address
                    )
                ).to.be.reverted;
            });
        });
    });

    describe('setCap', () => {
        beforeEach(async () => {
            await controller.connect(deployer).setConverter(vault.address, converter.address);
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.connect(deployer).setController(vault.address, controller.address);
            await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.addToken(vault.address, dai.address);
        });

        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller
                    .connect(user)
                    .setCap(
                        vault.address,
                        strategyCrv.address,
                        10,
                        ethers.constants.AddressZero
                    )
            ).to.be.revertedWith('!strategist');
        });

        context('when halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should revert', async () => {
                await expect(
                    controller.setCap(
                        vault.address,
                        strategyCrv.address,
                        10,
                        ethers.constants.AddressZero
                    )
                ).to.be.revertedWith('halted');
            });
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await dai.connect(user).faucet(1000);
                await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
                await vault.connect(user).deposit(dai.address, 1000);
                await harvester
                    .connect(deployer)
                    .earn(strategyCrv.address, vault.address, dai.address);
            });

            it('should set the cap and withdraw excess tokens', async () => {
                expect(await dai.balanceOf(vault.address)).to.be.equal(50);
                await controller.setCap(vault.address, strategyCrv.address, 10, dai.address);
                expect(await dai.balanceOf(vault.address)).to.be.equal(989);
                expect(await t3crv.balanceOf(controller.address)).to.be.equal(0);
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
            });

            it('should set the cap and not withdraw excess tokens if no cap', async () => {
                expect(await dai.balanceOf(vault.address)).to.be.equal(50);
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
                await controller.setCap(vault.address, strategyCrv.address, 0, dai.address);
                expect(await dai.balanceOf(vault.address)).to.be.equal(50);
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
            });

            it('should set the cap and not withdraw excess tokens if balance below cap', async () => {
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
                await controller.setCap(
                    vault.address,
                    strategyCrv.address,
                    99999,
                    dai.address
                );
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
            });
        });
    });

    describe('setConverter', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller.connect(user).setConverter(vault.address, converter.address)
            ).to.be.revertedWith('!strategist');
        });

        context('when halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should revert', async () => {
                await expect(
                    controller.setConverter(vault.address, converter.address)
                ).to.be.revertedWith('halted');
            });
        });

        it('should set the converter', async () => {
            await controller.setConverter(vault.address, converter.address);
        });

        context('when converter is not allowed', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedConverter(converter.address, false);
            });

            it('should revert', async () => {
                await expect(
                    controller.setConverter(vault.address, converter.address)
                ).to.be.revertedWith('!allowedConverters');
            });
        });
    });

    describe('setInvestEnabled', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(controller.connect(user).setInvestEnabled(false)).to.be.revertedWith(
                '!strategist'
            );
        });

        context('when halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should revert', async () => {
                await expect(controller.setInvestEnabled(false)).to.be.revertedWith('halted');
            });
        });

        it('should set the invest enabled flag', async () => {
            expect(await controller.globalInvestEnabled()).to.be.true;
            await controller.setInvestEnabled(false);
            expect(await controller.globalInvestEnabled()).to.be.false;
        });
    });

    describe('setMaxStrategies', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(controller.connect(user).setMaxStrategies(1)).to.be.revertedWith(
                '!strategist'
            );
        });

        context('when halted', () => {
            beforeEach(async () => {
                await manager.setHalted();
            });

            it('should revert', async () => {
                await expect(controller.setMaxStrategies(1)).to.be.revertedWith('halted');
            });
        });

        it('should set the maximum number of strategies', async () => {
            expect(await controller.maxStrategies()).to.be.equal(10);
            await controller.setMaxStrategies(1);
            expect(await controller.maxStrategies()).to.be.equal(1);
        });
    });

    describe('skim', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller.connect(user).skim(strategyCrv.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert when strategy is not allowed', async () => {
            await expect(controller.skim(strategyCrv.address)).to.be.revertedWith(
                '!allowedStrategy'
            );
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller
                    .connect(deployer)
                    .setConverter(vault.address, converter.address);
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await t3crv.connect(user).faucet(1000);
                await t3crv.connect(user).transfer(strategyCrv.address, 1000);
            });

            it('should skim', async () => {
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
                await controller.skim(strategyCrv.address);
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(1000);
            });

            context('when halted', () => {
                beforeEach(async () => {
                    await manager.setHalted();
                });

                it('should still skim', async () => {
                    expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
                    await controller.skim(strategyCrv.address);
                    expect(await t3crv.balanceOf(vault.address)).to.be.equal(1000);
                });
            });
        });
    });

    describe('withdrawAll', () => {
        it('should revert if called by an address other than the strategist', async () => {
            await expect(
                controller.connect(user).skim(strategyCrv.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert if strategy is not allowed', async () => {
            await expect(
                controller.withdrawAll(strategyCrv.address, dai.address)
            ).to.be.revertedWith('!allowedStrategy');
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller
                    .connect(deployer)
                    .setConverter(vault.address, converter.address);
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
                await manager.setController(vault.address, controller.address);
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await dai.connect(user).faucet(1000);
                await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
                await vault.connect(user).deposit(dai.address, 1000);
                await harvester.earn(strategyCrv.address, vault.address, dai.address);
            });

            it('should withdraw tokens sent directly', async () => {
                await t3crv.connect(user).faucet(50);
                await t3crv.connect(user).transfer(strategyCrv.address, 50);
                expect(await dai.balanceOf(vault.address)).to.be.equal(50);
                await controller.withdrawAll(strategyCrv.address, dai.address);
                expect(await dai.balanceOf(vault.address)).to.be.equal(1048);
            });

            it('should withdraw tokens deposited', async () => {
                expect(await t3crv.balanceOf(vault.address)).to.be.equal(0);
                await controller.withdrawAll(strategyCrv.address, dai.address);
                expect(await dai.balanceOf(vault.address)).to.at.least(950);
            });
        });
    });

    describe('harvestStrategy', () => {
        it('should revert if called by an address other than the harvester', async () => {
            await expect(
                controller.connect(user).harvestStrategy(strategyCrv.address, 1, 1)
            ).to.be.revertedWith('!harvester');
        });

        it('should revert if strategy is not allowed', async () => {
            await expect(
                harvester.harvest(controller.address, strategyCrv.address, 0, 0)
            ).to.be.revertedWith('!allowedStrategy');
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller
                    .connect(deployer)
                    .setConverter(vault.address, converter.address);
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
                await manager.setController(vault.address, controller.address);
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await dai.connect(user).faucet(1000000);
                await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
                await vault.connect(user).deposit(dai.address, 1000000);
                await harvester.earn(strategyCrv.address, vault.address, dai.address);

                await crv.faucet(ether('1000'));
                await weth.faucet(ether('2000'));
                await dai.faucet(ether('1000'));

                await crv.transfer(unirouter.address, ether('1000'));
                await dai.transfer(unirouter.address, ether('1000'));
                await weth.transfer(unirouter.address, ether('2000'));
                await yax.connect(deployer).transfer(unirouter.address, ether('1000'));
            });

            it('should harvest', async () => {
                await expect(harvester.harvest(controller.address, strategyCrv.address, 0, 0))
                    .to.emit(controller, 'Harvest')
                    .withArgs(strategyCrv.address);
            });
        });
    });

    describe('earn', () => {
        it('should revert if strategy is not allowed', async () => {
            await expect(
                controller.earn(strategyCrv.address, dai.address, 0)
            ).to.be.revertedWith('!allowedStrategy');
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller
                    .connect(deployer)
                    .setConverter(vault.address, converter.address);
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.connect(treasury).setAllowedToken(t3crv.address, true);
                await manager.addToken(vault.address, dai.address);
                await manager.addToken(vault.address, t3crv.address);
                await manager.setController(vault.address, controller.address);
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await dai.connect(user).faucet(1000);
                await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
                await vault.connect(user).deposit(dai.address, 1000);

                await t3crv.connect(user).faucet(1000);
                await t3crv.connect(user).approve(vault.address, ethers.constants.MaxUint256);
                await vault.connect(user).deposit(t3crv.address, 1000);
            });

            it('should revert if called by an address other than the vault', async () => {
                await expect(
                    controller.connect(user).earn(strategyCrv.address, dai.address, 0)
                ).to.be.revertedWith('!vault');
            });

            it('should earn with want token', async () => {
                await expect(harvester.earn(strategyCrv.address, vault.address, t3crv.address))
                    .to.emit(controller, 'Earn')
                    .withArgs(t3crv.address, strategyCrv.address);
            });

            it('should earn with something other than want token', async () => {
                await expect(harvester.earn(strategyCrv.address, vault.address, dai.address))
                    .to.emit(controller, 'Earn')
                    .withArgs(dai.address, strategyCrv.address);
            });
        });
    });

    describe('withdraw', () => {
        it('should revert if called by an address other than the vault', async () => {
            await expect(controller.connect(user).withdraw(dai.address, 0)).to.be.revertedWith(
                '!vault'
            );
        });

        context('when strategy exists', () => {
            beforeEach(async () => {
                await controller
                    .connect(deployer)
                    .setConverter(vault.address, converter.address);
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
                await manager.setController(vault.address, controller.address);
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
                await dai.connect(user).faucet(1000);
                await dai.connect(user).approve(vault.address, ethers.constants.MaxUint256);
                await vault.connect(user).deposit(dai.address, 1000);
            });

            it('should withdraw from vault', async () => {
                expect(await dai.balanceOf(user.address)).to.be.equal(0);
                await vault.connect(user).withdraw(1000, dai.address);
                expect(await dai.balanceOf(user.address)).to.be.at.least(999);
            });

            it('should withdraw from strategies', async () => {
                await harvester
                    .connect(deployer)
                    .earn(strategyCrv.address, vault.address, dai.address);
                expect(await dai.balanceOf(user.address)).to.be.equal(0);
                await vault.connect(user).withdraw(1000, dai.address);
                expect(await dai.balanceOf(user.address)).to.be.at.least(998);
            });

            // TODO: Can be tested with multiple strategies?
            // TODO: Can be tested with _want != _token?
        });
    });

    describe('getCap', () => {
        beforeEach(async () => {
            await controller.connect(deployer).setConverter(vault.address, converter.address);
            await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.addToken(vault.address, dai.address);
            await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
        });

        it('should get the correct cap', async () => {
            expect(await controller.getCap(vault.address, strategyCrv.address)).to.be.equal(0);
            await controller.setCap(vault.address, strategyCrv.address, 123, dai.address);
            expect(await controller.getCap(vault.address, strategyCrv.address)).to.be.equal(
                123
            );
        });
    });

    describe('getCap', () => {
        it('should always return false if globally disabled', async () => {
            await controller.setInvestEnabled(false);
            expect(await controller.investEnabled()).to.be.false;
        });
    });
});
