const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { setupTestMetavault } = require('../helpers/setup');

describe('StableSwap3PoolOracle', () => {
    let oracle, deployer, ethUsd, daiEth, usdcEth, usdtEth;

    before(async () => {
        const config = await setupTestMetavault();
        deployer = config.deployer;

        const Oracle = await deployments.get('StableSwap3PoolOracle');
        oracle = await ethers.getContractAt('StableSwap3PoolOracle', Oracle.address, deployer);
        const ETHUSD = await deployments.get('ETHUSD');
        ethUsd = await ethers.getContractAt('MockV3Aggregator', ETHUSD.address, deployer);
        const DAIETH = await deployments.get('DAIETH');
        daiEth = await ethers.getContractAt('MockV3Aggregator', DAIETH.address, deployer);
        const USDCETH = await deployments.get('USDCETH');
        usdcEth = await ethers.getContractAt('MockV3Aggregator', USDCETH.address, deployer);
        const USDTETH = await deployments.get('USDTETH');
        usdtEth = await ethers.getContractAt('MockV3Aggregator', USDTETH.address, deployer);
    });

    it('should deploy with expected state', async () => {
        expect(await oracle.ethUsd()).to.be.equal(ethUsd.address);
        expect(await oracle.feeds(0)).to.be.equal(daiEth.address);
        expect(await oracle.feeds(1)).to.be.equal(usdcEth.address);
        expect(await oracle.feeds(2)).to.be.equal(usdtEth.address);
    });

    it('should return the expected value from getEthereumPrice', async () => {
        expect(await oracle.getEthereumPrice()).to.be.equal('1791665585810000000000');
    });

    it('should return the expected value from getPrices', async () => {
        const prices = await oracle.getPrices();
        expect(prices._minPrice).to.be.equal('555695000000000');
        expect(prices._maxPrice).to.be.equal('559000000000000');
    });

    it('should return the expected value from getSafeAnswer', async () => {
        expect(await oracle.getSafeAnswer(usdcEth.address)).to.be.equal('558246603865858');
    });
});
