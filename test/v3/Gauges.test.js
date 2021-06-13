const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Gauges', () => {
    const MAXTIME = 4 * 365 * 86400;
    let deployer, treasury;
    let gaugeController,
        gaugeProxy,
        minter,
        minterWrapper,
        vaultStables,
        vaultStablesGauge,
        votingEscrow,
        yaxis;

    before(async () => {
        await deployments.fixture('v3');
        [deployer, treasury] = await ethers.getSigners();
        const YAXIS = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('YaxisToken', YAXIS.address);
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
        const VaultStables = await deployments.get('VaultStables');
        vaultStables = await ethers.getContractAt('Vault', VaultStables.address);
        const VaultStablesGauge = await deployments.get('VaultStablesGauge');
        vaultStablesGauge = await ethers.getContractAt(
            'LiquidityGaugeV2',
            VaultStablesGauge.address
        );
    });

    it('should deploy with expected state', async () => {
        expect(await gaugeController.admin()).to.be.equal(deployer.address);
        expect(await gaugeController.future_admin()).to.be.equal(treasury.address);
        expect(await gaugeController.token()).to.be.equal(yaxis.address);
        expect(await gaugeController.voting_escrow()).to.be.equal(votingEscrow.address);
        expect(await gaugeController.n_gauges()).to.be.equal(0);
        expect(await gaugeController.n_gauge_types()).to.be.equal(0);
        expect(await minter.token()).to.be.equal(minterWrapper.address);
        expect(await minter.controller()).to.be.equal(gaugeController.address);
        expect(await minterWrapper.token()).to.be.equal(yaxis.address);
        expect(await vaultStablesGauge.crv_token()).to.be.equal(minterWrapper.address);
        expect(await vaultStablesGauge.lp_token()).to.be.equal(vaultStables.address);
        expect(await vaultStablesGauge.controller()).to.be.equal(gaugeController.address);
        expect(await vaultStablesGauge.admin()).to.be.equal(gaugeProxy.address);
        expect(await vaultStablesGauge.minter()).to.be.equal(minter.address);
    });

    it('should fund the minterWrapper with YAXIS', async () => {
        expect(await yaxis.balanceOf(minterWrapper.address)).to.be.equal(0);
        await yaxis.connect(deployer).transfer(minterWrapper.address, ether('1000'));
        expect(await yaxis.balanceOf(minterWrapper.address)).to.be.equal(ether('1000'));
    });

    it('should add the vault gauge type', async () => {
        await gaugeController['add_type(string)']('vault');
        expect(await gaugeController.n_gauge_types()).to.be.equal(1);
    });

    it('should add the vault gauge', async () => {
        await gaugeController['add_gauge(address,int128)'](vaultStablesGauge.address, 0);
        expect(await gaugeController.n_gauges()).to.be.equal(1);
    });

    it('should allow users to lock tokens in voting escrow', async () => {
        expect(await votingEscrow['balanceOf(address)'](deployer.address)).to.be.equal(0);
        await yaxis.approve(votingEscrow.address, ethers.constants.MaxUint256);
        const block = await ethers.provider.getBlockNumber();
        const { timestamp } = await ethers.provider.getBlock(block);
        await votingEscrow.create_lock(ether('1'), timestamp + MAXTIME);
        expect(await votingEscrow['balanceOf(address)'](deployer.address)).to.be.above(
            ether('0.99')
        );
    });

    it('should allow users to vote for a gauge', async () => {
        expect(await gaugeController.get_gauge_weight(vaultStablesGauge.address)).to.be.equal(
            0
        );
        await gaugeController.vote_for_gauge_weights(vaultStablesGauge.address, 10000);
        expect(await gaugeController.get_gauge_weight(vaultStablesGauge.address)).to.be.above(
            ether('0.99')
        );
    });
});
