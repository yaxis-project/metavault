const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers, deployments, getNamedAccounts } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('StrategyYearnV2: live', () => {
    let t3crv, vault, controller, strategyYearnV2, converterAddr;

    before(async () => {
        let {
            converter,
            DAI,
            deployer,
            T3CRV,
            timelock,
            unirouter,
            user,
            vault3crv,
            WETH,
            yvDAI
        } = await getNamedAccounts();
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [user]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [deployer]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [timelock]
        });
        const vaultManager = await deployments.get('yAxisMetaVaultManager');
        const Converter = await deployments.get('StableSwap3PoolConverter');
        const Controller = await deployments.get('StrategyControllerV2');
        deployer = await ethers.provider.getSigner(deployer);
        timelock = await ethers.provider.getSigner(timelock);
        user = await ethers.provider.getSigner(user);
        converterAddr = converter;
        t3crv = T3CRV;
        vault = await ethers.getContractAt('yAxisMetaVault', vault3crv);

        controller = await ethers.getContractAt(
            'StrategyControllerV2',
            Controller.address,
            timelock
        );

        const StrategyYearnV2 = await ethers.getContractFactory('StrategyYearnV2', deployer);
        strategyYearnV2 = await StrategyYearnV2.deploy(
            'YearnV2: DAI',
            yvDAI,
            DAI,
            Converter.address,
            controller.address,
            vaultManager.address,
            WETH,
            unirouter
        );
        await strategyYearnV2.deployed();
    });

    it('should add the strategy to the controller', async () => {
        await controller.addStrategy(
            t3crv,
            strategyYearnV2.address,
            ether('5000000'),
            converterAddr,
            false,
            84600
        );
    });

    it('should earn to the new strategy', async () => {
        await vault.connect(deployer).earn();
        const balance = await strategyYearnV2.balanceOf();
        expect(balance).to.be.above(1);
    });
});
