const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('LegacyController', () => {
    let deployer, treasury, user;
    let dai, t3crv, usdc, usdt, vault, manager, metavault, controller, harvester, depositor;

    beforeEach(async () => {
        await deployments.fixture('v3');
        [deployer, treasury, , user] = await ethers.getSigners();
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);

        const Vault = await deployments.deploy('Vault', {
            from: deployer.address,
            args: ['Vault: Stables', 'MV:S', manager.address]
        });
        vault = await ethers.getContractAt('Vault', Vault.address);

        const Depositor = await deployments.deploy('Depositor', {
            from: user.address,
            args: [vault.address]
        });
        depositor = await ethers.getContractAt('Depositor', Depositor.address, user);

        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);
        await dai.connect(user).faucet(ethers.utils.parseEther('100000001'));
        await usdc.connect(user).faucet('100000000000000');
        await usdt.connect(user).faucet('100000000000000');
        await dai.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
        await usdc.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
        await usdt.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
        await t3crv.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
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
            await expect(vault.connect(user).setMin(9000)).to.be.revertedWith('!strategist');
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
            await expect(vault.connect(user).setTotalDepositCap(0)).to.be.revertedWith(
                '!strategist'
            );
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
            await expect(
                vault.connect(user).earn(ethers.constants.AddressZero)
            ).to.be.revertedWith('!harvester');
        });

        it('should revert when the token is not added', async () => {
            await expect(
                harvester.connect(deployer).earn(vault.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('!_token');
        });
    });

    describe('deposit', () => {
        it('should revert when the vault is not set up', async () => {
            const NewVault = await deployments.deploy('Vault', {
                from: deployer.address,
                args: ['Vault: Stables', 'MV:S2', manager.address]
            });
            const newVault = await ethers.getContractAt('Vault', NewVault.address);
            await dai.connect(user).approve(NewVault.address, ethers.utils.parseEther('1000'));
            await expect(
                newVault.connect(user).deposit([dai.address], [1])
            ).to.be.revertedWith('!vault');
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
                    vault.connect(user).deposit([dai.address, usdt.address], [1, 1])
                ).to.be.revertedWith('!_tokens');
            });

            it('should revert if the deposit amount is greater than the total deposit cap', async () => {
                await dai.connect(user).approve(vault.address, ether('100000001'));
                await expect(
                    vault.connect(user).deposit([dai.address], [ether('100000001')])
                ).to.be.revertedWith('>totalDepositCap');
            });

            it('should revert if the input lengths do not match', async () => {
                await dai.connect(user).approve(vault.address, ether('100000000'));
                await expect(
                    vault.connect(user).deposit([dai.address], [ether('100000000'), 1])
                ).to.be.revertedWith('!length');
            });

            it('should deposit single token', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(vault.connect(user).deposit([dai.address], [ether('1000')]))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
                expect(await vault.balanceOf(user.address)).to.equal(ether('1000'));
                expect(await vault.totalSupply()).to.equal(ether('1000'));
            });

            it('should deposit multiple tokens', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(
                    vault
                        .connect(user)
                        .deposit([dai.address, usdc.address], [ether('1000'), '1000000000'])
                )
                    // Deposit is actually emitted multiple times
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('2000'));
                expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                expect(await vault.totalSupply()).to.equal(ether('2000'));
            });

            context('when depositing multiple tokens multiple times', () => {
                beforeEach(async () => {
                    expect(await vault.balanceOf(user.address)).to.equal(0);
                    await expect(
                        vault
                            .connect(user)
                            .deposit(
                                [dai.address, usdc.address],
                                [ether('1000'), '1000000000']
                            )
                    )
                        .to.emit(vault, 'Deposit')
                        .withArgs(user.address, ether('2000'));
                    expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                    expect(await vault.totalSupply()).to.equal(ether('2000'));
                });

                it('should grant additional shares', async () => {
                    await dai.connect(user).approve(vault.address, ether('1000'));
                    await usdc.connect(user).approve(vault.address, '1000000000');
                    await expect(
                        vault
                            .connect(user)
                            .deposit(
                                [dai.address, usdc.address],
                                [ether('1000'), '1000000000']
                            )
                    )
                        .to.emit(vault, 'Deposit')
                        .withArgs(user.address, ether('2000'));
                    expect(await vault.balanceOf(user.address)).to.equal(ether('4000'));
                    expect(await vault.totalSupply()).to.equal(ether('4000'));
                });
            });

            context('when depositing from a contract', () => {
                beforeEach(async () => {
                    await dai.connect(user).transfer(depositor.address, ether('1000'));
                    await usdc.connect(user).transfer(depositor.address, '1000000000');
                });

                it('should deposit', async () => {
                    await expect(
                        depositor.depositVault(
                            [dai.address, usdc.address],
                            [ether('1000'), '1000000000']
                        )
                    )
                        .to.emit(vault, 'Deposit')
                        .withArgs(depositor.address, ether('2000'));
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
            await manager.connect(deployer).setController(vault.address, controller.address);
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
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
                await expect(vault.connect(user).deposit([dai.address], [ether('1000')]))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
            });

            it('should revert if withdrawing more than the balance', async () => {
                await expect(
                    vault.connect(user).withdraw(ether('1001'), dai.address)
                ).to.be.revertedWith('ERC20: burn amount exceeds balance');
            });

            it('should withdraw partial amounts', async () => {
                await expect(vault.connect(user).withdraw(ether('100'), dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('99.9'));
            });

            it('should withdraw the full amount', async () => {
                await expect(vault.connect(user).withdraw(ether('1000'), dai.address))
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
            await manager.connect(deployer).setController(vault.address, controller.address);
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            expect((await vault.getTokens()).length).to.equal(1);
        });

        it('should revert if the output token is not added', async () => {
            await expect(vault.connect(user).withdrawAll(usdc.address)).to.be.revertedWith(
                '!_token'
            );
        });

        it('should revert if there are no deposits', async () => {
            await expect(vault.connect(user).withdrawAll(dai.address)).to.be.revertedWith(
                'SafeMath: division by zero'
            );
        });

        context('when users have deposited', () => {
            beforeEach(async () => {
                await expect(vault.connect(user).deposit([dai.address], [ether('1000')]))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
            });

            it('should withdraw the full amount', async () => {
                await expect(vault.connect(user).withdrawAll(dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('999'));
            });
        });
    });
});
