module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let {
        DAI,
        USDC,
        USDT,
        T3CRV,
        ETHUSD,
        DAIETH,
        USDCETH,
        USDTETH,
        deployer,
        stableSwap3Pool
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('VaultStables');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const ethUsd = await deployments.get('ETHUSD');
        ETHUSD = ethUsd.address;
        const daiEth = await deployments.get('DAIETH');
        DAIETH = daiEth.address;
        const usdcEth = await deployments.get('USDCETH');
        USDCETH = usdcEth.address;
        const usdtEth = await deployments.get('USDTETH');
        USDTETH = usdtEth.address;
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
    }

    const oracle = await deploy('StableSwap3PoolOracle', {
        from: deployer,
        log: true,
        args: [ETHUSD, DAIETH, USDCETH, USDTETH]
    });

    const converter = await deploy('StableSwap3PoolConverter', {
        from: deployer,
        log: true,
        args: [DAI, USDC, USDT, T3CRV, stableSwap3Pool, Manager.address, oracle.address]
    });

    if (converter.newlyDeployed) {
        const manager = await ethers.getContractAt('Manager', Manager.address, deployer);
        if ((await manager.governance()) == deployer) {
            await execute(
                'Manager',
                { from: deployer, log: true },
                'setAllowedConverter',
                converter.address,
                true
            );

            await execute(
                'Controller',
                { from: deployer, log: true },
                'setConverter',
                Vault.address,
                converter.address
            );
        }
    }
};

module.exports.tags = ['v3'];
