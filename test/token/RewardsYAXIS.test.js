const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { increaseTime, setupTestToken } = require('../helpers/setup');

describe('Rewards: YAXIS/YAXIS', () => {
    const emptyBytes = '0x00';
    const oneDay = 86400;
    const oneMonth = 2592000;
    const threeMonths = 7776000;
    let deployer, user;
    let yaxis, staking, rewards;

    beforeEach(async () => {
        const config = await setupTestToken();
        yaxis = config.yaxis;
        staking = yaxis;
        [deployer, , , user] = await ethers.getSigners();

        await staking.connect(deployer).transfer(user.address, ether('100'));

        const Rewards = await deployments.get('RewardsYaxis');
        rewards = await ethers.getContractAt('Rewards', Rewards.address, deployer);
    });

    it('should deploy with initial state set', async () => {
        expect(await rewards.rewardToken()).to.be.equal(yaxis.address);
        expect(await rewards.stakingToken()).to.be.equal(staking.address);
        expect(await rewards.duration()).to.be.equal(threeMonths);
    });

    describe('setRewardDistribution', () => {
        it('should revert when called by a non-owner', async () => {
            await expect(
                rewards.connect(user).setRewardDistribution(user.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should set when called by the owner', async () => {
            await rewards.connect(deployer).setRewardDistribution(deployer.address);
        });
    });

    describe('notifyRewardAmount', () => {
        it('should revert when called by the non-rewardDistribution address', async () => {
            await expect(rewards.connect(user).notifyRewardAmount(0)).to.be.revertedWith(
                'Caller is not reward distribution'
            );
        });

        context('when called by the rewardDistribution address', () => {
            beforeEach(async () => {
                await rewards.connect(deployer).setRewardDistribution(deployer.address);
            });

            it('should set the reward to 0 when unfunded', async () => {
                await expect(rewards.connect(deployer).notifyRewardAmount(0))
                    .to.emit(rewards, 'RewardAdded')
                    .withArgs(0);
            });
        });
    });

    describe('onTokenTransfer', () => {
        let fake;

        beforeEach(async () => {
            const Fake = await ethers.getContractFactory('MockERC677');
            fake = await Fake.deploy('Staking Contract', 'ST');
            await fake.deployed();
            await fake.mint(user.address, ether('100'));
        });

        it('should revert when called by a fake token', async () => {
            await expect(
                fake.connect(user).transferAndCall(rewards.address, 1, emptyBytes)
            ).to.be.revertedWith('!stakingToken');
        });
    });

    describe('integration', () => {
        beforeEach(async () => {
            await yaxis.connect(deployer).transfer(rewards.address, ether('1000'));
            await expect(rewards.connect(deployer).notifyRewardAmount(ether('1000')))
                .to.emit(rewards, 'RewardAdded')
                .withArgs(ether('1000'));
        });

        it('should allow funding by owner, staking and claiming by users', async () => {
            await staking.connect(user).approve(rewards.address, ethers.constants.MaxUint256);
            await rewards.connect(user).stake(ether('100'));
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            let earnedA = await rewards.earned(user.address);
            await increaseTime(oneMonth);
            let earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.above(earnedA);
            await increaseTime(oneMonth);
            earnedA = await rewards.earned(user.address);
            expect(earnedA).to.be.above(earnedB);
            await increaseTime(oneMonth);
            earnedB = await rewards.earned(user.address);
            expect(earnedB).to.be.above(earnedA);
            // go over duration just in case
            await increaseTime(oneDay);
            earnedA = await rewards.earned(user.address);
            expect(earnedB).to.be.equal(earnedA);
            const balance = await yaxis.balanceOf(user.address);
            await expect(rewards.connect(user).exit()).to.emit(rewards, 'RewardPaid');
            expect(await yaxis.balanceOf(user.address)).to.be.above(balance);
        });

        it('should allow periodic claiming', async () => {
            await staking.connect(user).approve(rewards.address, ethers.constants.MaxUint256);
            const startingBalance = await yaxis.balanceOf(user.address);
            await rewards.connect(user).stake(ether('100'));
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            let balanceA = await yaxis.balanceOf(user.address);
            await increaseTime(oneMonth);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            let balanceB = await yaxis.balanceOf(user.address);
            expect(balanceB).to.be.above(balanceA);
            await increaseTime(oneMonth);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            balanceA = await yaxis.balanceOf(user.address);
            expect(balanceA).to.be.above(balanceB);
            await increaseTime(oneMonth);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            balanceB = await yaxis.balanceOf(user.address);
            expect(balanceB).to.be.above(balanceA);
            await rewards.connect(user).exit();
            expect(await yaxis.balanceOf(user.address)).to.be.above(startingBalance);
        });

        it('should allow depositing by transferAndCall and claiming', async () => {
            const startingBalance = await yaxis.balanceOf(user.address);
            await staking
                .connect(user)
                .transferAndCall(rewards.address, ether('100'), emptyBytes);
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            await increaseTime(oneMonth);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await increaseTime(oneMonth);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await increaseTime(oneMonth);
            await expect(rewards.connect(user).getReward()).to.emit(rewards, 'RewardPaid');
            await rewards.connect(user).exit();
            expect(await yaxis.balanceOf(user.address)).to.be.above(startingBalance);
        });
    });
});
