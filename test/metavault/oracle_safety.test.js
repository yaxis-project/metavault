const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestMetavault } = require('../helpers/setup');

describe('oracle_safety', () => {
    let deployer,
        user,
        dai,
        usdc,
        usdt,
        t3crv,
        vault,
        controller,
        converter,
        nonConverter,
        pool;

    beforeEach(async () => {
        const config = await setupTestMetavault();
        deployer = await ethers.provider.getSigner(config.deployer);
        user = config.user;
        dai = config.dai;
        usdc = config.usdc;
        usdt = config.usdt;
        t3crv = config.t3crv;
        vault = config.vault;
        controller = config.controller;
        converter = config.converter;
        nonConverter = config.nonConverter;
        pool = config.pool;

        const Strategy = await deployments.get('StrategyYearnV2-DAI');

        await vault.connect(deployer).setConverter(nonConverter.address);
        await controller
            .connect(deployer)
            .addStrategy(t3crv.address, Strategy.address, 0, converter.address, true, 0);
        await dai.approve(vault.address, ethers.constants.MaxUint256);
        await usdc.approve(vault.address, ethers.constants.MaxUint256);
        await usdt.approve(vault.address, ethers.constants.MaxUint256);
        await dai.approve(pool.address, ethers.constants.MaxUint256);
        await usdc.approve(pool.address, ethers.constants.MaxUint256);
        await usdt.approve(pool.address, ethers.constants.MaxUint256);
        expect(await pool.get_virtual_price()).to.equal(ether('1'));
        expect(await pool.get_virtual_price()).to.equal(ether('1'));
        expect(await dai.balanceOf(pool.address)).to.equal(ether('200000000'));
        expect(await usdc.balanceOf(pool.address)).to.equal('200000000000000');
        expect(await usdt.balanceOf(pool.address)).to.equal('200000000000000');
        // add some initial funds to the vault (20,000,000)
        await t3crv.connect(deployer).approve(vault.address, ethers.constants.MaxUint256);
        await vault.connect(deployer).deposit(ether('20000000'), t3crv.address, 1, true);
        await vault.connect(deployer).earn();
        expect(await t3crv.balanceOf(vault.address)).to.equal(ether('50000'));
    });

    it('should be safe from the Yearn yDAI vault attack', async () => {
        const max = ethers.constants.MaxUint256;
        const daiValue = '37972761178915525047091200'; // $37,972,761.178915525047091200
        const usdcValue = '133000000000000'; // $133,000,000.000000
        await dai.faucet(daiValue);
        await usdc.faucet(usdcValue);
        expect(await dai.balanceOf(user)).to.be.least(daiValue);
        expect(await usdc.balanceOf(user)).to.be.least(usdcValue);
        expect(await usdt.balanceOf(user)).to.be.least(1000000000);

        // exploit parameters
        const removeUsdtValue = '167473454967245'; // $167,473,454.967245
        const earnValue = '105469871996916702826725376'; // $105,469,871.996916702826725376

        expect(await controller.balanceOf(t3crv.address)).to.be.least(ether('19930000'));

        // unbalance the pool
        await pool.add_liquidity([daiValue, usdcValue, 0], 0);

        expect(await t3crv.balanceOf(user)).to.be.least(ether('170000000'));

        // try the exploit
        await dai.faucet(earnValue); // step 1: be a whale
        // step 2: imbalance the pool
        await pool.remove_liquidity_imbalance([0, 0, removeUsdtValue], max);
        // step 3: try to deposit
        await expect(vault.deposit(earnValue, dai.address, 0, false)).to.be.revertedWith(
            'Only 3CRV allowed'
        );
    });
});
