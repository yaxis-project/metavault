const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { setupTestMetavault } = require('../helpers/setup');

describe('StableSwap3PoolConverter', () => {
    let converter, deployer, user, dai;

    before(async () => {
        const config = await setupTestMetavault();
        user = await ethers.provider.getSigner(config.user);
        deployer = config.deployer;
        dai = config.dai;

        const Converter = await deployments.get('StableSwap3PoolConverter');
        converter = await ethers.getContractAt(
            'StableSwap3PoolConverter',
            Converter.address,
            deployer
        );
    });

    it('should not allow unpermissioned callers', async () => {
        await expect(
            converter.connect(user).approveForSpender(dai.address, converter.address, 1)
        ).to.be.revertedWith('!governance');
    });

    it('should approve for spender', async () => {
        expect(await dai.allowance(converter.address, deployer)).to.equal(0);
        await converter.approveForSpender(dai.address, deployer, 1);
        expect(await dai.allowance(converter.address, deployer)).to.equal(1);
    });
});
