const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('LegacyController', () => {
    let deployer, treasury, user;
    let dai,
        t3crv,
        usdc,
        usdt,
        vault,
        manager,
        metavault,
        converter,
        legacyController,
        harvester;

    beforeEach(async () => {
        await deployments.fixture('v3');
        [deployer, treasury, , user] = await ethers.getSigners();
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);

        const LegacyController = await deployments.get('LegacyController');
        legacyController = await ethers.getContractAt(
            'LegacyController',
            LegacyController.address
        );

        const Converter = await deployments.get('StablesConverter');
        converter = await ethers.getContractAt('StablesConverter', Converter.address);

        const MetaVault = await deployments.get('MetaVault');
        metavault = await ethers.getContractAt('MetaVault', MetaVault.address);

        const Vault = await deployments.deploy('Vault', {
            from: deployer.address,
            args: ['Vault: Stables', 'MV:S', manager.address]
        });
        vault = await ethers.getContractAt('Vault', Vault.address);

        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);
        await dai.connect(user).faucet(ethers.utils.parseEther('100000001'));
        await usdc.connect(user).faucet('100000000000000');
        await usdt.connect(user).faucet('100000000000000');
        await dai.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
        await usdc.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
        await usdt.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
        await t3crv.connect(user).approve(Vault.address, ethers.utils.parseEther('1000'));
    });

    describe('setVault', () => {
        it('should revert if not called by the strategist', async () => {
            await expect(
                legacyController.connect(user).setVault(vault.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should set the vault if called by the strategist', async () => {
            expect(await legacyController.vault()).to.be.equal(ethers.constants.AddressZero);
            await legacyController.connect(deployer).setVault(vault.address);
            expect(await legacyController.vault()).to.be.equal(vault.address);
        });
    });

    describe('setConverter', () => {
        it('should revert if not called by the strategist', async () => {
            await expect(
                legacyController.connect(user).setConverter(converter.address)
            ).to.be.revertedWith('!strategist');
        });

        it('should set the vault if called by the strategist', async () => {
            expect(await legacyController.converter()).to.be.equal(
                ethers.constants.AddressZero
            );
            await legacyController.connect(deployer).setConverter(converter.address);
            expect(await legacyController.converter()).to.be.equal(converter.address);
        });
    });
});
