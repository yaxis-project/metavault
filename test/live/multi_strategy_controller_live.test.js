//const { send } = require('@openzeppelin/test-helpers');
const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers, getNamedAccounts } = hardhat;
const { formatEther, formatUnits, parseEther } = ethers.utils;
const ether = parseEther;
const fromWei = formatEther;
const fromWeiWithDecimals = formatUnits;

const verbose = process.env.VERBOSE;

describe('StrategyControllerV2: live', () => {
    let userAddr,
        deployerAddr,
        multisigAddr,
        timelockAddr,
        stakingPoolAddr,
        yax,
        dai,
        usdc,
        usdt,
        t3crv,
        pickleChef,
        pickleJar,
        vaultManager,
        vaultUser,
        vaultGov,
        controller,
        converter,
        harvester,
        strategyCrv,
        strategyPickle,
        controllerV1,
        oldStrategyCrvAddr;

    before(async () => {
        const {
            deployer,
            user,
            multisig,
            timelock,
            stakingPool,
            YAX,
            DAI,
            USDC,
            USDT,
            T3CRV,
            pchef,
            pjar,
            vault3crv,
            oldController,
            oldStrategyCrv
        } = await getNamedAccounts();
        await network.provider.request({
            method: 'hardhat_reset',
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.MAINNET_RPC_URL
                    }
                }
            ]
        });
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
            params: [multisig]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [timelock]
        });
        const userSigner = await ethers.provider.getSigner(user);
        await userSigner.sendTransaction({
            to: deployer,
            value: ethers.utils.parseEther('100')
        });
        await userSigner.sendTransaction({
            to: multisig,
            value: ethers.utils.parseEther('100')
        });
        await userSigner.sendTransaction({
            to: timelock,
            value: ethers.utils.parseEther('100')
        });
        await deployments.fixture();
        pickleChef = pchef;
        userAddr = user;
        deployerAddr = deployer;
        multisigAddr = multisig;
        timelockAddr = timelock;
        stakingPoolAddr = stakingPool;
        oldStrategyCrvAddr = oldStrategyCrv;
        yax = await ethers.getContractAt('MockERC20', YAX, user);
        dai = await ethers.getContractAt('MockERC20', DAI, user);
        usdc = await ethers.getContractAt('MockERC20', USDC, user);
        usdt = await ethers.getContractAt('MockERC20', USDT, user);
        t3crv = await ethers.getContractAt('MockERC20', T3CRV, user);
        pickleJar = await ethers.getContractAt('MockERC20', pjar, user);
        vaultUser = await ethers.getContractAt('yAxisMetaVault', vault3crv, user);
        vaultGov = await ethers.getContractAt('yAxisMetaVault', vault3crv, timelock);
        const VaultManager = await deployments.get('yAxisMetaVaultManager');
        vaultManager = await ethers.getContractAt(
            'yAxisMetaVaultManager',
            VaultManager.address,
            deployer
        );
        const Converter = await deployments.get('StableSwap3PoolConverter');
        converter = await ethers.getContractAt(
            'StableSwap3PoolConverter',
            Converter.address,
            deployer
        );
        controllerV1 = await ethers.getContractAt(
            'StrategyControllerV1',
            oldController,
            multisig
        );
        const StrategyControllerV2 = await deployments.get('StrategyControllerV2');
        controller = await ethers.getContractAt(
            'StrategyControllerV2',
            StrategyControllerV2.address,
            deployer
        );
        const Harvester = await deployments.get('yAxisMetaVaultHarvester');
        harvester = await ethers.getContractAt(
            'yAxisMetaVaultHarvester',
            Harvester.address,
            deployer
        );
        const StrategyCrv = await deployments.get('StrategyCurve3Crv');
        strategyCrv = await ethers.getContractAt(
            'StrategyCurve3Crv',
            StrategyCrv.address,
            deployer
        );
        const StrategyPickle = await deployments.get('StrategyPickle3Crv');
        strategyPickle = await ethers.getContractAt(
            'StrategyPickle3Crv',
            StrategyPickle.address,
            deployer
        );

        await dai.approve(vaultUser.address, ethers.constants.MaxUint256);
        await usdc.approve(vaultUser.address, ethers.constants.MaxUint256);
        await usdt.approve(vaultUser.address, ethers.constants.MaxUint256);
        await t3crv.approve(vaultUser.address, ethers.constants.MaxUint256);
        await vaultUser.approve(vaultUser.address, ethers.constants.MaxUint256);
    });

    after(async () => {
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [userAddr]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [deployerAddr]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [multisigAddr]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [timelockAddr]
        });
        await network.provider.request({
            method: 'hardhat_reset',
            params: []
        });
    });

    const printBalances = async (title) => {
        console.log(title);
        console.log('vault T3CRV:       ', fromWei(await t3crv.balanceOf(vaultUser.address)));
        console.log(
            'vault MVLT:        ',
            fromWei(await vaultUser.balanceOf(vaultUser.address))
        );
        console.log('vault Supply:      ', fromWei(await vaultUser.totalSupply()));
        console.log('--------------------');
        console.log('strategy T3CRV:    ', fromWei(await strategyCrv.balanceOf()));
        console.log('strategy PICKLE:   ', fromWei(await strategyPickle.balanceOf()));
        console.log('pjar T3CRV:        ', fromWei(await t3crv.balanceOf(pickleJar.address)));
        console.log('pchef PJAR:        ', fromWei(await pickleJar.balanceOf(pickleChef)));
        console.log('--------------------');
        console.log(
            'user balances:      %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX',
            fromWei(await dai.balanceOf(userAddr)),
            fromWeiWithDecimals(await usdc.balanceOf(userAddr), 6),
            fromWeiWithDecimals(await usdt.balanceOf(userAddr), 6),
            fromWei(await t3crv.balanceOf(userAddr)),
            fromWei(await yax.balanceOf(userAddr))
        );
        console.log(
            'user staked:       ',
            fromWei((await vaultUser.userInfo(userAddr)).amount)
        );
        console.log('--------------------');
    };

    beforeEach(async () => {
        if (verbose) {
            await printBalances('\n====== BEFORE ======');
        }
    });

    afterEach(async () => {
        if (verbose) {
            await printBalances('\n====== AFTER ======');
        }
    });

    it('should prepare the old controller and vault', async () => {
        await controllerV1.setInvestEnabled(false);
        await controllerV1.withdrawAll(oldStrategyCrvAddr);
    });

    it('should setup the deployed contracts', async () => {
        expect(await vaultManager.vaults(vaultUser.address)).to.be.true;
        expect(await vaultManager.controllers(controller.address)).to.be.true;
        expect(await vaultManager.treasury()).to.equal(multisigAddr);
        expect(await vaultManager.stakingPool()).to.equal(stakingPoolAddr);
        expect(await vaultManager.harvester()).to.equal(harvester.address);
        expect(await harvester.vaultManager()).to.equal(vaultManager.address);
        expect(await harvester.controller()).to.equal(controller.address);
        expect(await harvester.isHarvester(deployerAddr)).to.be.true;
        const strategyAddresses = await harvester.strategyAddresses(t3crv.address);
        expect(strategyAddresses.length).to.equal(2);
        expect(strategyAddresses[0]).to.equal(strategyCrv.address);
        expect(strategyAddresses[1]).to.equal(strategyPickle.address);
        expect(await controller.converters(t3crv.address, dai.address)).to.equal(
            converter.address
        );
        expect(await controller.converters(t3crv.address, usdt.address)).to.equal(
            converter.address
        );
        expect(await controller.converters(t3crv.address, usdc.address)).to.equal(
            converter.address
        );
        expect(await controller.vaults(t3crv.address)).to.equal(vaultUser.address);
        const strategies = await controller.strategies(t3crv.address);
        expect(strategies.length).to.equal(2);
        expect(strategies[0]).to.equal(strategyCrv.address);
        expect(strategies[1]).to.equal(strategyPickle.address);
        expect(await vaultManager.strategist()).to.equal(deployerAddr);
        expect(await vaultManager.governance()).to.equal(deployerAddr);
    });

    it('should set the new controller on the vault', async () => {
        expect(await vaultUser.controller()).to.be.equal(controllerV1.address);
        await vaultGov.setController(controller.address);
        expect(await vaultUser.controller()).to.be.equal(controller.address);
    });

    it('should call earn to transfer funds to Curve strategy', async () => {
        expect(await strategyCrv.balanceOf()).to.be.equal(0);
        await vaultUser.earn();
        expect(await strategyCrv.balanceOf()).to.be.above(ether('1000000'));
    });

    it('should send new deposits go to the Pickle strategy', async () => {
        expect(await strategyPickle.balanceOf()).to.be.equal(0);
        await vaultUser.deposit(ether('100'), dai.address, 1, true);
        expect(await strategyPickle.balanceOf()).to.be.above(ether('100'));
    });

    it('should harvest', async () => {
        await harvester.harvestNextStrategy(t3crv.address);
    });
});
