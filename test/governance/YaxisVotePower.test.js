const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestGovernance } = require('../helpers/setup');

describe('YaxisVotePower', () => {
    let vp, yax, syax, pair, weth, chef, deployer, user;

    beforeEach(async () => {
        const config = await setupTestGovernance();
        deployer = config.deployer;
        user = config.user;
        yax = config.yax;
        syax = config.syax;
        pair = config.pair;
        weth = config.weth;
        chef = config.yaxisChef;

        const VP = await deployments.get('YaxisVoteProxy');
        vp = await ethers.getContractAt('YaxisVoteProxy', VP.address, deployer);

        await yax.faucet(ether('100'));
        await weth.faucet(ether('100'));
    });

    it('should calculate voting power', async () => {
        expect(await vp.balanceOf(user)).to.be.equal(ether('10'));
        expect(await vp.balanceOf(deployer)).to.be.equal(0);
    });

    context('when the user is staking YAX', () => {
        beforeEach(async () => {
            await yax.approve(syax.address, ethers.constants.MaxUint256);
            await syax.enter(ether('50'));
        });

        it('should calculate voting power', async () => {
            expect(await vp.balanceOf(user)).to.be.equal(ether('10'));
            expect(await vp.balanceOf(deployer)).to.be.equal(0);
        });
    });

    context('when the user is staking LP', () => {
        beforeEach(async () => {
            await weth.approve(pair.address, ethers.constants.MaxUint256);
            await yax.approve(pair.address, ethers.constants.MaxUint256);
            await pair.addLiquidity(ether('10'), ether('10'), ether('20'));
        });

        it('should not count unstaked LP', async () => {
            expect(await vp.balanceOf(user)).to.be.equal(ether('9.48683298'));
            expect(await vp.balanceOf(deployer)).to.be.equal(0);
        });

        it('should calculate voting power', async () => {
            await chef.addBalance(user, ether('20'), 0);
            expect(await vp.balanceOf(user)).to.be.equal(ether('10'));
            expect(await vp.balanceOf(deployer)).to.be.equal(0);
        });
    });
});
