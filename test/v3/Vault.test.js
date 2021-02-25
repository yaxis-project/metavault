const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestV3 } = require('../helpers/setup');

describe('Vault', () => {
    let deployer, treasury, user;
    let dai, usdc, usdt, vault, manager, controller, depositor;

    beforeEach(async () => {
        const config = await setupTestV3();
        [deployer, treasury, , user] = await ethers.getSigners();
        dai = config.dai;
        usdc = config.usdc;
        usdt = config.usdt;
        manager = config.manager;
        controller = config.controller;
        vault = config.stableVault;
        await manager.setGovernance(treasury.address);

        const Depositor = await deployments.deploy('Depositor', {
            from: user.address,
            args: [vault.address]
        });
        depositor = await ethers.getContractAt('Depositor', Depositor.address, user);
    });

    it('should deploy with expected state', async () => {
        expect(await vault.manager()).to.equal(manager.address);
        expect(await vault.min()).to.equal(9500);
        expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
        expect(await vault.withdrawFee(ether('1'))).to.equal(ether('0.001'));
    });

    describe('setMin', () => {
        it('should revert when called by an address other than strategist', async () => {
            expect(await vault.min()).to.equal(9500);
            await expect(vault.setMin(9000)).to.be.revertedWith('!strategist');
            expect(await vault.min()).to.equal(9500);
        });

        it('should set the min when called by the strategist', async () => {
            expect(await vault.min()).to.equal(9500);
            await vault.connect(deployer).setMin(9000);
            expect(await vault.min()).to.equal(9000);
        });
    });

    describe('setTotalDepositCap', () => {
        it('should revert when called by an address other than strategist', async () => {
            expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
            await expect(vault.setTotalDepositCap(0)).to.be.revertedWith('!strategist');
            expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
        });

        it('should set the total deposit cap when called by the strategist', async () => {
            expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
            await vault.connect(deployer).setTotalDepositCap(0);
            expect(await vault.totalDepositCap()).to.equal(0);
        });
    });

    describe('earn', () => {
        it('should revert when called by an address other than the harvester', async () => {
            await expect(vault.earn(ethers.constants.AddressZero)).to.be.revertedWith(
                '!harvester'
            );
        });

        it('should revert when the token is not added', async () => {
            await expect(
                vault.connect(deployer).earn(ethers.constants.AddressZero)
            ).to.be.revertedWith('!_token');
        });
    });

    describe('deposit', () => {
        it('should revert when the vault is not set up', async () => {
            await expect(vault.deposit(dai.address, 1)).to.be.revertedWith('!_token');
        });

        context('when the vault is set up', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.connect(treasury).setAllowedVault(vault.address, true);
                await manager.connect(treasury).setAllowedController(controller.address, true);
                await manager.setController(vault.address, controller.address);
                await expect(manager.addToken(vault.address, dai.address))
                    .to.emit(manager, 'TokenAdded')
                    .withArgs(vault.address, dai.address);
                expect((await vault.getTokens()).length).to.equal(1);
            });

            it('should revert if the token is not approved for the vault to spend', async () => {
                await expect(
                    vault.deposit(dai.address, ether('100000000'))
                ).to.be.revertedWith('!spender');
            });

            it('should revert if the deposit amount is greater than the total deposit cap', async () => {
                await dai.approve(vault.address, ether('100000000'));
                await expect(
                    vault.deposit(dai.address, ether('100000000'))
                ).to.be.revertedWith('>totalDepositCap');
            });

            it('should revert when the amount is 0', async () => {
                await expect(vault.deposit(dai.address, 0)).to.be.revertedWith('!_amount');
            });

            it('should deposit', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(vault.deposit(dai.address, ether('1000')))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
                expect(await vault.balanceOf(user.address)).to.equal(ether('1000'));
                expect(await vault.totalSupply()).to.equal(ether('1000'));
            });

            context('when depositing multiple times', () => {
                beforeEach(async () => {
                    await dai.approve(vault.address, ether('100000000'));
                    await expect(vault.deposit(dai.address, ether('1000')))
                        .to.emit(vault, 'Deposit')
                        .withArgs(user.address, ether('1000'));
                    expect(await vault.balanceOf(user.address)).to.equal(ether('1000'));
                    expect(await vault.totalSupply()).to.equal(ether('1000'));
                });

                it('should grant additional shares', async () => {
                    await expect(vault.deposit(dai.address, ether('1000')))
                        .to.emit(vault, 'Deposit')
                        .withArgs(user.address, ether('1000'));
                    expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                    expect(await vault.totalSupply()).to.equal(ether('2000'));
                });
            });

            context('when depositing from a contract', () => {
                beforeEach(async () => {
                    await dai.transfer(depositor.address, ether('1000'));
                });

                it('should revert if not allowed', async () => {
                    await expect(
                        depositor.depositVault(dai.address, ether('1000'))
                    ).to.be.revertedWith('!allowedContracts');
                });

                it('should deposit if allowed', async () => {
                    await manager
                        .connect(treasury)
                        .setAllowedContract(depositor.address, true);
                    await expect(depositor.depositVault(dai.address, ether('1000')))
                        .to.emit(vault, 'Deposit')
                        .withArgs(depositor.address, ether('1000'));
                    expect(await vault.balanceOf(depositor.address)).to.equal(ether('1000'));
                    expect(await vault.totalSupply()).to.equal(ether('1000'));
                });
            });
        });
    });

    describe('depositAll', () => {
        it('should revert when the vault is not set up', async () => {
            await expect(vault.depositAll([dai.address], [1])).to.be.revertedWith('!vault');
        });

        context('when the vault is set up', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.connect(treasury).setAllowedToken(usdc.address, true);
                await manager.connect(treasury).setAllowedVault(vault.address, true);
                await manager.connect(treasury).setAllowedController(controller.address, true);
                await manager.setController(vault.address, controller.address);
                await expect(manager.addToken(vault.address, dai.address))
                    .to.emit(manager, 'TokenAdded')
                    .withArgs(vault.address, dai.address);
                await expect(manager.addToken(vault.address, usdc.address))
                    .to.emit(manager, 'TokenAdded')
                    .withArgs(vault.address, usdc.address);
                expect((await vault.getTokens()).length).to.equal(2);
                expect(await manager.tokens(vault.address, 0)).to.equal(dai.address);
                expect(await manager.tokens(vault.address, 1)).to.equal(usdc.address);
            });

            it('should revert when a token is not added', async () => {
                await expect(
                    vault.depositAll([dai.address, usdt.address], [1, 1])
                ).to.be.revertedWith('!_tokens');
            });

            it('should revert if the deposit amount is greater than the total deposit cap', async () => {
                await dai.approve(vault.address, ether('100000000'));
                await expect(
                    vault.depositAll([dai.address, usdt.address], [ether('100000000'), 1])
                ).to.be.revertedWith('>totalDepositCap');
            });

            it('should revert if the input lengths do not match', async () => {
                await dai.approve(vault.address, ether('100000000'));
                await expect(
                    vault.depositAll([dai.address], [ether('100000000'), 1])
                ).to.be.revertedWith('!length');
            });

            it('should deposit single token', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(vault.depositAll([dai.address], [ether('1000')]))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
                expect(await vault.balanceOf(user.address)).to.equal(ether('1000'));
                expect(await vault.totalSupply()).to.equal(ether('1000'));
            });

            it('should deposit multiple tokens', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(
                    vault.depositAll(
                        [dai.address, usdc.address],
                        [ether('1000'), '1000000000']
                    )
                )
                    // Deposit is actually emitted multiple times
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
                expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                expect(await vault.totalSupply()).to.equal(ether('2000'));
            });

            context('when depositing multiple tokens multiple times', () => {
                beforeEach(async () => {
                    expect(await vault.balanceOf(user.address)).to.equal(0);
                    await expect(
                        vault.depositAll(
                            [dai.address, usdc.address],
                            [ether('1000'), '1000000000']
                        )
                    )
                        .to.emit(vault, 'Deposit')
                        .withArgs(user.address, ether('1000'));
                    expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                    expect(await vault.totalSupply()).to.equal(ether('2000'));
                });

                it('should grant additional shares', async () => {
                    await dai.approve(vault.address, ether('1000'));
                    await usdc.approve(vault.address, '1000000000');
                    await expect(
                        vault.depositAll(
                            [dai.address, usdc.address],
                            [ether('1000'), '1000000000']
                        )
                    )
                        .to.emit(vault, 'Deposit')
                        .withArgs(user.address, ether('1000'));
                    expect(await vault.balanceOf(user.address)).to.equal(ether('4000'));
                    expect(await vault.totalSupply()).to.equal(ether('4000'));
                });
            });

            context('when depositing from a contract', () => {
                beforeEach(async () => {
                    await dai.transfer(depositor.address, ether('1000'));
                    await usdc.transfer(depositor.address, '1000000000');
                });

                it('should revert if not allowed', async () => {
                    await expect(
                        depositor.depositAllVault(
                            [dai.address, usdc.address],
                            [ether('1000'), '1000000000']
                        )
                    ).to.be.revertedWith('!allowedContracts');
                });

                it('should deposit if allowed', async () => {
                    await manager
                        .connect(treasury)
                        .setAllowedContract(depositor.address, true);
                    await expect(
                        depositor.depositAllVault(
                            [dai.address, usdc.address],
                            [ether('1000'), '1000000000']
                        )
                    )
                        .to.emit(vault, 'Deposit')
                        .withArgs(depositor.address, ether('1000'));
                    expect(await vault.balanceOf(depositor.address)).to.equal(ether('2000'));
                    expect(await vault.totalSupply()).to.equal(ether('2000'));
                });
            });
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.setController(vault.address, controller.address);
            await expect(manager.addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            expect((await vault.getTokens()).length).to.equal(1);
        });

        it('should revert if the output token is not added', async () => {
            await expect(vault.withdraw(0, usdc.address)).to.be.revertedWith('!_token');
        });

        it('should revert if there are no deposits', async () => {
            await expect(vault.withdraw(1, dai.address)).to.be.revertedWith(
                'SafeMath: division by zero'
            );
        });

        context('when users have deposited', () => {
            beforeEach(async () => {
                await expect(vault.deposit(dai.address, ether('1000')))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
            });

            it('should revert if withdrawing more than the balance', async () => {
                await expect(vault.withdraw(ether('1001'), dai.address)).to.be.revertedWith(
                    'ERC20: burn amount exceeds balance'
                );
            });

            it('should withdraw partial amounts', async () => {
                await expect(vault.withdraw(ether('100'), dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('99.9'));
            });

            it('should withdraw the full amount', async () => {
                await expect(vault.withdraw(ether('1000'), dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('999'));
            });
        });
    });

    describe('withdrawAll', () => {
        beforeEach(async () => {
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.setController(vault.address, controller.address);
            await expect(manager.addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            expect((await vault.getTokens()).length).to.equal(1);
        });

        it('should revert if the output token is not added', async () => {
            await expect(vault.withdrawAll(usdc.address)).to.be.revertedWith('!_token');
        });

        it('should revert if there are no deposits', async () => {
            await expect(vault.withdrawAll(dai.address)).to.be.revertedWith(
                'SafeMath: division by zero'
            );
        });

        context('when users have deposited', () => {
            beforeEach(async () => {
                await expect(vault.deposit(dai.address, ether('1000')))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
            });

            it('should withdraw the full amount', async () => {
                await expect(vault.withdrawAll(dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('999'));
            });
        });
    });
});
