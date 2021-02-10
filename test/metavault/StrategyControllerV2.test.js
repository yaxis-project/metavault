const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestMetavault } = require('../helpers/setup');

describe('StrategyControllerV2', () => {
    let deployer,
        user,
        dai,
        t3crv,
        vault,
        controller,
        converter,
        strategyCurve3Crv,
        strategyPickle3Crv;

    before(async () => {
        const config = await setupTestMetavault();
        deployer = config.deployer;
        user = config.user;
        dai = config.dai;
        t3crv = config.t3crv;
        controller = config.controller;
        converter = config.converter;
        const Vault = await deployments.get('yAxisMetaVault');
        vault = await ethers.getContractAt('yAxisMetaVault', Vault.address, user);
        const StrategyCurve3Crv = await deployments.get('StrategyCurve3Crv');
        strategyCurve3Crv = await ethers.getContractAt(
            'StrategyCurve3Crv',
            StrategyCurve3Crv.address,
            deployer
        );
        const StrategyPickle3Crv = await deployments.get('StrategyPickle3Crv');
        strategyPickle3Crv = await ethers.getContractAt(
            'StrategyPickle3Crv',
            StrategyPickle3Crv.address,
            deployer
        );
    });

    it('should deploy with expected state', async () => {
        expect(await vault.controller()).to.equal(controller.address);
        expect(await vault.token()).to.equal(t3crv.address);
        expect(await controller.vaults(t3crv.address)).to.equal(vault.address);
    });

    it('should not allow unpermissioned callers', async () => {
        const controllerFail = await ethers.getContractAt(
            'StrategyControllerV2',
            controller.address,
            user
        );
        await expect(controllerFail.setVault(user, user)).to.be.revertedWith('!strategist');
        await expect(controllerFail.removeStrategy(user, user, 0)).to.be.revertedWith(
            '!strategist'
        );
        await expect(
            controllerFail.addStrategy(user, user, 0, converter.address, false, 0)
        ).to.be.revertedWith('!governance');
        await expect(controllerFail.setVaultManager(user)).to.be.revertedWith('!governance');
        await expect(controllerFail.setCap(user, user, 0)).to.be.revertedWith('!strategist');
        await expect(controllerFail.setInvestEnabled(false)).to.be.revertedWith('!strategist');
        await expect(controllerFail.setMaxStrategies(5)).to.be.revertedWith('!strategist');
        await expect(controllerFail.withdrawAll(user)).to.be.revertedWith('!strategist');
        await expect(controllerFail.inCaseTokensGetStuck(user, 0)).to.be.revertedWith(
            '!strategist'
        );
        await expect(controllerFail.inCaseStrategyGetStuck(user, user)).to.be.revertedWith(
            '!strategist'
        );
        await expect(controllerFail.claimInsurance(user)).to.be.revertedWith('!governance');
        await expect(controllerFail.harvestStrategy(user)).to.be.revertedWith('!harvester');
    });

    it('should add a strategy', async () => {
        await expect(
            controller.addStrategy(
                t3crv.address,
                strategyCurve3Crv.address,
                0,
                converter.address,
                true,
                0
            )
        )
            .to.emit(controller, 'StrategyAdded')
            .withArgs(t3crv.address, strategyCurve3Crv.address, 0);
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(1);
        expect(strategyCurve3Crv.address).to.equal(strategies[0]);
        expect(await controller.getBestStrategyEarn(t3crv.address, ether('1'))).to.equal(
            strategyCurve3Crv.address
        );
    });

    it('should deposit into first strategy', async () => {
        const _amount = ether('10');
        await expect(
            vault.deposit(_amount, dai.address, ether('100'), true)
        ).to.be.revertedWith('slippage');
        expect(await controller.balanceOf(t3crv.address)).to.equal(0);
        await expect(vault.deposit(_amount, dai.address, 1, true))
            .to.emit(controller, 'Earn')
            .withArgs(strategyCurve3Crv.address);
        expect(await dai.balanceOf(user)).to.equal(ether('990'));
    });

    it('should obey maximum strategies amount', async () => {
        await controller.setMaxStrategies(1);
        await expect(
            controller.addStrategy(
                t3crv.address,
                strategyPickle3Crv.address,
                ether('10'),
                converter.address,
                true,
                0
            )
        ).to.be.revertedWith('!maxStrategies');
        await controller.setMaxStrategies(10);
    });

    it('should add an additional strategy', async () => {
        await controller.addStrategy(
            t3crv.address,
            strategyPickle3Crv.address,
            ether('10'),
            converter.address,
            true,
            0
        );
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(2);
        expect(strategyCurve3Crv.address).to.equal(strategies[0]);
        expect(strategyPickle3Crv.address).to.equal(strategies[1]);
        expect(await controller.getBestStrategyEarn(t3crv.address, ether('1'))).to.equal(
            strategyPickle3Crv.address
        );
    });

    it('should deposit into second strategy', async () => {
        await expect(vault.deposit(ether('1'), dai.address, 1, true))
            .to.emit(controller, 'Earn')
            .withArgs(strategyPickle3Crv.address);
        expect(await dai.balanceOf(user)).to.equal(ether('989'));
    });

    it('should reorder strategies', async () => {
        await expect(
            controller.reorderStrategies(
                t3crv.address,
                strategyCurve3Crv.address,
                strategyPickle3Crv.address
            )
        )
            .to.emit(controller, 'StrategiesReordered')
            .withArgs(t3crv.address, strategyCurve3Crv.address, strategyPickle3Crv.address);
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(2);
        expect(strategyPickle3Crv.address).to.equal(strategies[0]);
        expect(strategyCurve3Crv.address).to.equal(strategies[1]);
        await controller.reorderStrategies(
            t3crv.address,
            strategyPickle3Crv.address,
            strategyCurve3Crv.address
        );
    });

    it('should withdraw excess funds when reducing a strategy cap', async () => {
        const before = await strategyPickle3Crv.balanceOf();
        await controller.setCap(t3crv.address, strategyPickle3Crv.address, ether('1'));
        const after = await strategyPickle3Crv.balanceOf();
        expect(before).to.be.above(after);
    });

    it('should deposit into first strategy when cap of second is reached', async () => {
        expect(await controller.getBestStrategyEarn(t3crv.address, ether('1'))).to.equal(
            strategyCurve3Crv.address
        );
        const _amount = ether('10');
        await expect(controller.earn(t3crv.address, _amount)).to.be.revertedWith('!vault');
        await expect(vault.deposit(_amount, dai.address, 1, true))
            .to.emit(controller, 'Earn')
            .withArgs(strategyCurve3Crv.address);
        expect(await dai.balanceOf(user)).to.equal(ether('979'));
    });

    it('should withdraw small amounts', async () => {
        const _amount = ether('5');
        const strategies = await controller.getBestStrategyWithdraw(t3crv.address, _amount);
        expect(strategyCurve3Crv.address).to.equal(strategies._strategies[0]);
        expect(ethers.constants.AddressZero).to.equal(strategies._strategies[1]);
        await expect(controller.withdraw(t3crv.address, _amount)).to.be.revertedWith('!vault');
        const before = await dai.balanceOf(user);
        await vault.withdraw(_amount, dai.address);
        const after = await dai.balanceOf(user);
        expect(after).to.be.above(before);
    });

    it('should deposit large amounts into a single strategy', async () => {
        const _amount = ether('50');
        const strategy = await controller.getBestStrategyEarn(t3crv.address, _amount);
        expect(strategyCurve3Crv.address).to.equal(strategy);
        const before = await dai.balanceOf(user);
        await expect(vault.deposit(_amount, dai.address, 1, true))
            .to.emit(controller, 'Earn')
            .withArgs(strategyCurve3Crv.address);
        const after = await dai.balanceOf(user);
        expect(before).to.be.above(after);
    });

    it('should withdraw large amounts from multiple strategies', async () => {
        const _amount = ether('86');
        const strategies = await controller.getBestStrategyWithdraw(t3crv.address, _amount);
        expect(strategyCurve3Crv.address).to.equal(strategies._strategies[0]);
        expect(strategyPickle3Crv.address).to.equal(strategies._strategies[1]);
        const before = await dai.balanceOf(user);
        await vault.withdraw(_amount, dai.address);
        const after = await dai.balanceOf(user);
        expect(after).to.be.above(before);
    });

    it('should remove strategies', async () => {
        await expect(controller.removeStrategy(t3crv.address, strategyPickle3Crv.address, 0))
            .to.emit(controller, 'StrategyRemoved')
            .withArgs(t3crv.address, strategyPickle3Crv.address);
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(1);
        expect(strategyCurve3Crv.address).to.equal(strategies[0]);
        expect(await controller.getBestStrategyEarn(t3crv.address, ether('1'))).to.equal(
            strategyCurve3Crv.address
        );
    });

    it('should deposit/earn to the remaining strategy', async () => {
        const before = await dai.balanceOf(user);
        await expect(vault.deposit(ether('5'), dai.address, 1, true))
            .to.emit(controller, 'Earn')
            .withArgs(strategyCurve3Crv.address);
        const after = await dai.balanceOf(user);
        expect(before).to.be.above(after);
    });

    it('should allow all strategies to be removed', async () => {
        await controller.removeStrategy(t3crv.address, strategyCurve3Crv.address, 0);
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(0);
    });

    it('should allow deposits without strategies', async () => {
        const before = await dai.balanceOf(user);
        await vault.deposit(ether('5'), dai.address, 1, true);
        const after = await dai.balanceOf(user);
        expect(before).to.be.above(after);
    });

    it('should earn to a newly added strategy', async () => {
        await controller.addStrategy(
            t3crv.address,
            strategyCurve3Crv.address,
            0,
            converter.address,
            true,
            0
        );
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(1);
        expect(strategyCurve3Crv.address).to.equal(strategies[0]);
        expect(await controller.getBestStrategyEarn(t3crv.address, ether('1'))).to.equal(
            strategyCurve3Crv.address
        );
        await expect(vault.earn())
            .to.emit(controller, 'Earn')
            .withArgs(strategyCurve3Crv.address);
    });

    it('should harvest strategy through controller', async () => {
        const before = await vault.getPricePerFullShare();
        await expect(controller.harvestStrategy(strategyCurve3Crv.address))
            .to.emit(controller, 'Harvest')
            .withArgs(strategyCurve3Crv.address);
        const after = await vault.getPricePerFullShare();
        expect(after).to.be.above(before);
    });
});
