const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;

describe('Manager', () => {
    let deployer, treasury, user;
    let dai, usdc, usdt, t3crv, yaxis;
    let manager, controller, converter, harvester;

    beforeEach(async () => {
        await deployments.fixture('v3');
        [deployer, treasury, , user] = await ethers.getSigners();
        const YAXIS = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('MockERC20', YAXIS.address);
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
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const Converter = await deployments.get('StablesConverter');
        converter = await ethers.getContractAt('StablesConverter', Converter.address);
    });

    it('should deploy with expected state', async () => {
        expect(await manager.yaxis()).to.equal(yaxis.address);
        expect(await manager.governance()).to.equal(deployer.address);
        expect(await manager.strategist()).to.equal(deployer.address);
        expect(await manager.harvester()).to.equal(harvester.address);
        expect(await manager.stakingPoolShareFee()).to.equal(2000);
        expect(await manager.treasuryFee()).to.equal(500);
        expect(await manager.withdrawalProtectionFee()).to.equal(10);
    });

    describe('setAllowedController', () => {
        beforeEach(async () => {
            await manager.connect(deployer).setGovernance(treasury.address);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedController(controller.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the controller manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewController = await ethers.getContractFactory('Controller');
            const newController = await NewController.deploy(fakeManager.address);
            await expect(
                manager.connect(treasury).setAllowedController(newController.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedController(controller.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed controller when called by governance', async () => {
            const NewController = await ethers.getContractFactory('Controller');
            const newController = await NewController.deploy(manager.address);
            await expect(
                manager.connect(treasury).setAllowedController(newController.address, true)
            )
                .to.emit(manager, 'AllowedController')
                .withArgs(newController.address, true);
            expect(await manager.allowedControllers(newController.address)).to.be.equal(true);
        });

        it('should unset the allowed controller when called by governance', async () => {
            expect(await manager.allowedControllers(controller.address)).to.be.equal(true);
            await expect(
                manager.connect(treasury).setAllowedController(controller.address, false)
            )
                .to.emit(manager, 'AllowedController')
                .withArgs(controller.address, false);
            expect(await manager.allowedControllers(controller.address)).to.be.equal(false);
        });
    });

    describe('setAllowedConverter', () => {
        beforeEach(async () => {
            await manager.connect(deployer).setGovernance(treasury.address);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedConverter(converter.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the converter manager is not this manager', async () => {
            const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewConverter = await ethers.getContractFactory('StablesConverter');
            const newConverter = await NewConverter.deploy(
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                stableSwap3Pool.address,
                fakeManager.address
            );
            await expect(
                manager.connect(treasury).setAllowedController(newConverter.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedConverter(converter.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed converter when called by governance', async () => {
            const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            const NewConverter = await ethers.getContractFactory('StablesConverter');
            const newConverter = await NewConverter.deploy(
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                stableSwap3Pool.address,
                manager.address
            );
            await expect(
                manager.connect(treasury).setAllowedConverter(newConverter.address, true)
            )
                .to.emit(manager, 'AllowedConverter')
                .withArgs(newConverter.address, true);
            expect(await manager.allowedConverters(newConverter.address)).to.be.equal(true);
        });

        it('should unset the allowed converter when called by governance', async () => {
            expect(await manager.allowedConverters(converter.address)).to.be.equal(true);
            await expect(
                manager.connect(treasury).setAllowedConverter(converter.address, false)
            )
                .to.emit(manager, 'AllowedConverter')
                .withArgs(converter.address, false);
            expect(await manager.allowedConverters(converter.address)).to.be.equal(false);
        });
    });

    describe('setAllowedStrategy', () => {
        let strategy, crv, weth, gauge, minter, stableSwap3Pool, router;

        beforeEach(async () => {
            stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
            weth = await deployments.get('WETH');
            const CRV = await ethers.getContractFactory('MockERC20');
            crv = await CRV.deploy('Curve.fi', 'CRV', 18);
            const Gauge = await ethers.getContractFactory('MockCurveGauge');
            gauge = await Gauge.deploy(t3crv.address);
            const Minter = await ethers.getContractFactory('MockCurveMinter');
            minter = await Minter.deploy(crv.address);
            const Router = await ethers.getContractFactory('MockUniswapRouter');
            router = await Router.deploy(ethers.constants.AddressZero);
            const Strategy = await ethers.getContractFactory('NativeStrategyCurve3Crv');
            strategy = await Strategy.deploy(
                'Original Strategy',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                controller.address,
                manager.address,
                router.address
            );
            await manager.connect(deployer).setGovernance(treasury.address);
            await manager.connect(treasury).setAllowedStrategy(strategy.address, true);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedStrategy(strategy.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the strategy manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewStrategy = await ethers.getContractFactory('NativeStrategyCurve3Crv');
            const newStrategy = await NewStrategy.deploy(
                'Bad Strategy',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                controller.address,
                fakeManager.address,
                router.address
            );
            await expect(
                manager.connect(treasury).setAllowedStrategy(newStrategy.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedStrategy(strategy.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed strategy when called by governance', async () => {
            const NewStrategy = await ethers.getContractFactory('NativeStrategyCurve3Crv');
            const newStrategy = await NewStrategy.deploy(
                'New Strategy',
                t3crv.address,
                crv.address,
                weth.address,
                dai.address,
                usdc.address,
                usdt.address,
                gauge.address,
                minter.address,
                stableSwap3Pool.address,
                controller.address,
                manager.address,
                router.address
            );
            await expect(
                manager.connect(treasury).setAllowedStrategy(newStrategy.address, true)
            )
                .to.emit(manager, 'AllowedStrategy')
                .withArgs(newStrategy.address, true);
            expect(await manager.allowedStrategies(newStrategy.address)).to.be.equal(true);
        });

        it('should unset the allowed strategy when called by governance', async () => {
            expect(await manager.allowedStrategies(strategy.address)).to.be.equal(true);
            await expect(manager.connect(treasury).setAllowedStrategy(strategy.address, false))
                .to.emit(manager, 'AllowedStrategy')
                .withArgs(strategy.address, false);
            expect(await manager.allowedStrategies(strategy.address)).to.be.equal(false);
        });
    });

    describe('setAllowedToken', () => {
        let token;

        beforeEach(async () => {
            const Token = await ethers.getContractFactory('MockERC20');
            token = await Token.deploy('Token', 'TKN', 18);
            await manager.connect(deployer).setGovernance(treasury.address);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedToken(token.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedToken(token.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed token when called by governance', async () => {
            await expect(manager.connect(treasury).setAllowedToken(token.address, true))
                .to.emit(manager, 'AllowedToken')
                .withArgs(token.address, true);
            expect(await manager.allowedTokens(token.address)).to.be.equal(true);
        });

        it('should unset the allowed token when called by governance', async () => {
            await manager.connect(treasury).setAllowedToken(token.address, true);
            expect(await manager.allowedTokens(token.address)).to.be.equal(true);
            await expect(manager.connect(treasury).setAllowedToken(token.address, false))
                .to.emit(manager, 'AllowedToken')
                .withArgs(token.address, false);
            expect(await manager.allowedTokens(token.address)).to.be.equal(false);
        });
    });

    describe('setAllowedVault', () => {
        let vault;

        beforeEach(async () => {
            const Vault = await ethers.getContractFactory('Vault');
            vault = await Vault.deploy('Vault', 'V', manager.address);
            await manager.connect(deployer).setGovernance(treasury.address);
        });

        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(deployer).setAllowedVault(vault.address, true)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the vault manager is not this manager', async () => {
            const FakeManager = await ethers.getContractFactory('Manager');
            const fakeManager = await FakeManager.deploy(yaxis.address);
            const NewVault = await ethers.getContractFactory('Vault');
            const newVault = await NewVault.deploy('Bad Vault', 'BV', fakeManager.address);
            await expect(
                manager.connect(treasury).setAllowedVault(newVault.address, true)
            ).to.be.revertedWith('!manager');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setAllowedVault(vault.address, true)
            ).to.be.revertedWith('halted');
        });

        it('should set the allowed vault when called by governance', async () => {
            await expect(manager.connect(treasury).setAllowedVault(vault.address, true))
                .to.emit(manager, 'AllowedVault')
                .withArgs(vault.address, true);
            expect(await manager.allowedVaults(vault.address)).to.be.equal(true);
        });

        it('should unset the allowed converter when called by governance', async () => {
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            expect(await manager.allowedVaults(vault.address)).to.be.equal(true);
            await expect(manager.connect(treasury).setAllowedVault(vault.address, false))
                .to.emit(manager, 'AllowedVault')
                .withArgs(vault.address, false);
            expect(await manager.allowedVaults(vault.address)).to.be.equal(false);
        });
    });

    describe('setGovernance', () => {
        it('should revert when called by non-governance address', async () => {
            await expect(
                manager.connect(user).setGovernance(treasury.address)
            ).to.be.revertedWith('!governance');
        });

        it('should revert if the manager is halted', async () => {
            await manager.connect(deployer).setHalted();
            await expect(
                manager.connect(deployer).setGovernance(treasury.address)
            ).to.be.revertedWith('halted');
        });

        it('should set the new governance when called by governance', async () => {
            await expect(manager.connect(deployer).setGovernance(treasury.address))
                .to.emit(manager, 'SetGovernance')
                .withArgs(treasury.address);
            expect(await manager.governance()).to.be.equal(treasury.address);
        });
    });
});
