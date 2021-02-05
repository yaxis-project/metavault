const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestMetavault } = require('../helpers/setup');

describe('BaseStrategy', () => {
    let strategy,
        deployer,
        user,
        insurancePool,
        yax,
        dai,
        t3crv,
        vault,
        vaultManager,
        harvester,
        controller,
        router;

    before(async () => {
        const config = await setupTestMetavault();
        deployer = config.deployer;
        user = await ethers.provider.getSigner(config.user);
        insurancePool = config.insurancePool;
        yax = config.yax;
        dai = config.dai;
        t3crv = config.t3crv;
        vaultManager = config.vaultManager;
        vault = config.vault;
        harvester = config.harvester;
        controller = config.controller;
        router = config.router;

        const Strategy = await deployments.get('StrategyCurve3Crv');
        strategy = await ethers.getContractAt('StrategyCurve3Crv', Strategy.address, deployer);

        await controller.addStrategy(
            t3crv.address,
            Strategy.address,
            0,
            ethers.constants.AddressZero,
            true,
            0,
            { from: deployer }
        );
        await vaultManager.setInsurancePool(insurancePool, { from: deployer });
        await vaultManager.setInsurancePoolFee(100, { from: deployer });
    });

    it('should not allow unpermissioned callers', async () => {
        await expect(
            strategy.connect(user).approveForSpender(yax.address, await user.getAddress(), 1)
        ).to.be.revertedWith('!governance');
        await expect(strategy.connect(user).setController(yax.address)).to.be.revertedWith(
            '!governance'
        );
        await expect(strategy.connect(user).setRouter(yax.address)).to.be.revertedWith(
            '!governance'
        );
        await expect(strategy.connect(user).deposit()).to.be.revertedWith('!authorized');
        await expect(strategy.connect(user).harvest()).to.be.revertedWith('!authorized');
        await expect(strategy.connect(user).skim()).to.be.revertedWith('!authorized');
        await expect(
            strategy.connect(user)['withdraw(uint256)'](ether('1'))
        ).to.be.revertedWith('!authorized');
        await expect(
            strategy.connect(user)['withdraw(address)'](yax.address)
        ).to.be.revertedWith('!authorized');
        await expect(strategy.connect(user).withdrawAll()).to.be.revertedWith('!authorized');
    });

    it('should approve tokens for spending', async () => {
        expect(await yax.allowance(strategy.address, deployer)).to.equal(0);
        await strategy.approveForSpender(yax.address, deployer, 1);
        expect(await yax.allowance(strategy.address, deployer)).to.equal(1);
    });

    it('should skim stuck tokens out of the strategy', async () => {
        await t3crv.transfer(strategy.address, 1);
        expect(await t3crv.balanceOf(strategy.address)).to.equal(1);
        await strategy.skim();
        expect(await t3crv.balanceOf(strategy.address)).to.equal(0);
        expect(await t3crv.balanceOf(controller.address)).to.equal(1);
    });

    it('should send the insurancePoolFee to the insurancePool', async () => {
        expect(await yax.balanceOf(insurancePool)).to.equal(0);
        await vault.connect(user).deposit(ether('10'), dai.address, 1, true);
        await harvester.harvestNextStrategy(t3crv.address);
        expect(await yax.balanceOf(insurancePool)).to.least(1);
    });

    it('should set the controller', async () => {
        expect(await strategy.controller()).to.equal(controller.address);
        await strategy.setController(deployer);
        expect(await strategy.controller()).to.equal(deployer);
    });

    it('should set the router', async () => {
        expect(await strategy.router()).to.equal(router.address);
        await strategy.setRouter(deployer);
        expect(await strategy.router()).to.equal(deployer);
    });
});
