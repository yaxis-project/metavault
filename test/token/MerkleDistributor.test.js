const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;

describe('MerkleDistributor', () => {
    const MERKLE_ROOT = '0x3dfe13c4a605fd21576c89fa0b335cedb97b748cada972e960abc763da1a4449';
    let yaxis, merkle;

    beforeEach(async () => {
        await deployments.fixture(['token', 'merkledrop']);
        const YaxisToken = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('YaxisToken', YaxisToken.address);
        const MerkleDistributor = await deployments.get('MerkleDistributor');
        merkle = await ethers.getContractAt('MerkleDistributor', MerkleDistributor.address);
    });

    it('should deploy with initial state set', async () => {
        expect(await merkle.token()).to.be.equal(yaxis.address);
        expect(await merkle.merkleRoot()).to.be.equal(MERKLE_ROOT);
    });
});
