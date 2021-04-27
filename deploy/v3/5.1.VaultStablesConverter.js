module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { DAI, USDC, USDT, T3CRV, deployer, stableSwap3Pool } = await getNamedAccounts();
    const chainId = await getChainId();
    const Manager = await deployments.get('Manager');

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
    }

    const converter = await deploy('StablesConverter', {
        from: deployer,
        log: true,
        args: [DAI, USDC, USDT, T3CRV, stableSwap3Pool, Manager.address]
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
        }
    }
};

module.exports.tags = ['v3'];
