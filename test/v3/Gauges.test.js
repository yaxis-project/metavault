const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { increaseTime } = require('../helpers/setup');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Gauges', () => {
    const MAXTIME = 1 * 365 * 86400;
    let deployer, treasury, user;
    let t3crv,
        gaugeController,
        gaugeProxy,
        minter,
        minterWrapper,
        vault3Crv,
        vault3CrvGauge,
        vault3CrvToken,
        votingEscrow,
        yaxis,
        feeDistributor;

    before(async () => {
        await deployments.fixture('v3');
        [deployer, treasury, user] = await ethers.getSigners();
        const YAXIS = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('YaxisToken', YAXIS.address);
        const T3CRV = await deployments.get('MIM3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const GaugeController = await deployments.get('GaugeController');
        gaugeController = await ethers.getContractAt(
            'GaugeController',
            GaugeController.address,
            deployer
        );
        const GaugeProxy = await deployments.get('GaugeProxy');
        gaugeProxy = await ethers.getContractAt('GaugeProxy', GaugeProxy.address);
        const VotingEscrow = await deployments.get('VotingEscrow');
        votingEscrow = await ethers.getContractAt('VotingEscrow', VotingEscrow.address);
        const MinterWrapper = await deployments.get('MinterWrapper');
        minterWrapper = await ethers.getContractAt('MinterWrapper', MinterWrapper.address);
        const Minter = await deployments.get('Minter');
        minter = await ethers.getContractAt('Minter', Minter.address);
        const Vault3CRVToken = await deployments.get('VaultTokenMIM3CRV');
        vault3CrvToken = await ethers.getContractAt('VaultToken', Vault3CRVToken.address);
        const Vault3CRV = await deployments.get('VaultMIM3CRV');
        vault3Crv = await ethers.getContractAt('Vault', Vault3CRV.address);
        const Vault3CRVGauge = await deployments.get('VaultMIM3CRVGauge');
        vault3CrvGauge = await ethers.getContractAt(
            'LiquidityGaugeV2',
            Vault3CRVGauge.address
        );
        const FeeDistributor = await deployments.get('FeeDistributor');
        feeDistributor = await ethers.getContractAt('FeeDistributor', FeeDistributor.address);
    });

    it('should deploy with expected state', async () => {
        expect(await gaugeController.admin()).to.be.equal(deployer.address);
        expect(await gaugeController.future_admin()).to.be.equal(treasury.address);
        expect(await gaugeController.token()).to.be.equal(yaxis.address);
        expect(await gaugeController.voting_escrow()).to.be.equal(votingEscrow.address);
        expect(await gaugeController.n_gauges()).to.be.above(0);
        expect(await gaugeController.n_gauge_types()).to.be.equal(1);
        expect(await minter.token()).to.be.equal(minterWrapper.address);
        expect(await minter.controller()).to.be.equal(gaugeController.address);
        expect(await minterWrapper.token()).to.be.equal(yaxis.address);
        expect(await vault3CrvGauge.crv_token()).to.be.equal(minterWrapper.address);
        expect(await vault3CrvGauge.lp_token()).to.be.equal(vault3CrvToken.address);
        expect(await vault3CrvGauge.controller()).to.be.equal(gaugeController.address);
        expect(await vault3CrvGauge.admin()).to.be.equal(gaugeProxy.address);
        expect(await vault3CrvGauge.minter()).to.be.equal(minter.address);
        expect(await vault3Crv.getPricePerFullShare()).to.equal(0);
        expect(await feeDistributor.votingEscrow()).to.be.equal(votingEscrow.address);
    });

    it('should fund the minterWrapper with YAXIS', async () => {
        expect(await yaxis.balanceOf(minterWrapper.address)).to.be.equal(0);
        await yaxis.connect(deployer).transfer(minterWrapper.address, ether('1000000'));
        expect(await yaxis.balanceOf(minterWrapper.address)).to.be.equal(ether('1000000'));
    });

    it('should allow users to lock tokens in voting escrow', async () => {
        expect(await votingEscrow['balanceOf(address)'](deployer.address)).to.be.equal(0);
        await yaxis.approve(votingEscrow.address, ethers.constants.MaxUint256);
        const block = await ethers.provider.getBlockNumber();
        const { timestamp } = await ethers.provider.getBlock(block);
        await votingEscrow.create_lock(ether('1'), timestamp + MAXTIME);
        expect(await votingEscrow['balanceOf(address)'](deployer.address)).to.be.above(
            ether('0.98')
        );
    });

    it('should earn fees after locking', async () => {
        // locking as user
        const block = await ethers.provider.getBlockNumber();
        const { timestamp } = await ethers.provider.getBlock(block);
        await yaxis.connect(deployer).transfer(user.address, ether('1'));
        await yaxis.connect(user).approve(votingEscrow.address, ethers.constants.MaxUint256);
        await votingEscrow.connect(user).create_lock(ether('1'), timestamp + MAXTIME);
        //add reward
        await yaxis.approve(feeDistributor.address, ethers.constants.MaxUint256);
        await feeDistributor.addReward(yaxis.address, ether('1'));
        expect(await yaxis.balanceOf(feeDistributor.address)).to.be.equal(ether('1'));
        expect(await feeDistributor.numberOfRewards()).to.be.equal(1);
        //claim user1
        const toClaim1 = await feeDistributor.getRewardAmount(yaxis.address, deployer.address);
        expect(toClaim1).to.be.above(0);
        const balanceBefore1 = await yaxis.balanceOf(deployer.address);
        await feeDistributor.connect(deployer).claimRewards(yaxis.address);
        expect(await yaxis.balanceOf(feeDistributor.address)).to.be.above(0);
        expect(await yaxis.balanceOf(deployer.address)).to.be.equal(
            toClaim1.add(balanceBefore1)
        );
        //claim user2
        const toClaim2 = await feeDistributor.getRewardAmount(yaxis.address, user.address);
        expect(toClaim2).to.be.above(0);
        const balanceBefore2 = await yaxis.balanceOf(user.address);
        await feeDistributor.connect(user).claimRewards(yaxis.address);
        expect(await yaxis.balanceOf(feeDistributor.address)).to.be.equal(0);
        expect(await yaxis.balanceOf(user.address)).to.be.equal(toClaim2.add(balanceBefore2));
        //check total
        expect(toClaim1.add(toClaim2)).to.be.equal(ether('1'));
    });

    it('should allow users to stake vault tokens in a gauge', async () => {
        await yaxis
            .connect(user)
            .transfer(minterWrapper.address, await yaxis.balanceOf(user.address));
        await increaseTime(86400 * 7);
        await t3crv.connect(user).faucet(ether('1000'));
        await t3crv.connect(user).approve(vault3Crv.address, ethers.constants.MaxUint256);
        await vault3Crv.connect(user).deposit(ether('1000'));
        expect(await vault3CrvToken.balanceOf(user.address)).to.be.equal(ether('1000'));
        await vault3CrvToken
            .connect(user)
            .approve(vault3CrvGauge.address, ethers.constants.MaxUint256);
        expect(await vault3CrvGauge.balanceOf(user.address)).to.be.equal(0);
        await vault3CrvGauge
            .connect(user)
            ['deposit(uint256,address)'](ether('1000'), user.address);
        expect(await vault3CrvGauge.balanceOf(user.address)).to.be.equal(ether('1000'));
        await increaseTime(86400 * 7);
        await minter.connect(user).mint(vault3CrvGauge.address);
        expect(await yaxis.balanceOf(user.address)).to.be.above(0);
    });

    it('should emit correct tokens value', async () => {
        await yaxis
            .connect(user)
            .transfer(minterWrapper.address, await yaxis.balanceOf(user.address));
        expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
        //250k tokens per 4 weeks
        await minterWrapper.connect(deployer).setRate('103339947089947090');
        await increaseTime(86400 * 7 * 4);
        await minter.connect(user).mint(vault3CrvGauge.address);
        const balance = await yaxis.balanceOf(user.address);
        //will not be 250k exactly
        //mul by 5 because 5 gauges with same weight
        expect(balance.mul(5)).to.be.above(ether('250000'));
        expect(balance.mul(5)).to.be.below(ether('250001'));
    });

    describe('changingRate', () => {
        it('should revert if not owner', async () => {
            await expect(minterWrapper.connect(user).setRate(10000)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('should allow changing rate', async () => {
            await minterWrapper.connect(deployer).setRate(20000);
            expect(await minterWrapper.rate()).to.be.equal(20000);
        });
    });

    it('should allow users to vote for a gauge', async () => {
        expect(await gaugeController.get_gauge_weight(vault3CrvGauge.address)).to.be.equal(
            ether('1')
        );
        await gaugeController.vote_for_gauge_weights(vault3CrvGauge.address, 10000);
        expect(await gaugeController.get_gauge_weight(vault3CrvGauge.address)).to.be.above(
            ether('0.97')
        );
    });
});
