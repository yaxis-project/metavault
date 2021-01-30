const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { increaseTime, setupTestMetavault } = require('../helpers/setup');

describe('yAxisMetaVaultHarvester', () => {
    let deployer,
        user,
        t3crv,
        harvester,
        controller,
        vaultManager,
        strategyCurve3Crv,
        strategyDforce,
        strategyPickle3Crv;

    before(async () => {
        const config = await setupTestMetavault();
        deployer = config.deployer;
        user = config.user;
        t3crv = config.t3crv;
        controller = config.controller;
        vaultManager = config.vaultManager;
        harvester = config.harvester;
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
        const StrategyDforce = await deployments.get('StrategyDforce');
        strategyDforce = await ethers.getContractAt(
            'StrategyDforce',
            StrategyDforce.address,
            deployer
        );
    });

    it('should not allow unpermissioned callers', async () => {
        const harvesterFail = await ethers.getContractAt(
            'yAxisMetaVaultHarvester',
            harvester.address,
            user
        );
        await expect(harvesterFail.setController(controller.address)).to.be.revertedWith(
            '!strategist'
        );
        await expect(harvesterFail.setVaultManager(vaultManager.address)).to.be.revertedWith(
            '!strategist'
        );
        await expect(harvesterFail.setHarvester(user, true)).to.be.revertedWith('!strategist');
        await expect(
            harvesterFail.addStrategy(t3crv.address, strategyCurve3Crv.address, 0)
        ).to.be.revertedWith('!strategist');
        await expect(
            harvesterFail.harvest(controller.address, strategyCurve3Crv.address)
        ).to.be.revertedWith('!harvester');
        await expect(
            harvesterFail.removeStrategy(t3crv.address, strategyCurve3Crv.address, 300)
        ).to.be.revertedWith('!strategist');
    });

    it('should set the controller', async () => {
        await expect(harvester.setController(controller.address))
            .to.emit(harvester, 'ControllerSet')
            .withArgs(controller.address);
        expect(await harvester.controller()).to.equal(controller.address);
    });

    it('should set the vault manager', async () => {
        await expect(harvester.setVaultManager(vaultManager.address))
            .to.emit(harvester, 'VaultManagerSet')
            .withArgs(vaultManager.address);
        expect(await harvester.vaultManager()).to.equal(vaultManager.address);
    });

    it('should set harvesters', async () => {
        await expect(harvester.setHarvester(deployer, true))
            .to.emit(harvester, 'HarvesterSet')
            .withArgs(deployer, true);
        expect(await harvester.isHarvester(deployer)).to.be.true;
    });

    it('should add strategies', async () => {
        await expect(harvester.addStrategy(t3crv.address, strategyCurve3Crv.address, 0))
            .to.emit(harvester, 'StrategyAdded')
            .withArgs(t3crv.address, strategyCurve3Crv.address, 0);
    });

    it('should harvest added strategies', async () => {
        await expect(harvester.harvest(controller.address, strategyCurve3Crv.address))
            .to.emit(harvester, 'Harvest')
            .withArgs(controller.address, strategyCurve3Crv.address);
    });

    it('should add additional strategies', async () => {
        await expect(harvester.addStrategy(t3crv.address, strategyPickle3Crv.address, 300))
            .to.emit(harvester, 'StrategyAdded')
            .withArgs(t3crv.address, strategyPickle3Crv.address, 300);

        let strategies = await harvester.strategies(t3crv.address);
        expect(strategies.timeout).to.equal(300);
        expect(strategies.lastCalled).to.equal(0);
        let strategyAddresses = await harvester.strategyAddresses(t3crv.address);
        expect(strategyAddresses.length).to.equal(2);
        expect(strategyAddresses[0]).to.equal(strategyCurve3Crv.address);
        expect(strategyAddresses[1]).to.equal(strategyPickle3Crv.address);

        await expect(harvester.addStrategy(t3crv.address, strategyDforce.address, 600))
            .to.emit(harvester, 'StrategyAdded')
            .withArgs(t3crv.address, strategyDforce.address, 600);

        strategies = await harvester.strategies(t3crv.address);
        expect(strategies.timeout).to.equal(600);
        expect(strategies.lastCalled).to.equal(0);
        strategyAddresses = await harvester.strategyAddresses(t3crv.address);
        expect(strategyAddresses.length).to.equal(3);
        expect(strategyAddresses[0]).to.equal(strategyCurve3Crv.address);
        expect(strategyAddresses[1]).to.equal(strategyPickle3Crv.address);
        expect(strategyAddresses[2]).to.equal(strategyDforce.address);
    });

    it('should rotate harvesting strategies', async () => {
        await expect(harvester.harvestNextStrategy(t3crv.address))
            .to.emit(harvester, 'Harvest')
            .withArgs(controller.address, strategyCurve3Crv.address);

        const strategyAddresses = await harvester.strategyAddresses(t3crv.address);
        expect(strategyAddresses.length).to.equal(3);
        expect(strategyAddresses[0]).to.equal(strategyPickle3Crv.address);
        expect(strategyAddresses[1]).to.equal(strategyDforce.address);
        expect(strategyAddresses[2]).to.equal(strategyCurve3Crv.address);
    });

    it('should not allow harvestNextStrategy until timeout has passed', async () => {
        expect(await harvester.canHarvest(t3crv.address)).to.be.false;
        await expect(harvester.harvestNextStrategy(t3crv.address)).to.be.revertedWith(
            '!canHarvest'
        );

        await increaseTime(601);

        expect(await harvester.canHarvest(t3crv.address)).to.be.true;
        await expect(harvester.harvestNextStrategy(t3crv.address))
            .to.emit(harvester, 'Harvest')
            .withArgs(controller.address, strategyPickle3Crv.address);

        const strategyAddresses = await harvester.strategyAddresses(t3crv.address);
        expect(strategyAddresses.length).to.equal(3);
        expect(strategyAddresses[0]).to.equal(strategyDforce.address);
        expect(strategyAddresses[1]).to.equal(strategyCurve3Crv.address);
        expect(strategyAddresses[2]).to.equal(strategyPickle3Crv.address);
    });

    it('should remove strategies', async () => {
        await expect(harvester.removeStrategy(t3crv.address, user, 300)).to.be.revertedWith(
            '!found'
        );
        await expect(harvester.removeStrategy(t3crv.address, strategyDforce.address, 300))
            .to.emit(harvester, 'StrategyRemoved')
            .withArgs(t3crv.address, strategyDforce.address, 300);

        const strategyAddresses = await harvester.strategyAddresses(t3crv.address);
        expect(strategyAddresses.length).to.equal(2);
        expect(strategyAddresses[0]).to.equal(strategyPickle3Crv.address);
        expect(strategyAddresses[1]).to.equal(strategyCurve3Crv.address);
    });
});
