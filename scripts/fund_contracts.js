const { INIT_BALANCE } = require('../test/helpers/common');
const hardhat = require('hardhat');
const { deployments, getChainId, getNamedAccounts, web3 } = hardhat;

(async () => {
    const chainId = await getChainId();
    if (chainId == '1') {
        console.error('This should not be ran on mainnet');
        process.exit(1);
    }
    const {
        CRV,
        DAI,
        PICKLE,
        T3CRV,
        USDC,
        USDT,
        WETH,
        YAX,
        deployer
    } = await getNamedAccounts();

    const vault = await deployments.get('yAxisMetaVault');
    const stableSwap3Pool = await deployments.get('MockStableSwap3Pool');
    const unirouter = await deployments.get('MockUniswapRouter');
    const pchef = await deployments.get('MockPickleMasterChef');
    const MockERC20 = await deployments.getArtifact('MockERC20');
    const minter = await deployments.get('MockCurveMinter');
    const yax = new web3.eth.Contract(MockERC20.abi, YAX);
    const dai = new web3.eth.Contract(MockERC20.abi, DAI);
    const usdc = new web3.eth.Contract(MockERC20.abi, USDC);
    const usdt = new web3.eth.Contract(MockERC20.abi, USDT);
    const t3crv = new web3.eth.Contract(MockERC20.abi, T3CRV);
    const weth = new web3.eth.Contract(MockERC20.abi, WETH);
    const crv = new web3.eth.Contract(MockERC20.abi, CRV);
    const pickle = new web3.eth.Contract(MockERC20.abi, PICKLE);

    await yax.methods.mint(vault.address, INIT_BALANCE).send({ from: deployer });
    await dai.methods.mint(stableSwap3Pool.address, INIT_BALANCE).send({ from: deployer });
    await usdc.methods.mint(stableSwap3Pool.address, '1000000000').send({ from: deployer });
    await usdt.methods.mint(stableSwap3Pool.address, '1000000000').send({ from: deployer });
    await t3crv.methods.mint(stableSwap3Pool.address, INIT_BALANCE).send({ from: deployer });
    await yax.methods.mint(unirouter.address, INIT_BALANCE).send({ from: deployer });
    await weth.methods.mint(unirouter.address, INIT_BALANCE).send({ from: deployer });
    await dai.methods.mint(unirouter.address, INIT_BALANCE).send({ from: deployer });
    await usdc.methods.mint(unirouter.address, INIT_BALANCE).send({ from: deployer });
    await usdt.methods.mint(unirouter.address, INIT_BALANCE).send({ from: deployer });
    await crv.methods.mint(minter.address, INIT_BALANCE).send({ from: deployer });
    await pickle.methods.mint(pchef.address, INIT_BALANCE).send({ from: deployer });
})();
