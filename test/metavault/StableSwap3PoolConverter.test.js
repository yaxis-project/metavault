const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { setupTestMetavault } = require('../helpers/setup');

describe('StableSwap3PoolConverter', () => {
    let converter, deployer, user, dai, usdc, usdt, t3crv, yax, stableSwap3Pool, vaultManager;

    before(async () => {
        const config = await setupTestMetavault();
        user = await ethers.provider.getSigner(config.user);
        deployer = config.deployer;
        yax = config.yax;
        dai = config.dai;
        usdc = config.usdc;
        usdt = config.usdt;
        t3crv = config.t3crv;
        vaultManager = config.vaultManager;

        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
        const Converter = await deployments.get('StableSwap3PoolConverter');
        converter = await ethers.getContractAt(
            'StableSwap3PoolConverter',
            Converter.address,
            deployer
        );
    });

    it('should not allow unpermissioned callers', async () => {
        await expect(
            converter.connect(user).setStableSwap3Pool(converter.address)
        ).to.be.revertedWith('!governance');
        await expect(
            converter.connect(user).setVaultManager(converter.address)
        ).to.be.revertedWith('!governance');
        await expect(
            converter.connect(user).approveForSpender(dai.address, converter.address, 1)
        ).to.be.revertedWith('!governance');
    });

    it('should approve for spender', async () => {
        expect(await dai.allowance(converter.address, deployer)).to.equal(0);
        await converter.approveForSpender(dai.address, deployer, 1);
        expect(await dai.allowance(converter.address, deployer)).to.equal(1);
    });

    it('should set the vault manager', async () => {
        await deployments.deploy('yAxisMetaVaultManager2', {
            contract: 'yAxisMetaVaultManager',
            from: deployer,
            log: true,
            args: [yax.address]
        });
        const newVaultManager = await deployments.get('yAxisMetaVaultManager2');
        expect(await converter.vaultManager()).to.equal(vaultManager.address);
        await converter.setVaultManager(newVaultManager.address);
        expect(await converter.vaultManager()).to.equal(newVaultManager.address);
    });

    it('should set the StableSwap3Pool', async () => {
        await deployments.deploy('MockStableSwap3Pool2', {
            contract: 'MockStableSwap3Pool',
            from: deployer,
            log: true,
            args: [dai.address, usdc.address, usdt.address, t3crv.address]
        });
        const newStableSwap3Pool = await deployments.get('MockStableSwap3Pool2');
        expect(await converter.stableSwap3Pool()).to.equal(stableSwap3Pool);
        await converter.setStableSwap3Pool(newStableSwap3Pool.address);
        expect(await converter.stableSwap3Pool()).to.equal(newStableSwap3Pool.address);
    });
});
