const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTest } = require('../helpers/setup');

describe('yAxisMetaVaultManager', () => {
    let deployer,
        user,
        insurancePool,
        stakingPool,
        treasury,
        yax,
        harvester,
        controller,
        vault,
        vaultManager;

    before(async () => {
        const config = await setupTest();
        deployer = config.deployer;
        insurancePool = config.deployer;
        user = config.user;
        stakingPool = config.stakingPool;
        treasury = config.treasury;
        yax = config.yax;
        controller = config.controller;
        vault = config.vault;
        vaultManager = config.vaultManager;
        harvester = config.harvester;
    });

    it('should deploy with expected state', async () => {
        expect(await vaultManager.yax()).to.equal(yax.address);
        expect(await vaultManager.governance()).to.equal(deployer);
        expect(await vaultManager.strategist()).to.equal(deployer);
        expect(await vaultManager.harvester()).to.equal(harvester.address);
        expect(await vaultManager.stakingPoolShareFee()).to.equal(2000);
        expect(await vaultManager.treasuryBalance()).to.equal(ether('20000'));
        expect(await vaultManager.treasuryFee()).to.equal(500);
        expect(await vaultManager.withdrawalProtectionFee()).to.equal(10);
        const feeInfo = await vaultManager.getHarvestFeeInfo();
        expect(feeInfo[0]).to.equal(yax.address);
        expect(feeInfo[1]).to.equal(stakingPool);
        expect(feeInfo[2]).to.equal(2000);
        expect(feeInfo[3]).to.equal(treasury);
        expect(feeInfo[4]).to.equal(500);
        expect(feeInfo[5]).to.equal(ethers.constants.AddressZero);
        expect(feeInfo[6]).to.equal(0);
    });

    it('should not allow unpermissioned callers', async () => {
        const vaultManagerFail = await ethers.getContractAt(
            'yAxisMetaVaultManager',
            vaultManager.address,
            user
        );
        await expect(vaultManagerFail.setInsuranceFee(1)).to.be.revertedWith('!governance');
        await expect(vaultManagerFail.setInsurancePool(insurancePool)).to.be.revertedWith(
            '!governance'
        );
        await expect(vaultManagerFail.setInsurancePoolFee(1)).to.be.revertedWith(
            '!governance'
        );
        await expect(vaultManagerFail.setStakingPool(stakingPool)).to.be.revertedWith(
            '!governance'
        );
        await expect(vaultManagerFail.setStakingPoolShareFee(1)).to.be.revertedWith(
            '!governance'
        );
        await expect(vaultManagerFail.setTreasury(treasury)).to.be.revertedWith('!governance');
        await expect(vaultManagerFail.setTreasuryBalance(1)).to.be.revertedWith('!governance');
        await expect(vaultManagerFail.setTreasuryFee(1)).to.be.revertedWith('!governance');
        await expect(vaultManagerFail.setWithdrawalProtectionFee(1)).to.be.revertedWith(
            '!governance'
        );
        await expect(vaultManagerFail.setYax(user)).to.be.revertedWith('!governance');
        await expect(vaultManagerFail.setStrategist(user)).to.be.revertedWith('!governance');
        await expect(vaultManagerFail.setGovernance(user)).to.be.revertedWith('!governance');
        await expect(
            vaultManagerFail.governanceRecoverUnsupported(user, 0, user)
        ).to.be.revertedWith('!governance');
        await expect(
            vaultManagerFail.setControllerStatus(controller.address, false)
        ).to.be.revertedWith('!strategist');
        await expect(vaultManagerFail.setHarvester(user)).to.be.revertedWith('!strategist');
        await expect(vaultManagerFail.setVaultStatus(vault.address, false)).to.be.revertedWith(
            '!strategist'
        );
    });

    it('should set the insurance fee', async () => {
        expect(await vaultManager.insuranceFee()).to.equal(0);
        await vaultManager.setInsuranceFee(1);
        expect(await vaultManager.insuranceFee()).to.equal(1);
    });

    it('should set the insurance pool', async () => {
        expect(await vaultManager.insurancePool()).to.equal(ethers.constants.AddressZero);
        await vaultManager.setInsurancePool(insurancePool);
        expect(await vaultManager.insurancePool()).to.equal(insurancePool);
    });

    it('should set the insurance pool fee', async () => {
        expect(await vaultManager.insurancePoolFee()).to.equal(0);
        await vaultManager.setInsurancePoolFee(1);
        expect(await vaultManager.insurancePoolFee()).to.equal(1);
    });

    it('should set the staking pool', async () => {
        expect(await vaultManager.stakingPool()).to.equal(stakingPool);
        await vaultManager.setStakingPool(stakingPool);
        expect(await vaultManager.stakingPool()).to.equal(stakingPool);
    });

    it('should set the staking pool fee', async () => {
        expect(await vaultManager.stakingPoolShareFee()).to.equal(2000);
        await vaultManager.setStakingPoolShareFee(1);
        expect(await vaultManager.stakingPoolShareFee()).to.equal(1);
    });

    it('should set the treasury', async () => {
        expect(await vaultManager.treasury()).to.equal(treasury);
        await vaultManager.setTreasury(user);
        expect(await vaultManager.treasury()).to.equal(user);
    });

    it('should set the treasury balance', async () => {
        expect(await vaultManager.treasuryBalance()).to.equal(ether('20000'));
        await vaultManager.setTreasuryBalance(1);
        expect(await vaultManager.treasuryBalance()).to.equal(1);
    });

    it('should set the treasury fee', async () => {
        expect(await vaultManager.treasuryFee()).to.equal(500);
        await vaultManager.setTreasuryFee(1);
        expect(await vaultManager.treasuryFee()).to.equal(1);
    });

    it('should set the withdrawal protection fee', async () => {
        expect(await vaultManager.withdrawalProtectionFee()).to.equal(10);
        await vaultManager.setWithdrawalProtectionFee(1);
        expect(await vaultManager.withdrawalProtectionFee()).to.equal(1);
    });

    it('should set the yax.address token', async () => {
        expect(await vaultManager.yax()).to.equal(yax.address);
        await vaultManager.setYax(user);
        expect(await vaultManager.yax()).to.equal(user);
    });

    it('should set the controller status', async () => {
        expect(await vaultManager.controllers(controller.address)).to.be.true;
        await vaultManager.setControllerStatus(controller.address, false);
        expect(await vaultManager.controllers(controller.address)).to.be.false;
    });

    it('should set the vault status', async () => {
        expect(await vaultManager.vaults(vault.address)).to.be.true;
        await vaultManager.setVaultStatus(vault.address, false);
        expect(await vaultManager.vaults(vault.address)).to.be.false;
    });

    it('should set the harvester', async () => {
        expect(await vaultManager.harvester()).to.equal(harvester.address);
        await vaultManager.setHarvester(user);
        expect(await vaultManager.harvester()).to.equal(user);
    });

    it('should set the strategist', async () => {
        expect(await vaultManager.strategist()).to.equal(deployer);
        await vaultManager.setStrategist(user);
        expect(await vaultManager.strategist()).to.equal(user);
    });

    it('should set the governance', async () => {
        expect(await vaultManager.governance()).to.equal(deployer);
        await vaultManager.setGovernance(user);
        expect(await vaultManager.governance()).to.equal(user);
    });
});
