const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;

describe('Controller', () => {
    let deployer, treasury;
    let manager, controller, converter, vault, dai, strategyCrv;

    beforeEach(async () => {
        await deployments.fixture(['v3', 'NativeStrategyCurve3Crv']);
        [deployer, treasury] = await ethers.getSigners();
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        converter = await deployments.get('StablesConverter');

        const Vault = await deployments.deploy('Vault', {
            from: deployer.address,
            args: ['Vault: Stables', 'MV:S', manager.address]
        });
        vault = await ethers.getContractAt('Vault', Vault.address);

        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);

        const StrategyCrv = await deployments.get('NativeStrategyCurve3Crv');
        strategyCrv = await ethers.getContractAt(
            'NativeStrategyCurve3Crv',
            StrategyCrv.address,
            deployer
        );
    });

    it('should deploy with expected state', async () => {
        expect(await controller.manager()).to.equal(manager.address);
        expect(await controller.globalInvestEnabled()).to.be.true;
        expect(await controller.maxStrategies()).to.equal(10);
    });

    describe('addStrategy', () => {
        beforeEach(async () => {
            await controller.connect(deployer).setConverter(vault.address, converter.address);
        });

        it('should revert if the strategy is not allowed', async () => {
            await expect(
                controller.addStrategy(vault.address, strategyCrv.address, 0, 86400)
            ).to.be.revertedWith('!allowedStrategy');
        });

        context('when the strategy is allowed', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.addToken(vault.address, dai.address);
            });

            it('should add the strategy', async () => {
                await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
            });
        });
    });
});
