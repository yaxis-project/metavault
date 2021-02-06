const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestMetavault } = require('../helpers/setup');

describe('stuck_funds.test', () => {
    let deployer, user, dai, t3crv, weth, controller, vault, strategyCurve3Crv;

    before(async () => {
        const config = await setupTestMetavault();
        deployer = config.deployer;
        user = config.user;
        dai = config.dai;
        controller = config.controller;
        vault = config.vault;
        t3crv = await ethers.getContractAt('MockERC20', config.t3crv.address, deployer);
        weth = await ethers.getContractAt('MockERC20', config.weth.address, deployer);
        const StrategyCurve3Crv = await deployments.get('StrategyCurve3Crv');
        strategyCurve3Crv = await ethers.getContractAt(
            'StrategyCurve3Crv',
            StrategyCurve3Crv.address,
            deployer
        );
        await controller.addStrategy(
            t3crv.address,
            strategyCurve3Crv.address,
            0,
            ethers.constants.AddressZero,
            true,
            0
        );
    });

    it('deposit', async () => {
        const _amount = ether('10');
        await vault.deposit(_amount, dai.address, 1, true, { from: user });
        expect(await dai.balanceOf(user)).to.equal(ether('990'));
        expect(await controller.balanceOf(t3crv.address)).to.be.equal(ether('9.519'));
        expect(await vault.getPricePerFullShare()).to.be.least(ether('1'));
    });

    it('stuck WETH in strategy', async () => {
        expect(await weth.balanceOf(strategyCurve3Crv.address)).to.be.equal(0);
        await weth.mint(strategyCurve3Crv.address, ether('1'));
        expect(await weth.balanceOf(strategyCurve3Crv.address)).to.equal(ether('1'));
        expect(await weth.balanceOf(deployer)).to.equal(0); // governance has no WETH
        await controller.inCaseStrategyGetStuck(strategyCurve3Crv.address, weth.address);
        expect(await weth.balanceOf(strategyCurve3Crv.address)).to.equal(0);
        expect(await weth.balanceOf(deployer)).to.equal(ether('1')); // governance has WETH now
    });

    it('stuck WETH in controller', async () => {
        expect(await weth.balanceOf(controller.address)).to.equal(0);
        await weth.mint(controller.address, ether('1'));
        expect(await weth.balanceOf(controller.address)).to.equal(ether('1'));
        expect(await weth.balanceOf(deployer)).to.equal(ether('1')); // governance has 1 WETH already
        await controller.inCaseTokensGetStuck(weth.address, ether('1'));
        expect(await weth.balanceOf(controller.address)).to.equal(0);
        expect(await weth.balanceOf(deployer)).to.equal(ether('2')); // governance has 2 WETH
    });

    it('stuck t3crv.address (core) in strategy', async () => {
        expect(await t3crv.balanceOf(strategyCurve3Crv.address)).to.equal(0);
        await t3crv.mint(strategyCurve3Crv.address, ether('1'));
        expect(await t3crv.balanceOf(strategyCurve3Crv.address)).to.equal(ether('1'));
        expect(await t3crv.balanceOf(controller.address)).to.equal(0); // controller has no t3crv.address
        await expect(
            controller.inCaseStrategyGetStuck(strategyCurve3Crv.address, t3crv.address)
        ).to.be.revertedWith('want');
        await strategyCurve3Crv.skim();
        expect(await t3crv.balanceOf(strategyCurve3Crv.address)).to.equal(0);
        expect(await t3crv.balanceOf(controller.address)).to.equal(ether('1')); // controller has t3crv.address now
        await controller.inCaseTokensGetStuck(t3crv.address, ether('1'));
        expect(await t3crv.balanceOf(controller.address)).to.equal(0); // controller has no t3crv.address now
        expect(await t3crv.balanceOf(deployer)).to.equal(ether('1')); // governance has t3crv.address now
    });
});
