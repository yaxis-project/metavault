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
    const oneYear = 31556952;
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
        expect(await rewards.duration()).to.be.equal(oneYear);
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
            await increaseTime(oneYear / 4);
            expect(await rewards.earned(user.address)).to.be.equal(ether('249.9999999999966'));
            await increaseTime(oneYear / 4);
            expect(await rewards.earned(user.address)).to.be.equal(ether('499.9999999999932'));
            await increaseTime(oneYear / 4);
            expect(await rewards.earned(user.address)).to.be.equal(ether('749.9999999999898'));
            await increaseTime(oneYear / 4);
            expect(await rewards.earned(user.address)).to.be.equal(
                ether('999.9999366225093864')
            );
            // go over duration just in case
            await increaseTime(oneDay);
            expect(await rewards.earned(user.address)).to.be.equal(
                ether('999.9999366225093864')
            );
            await expect(rewards.connect(user).exit())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('999.9999366225093864'));
            expect(await yaxis.balanceOf(user.address)).to.be.equal(
                ether('1099.9999366225093864')
            );
        });

        it('should allow periodic claiming', async () => {
            await staking.connect(user).approve(rewards.address, ethers.constants.MaxUint256);
            await rewards.connect(user).stake(ether('100'));
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('250.0000316887351068'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('250.0000316887351068'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('250.0000316887351068'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('249.9998415563040659'));
            await rewards.connect(user).exit();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(
                ether('1099.9999366225093863')
            );
        });

        it('should allow depositing by transferAndCall and claiming', async () => {
            await staking
                .connect(user)
                .transferAndCall(rewards.address, ether('100'), emptyBytes);
            expect(await rewards.totalSupply()).to.be.equal(ether('100'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('250.0000316887351068'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('250.0000316887351068'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('250.0000316887351068'));
            await increaseTime(oneYear / 4);
            await expect(rewards.connect(user).getReward())
                .to.emit(rewards, 'RewardPaid')
                .withArgs(user.address, ether('249.9998732450425727'));
            await rewards.connect(user).exit();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(
                ether('1099.9999683112478931')
            );
        });
    });
});
