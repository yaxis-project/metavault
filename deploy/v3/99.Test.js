module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();

    const YAXIS = await deployments.deploy('YaxisToken', {
        from: deployer
    });
    const Manager = await deployments.deploy('Manager', {
        from: deployer,
        args: [YAXIS.address]
    });
    const Controller = await deployments.deploy('Controller', {
        from: deployer,
        args: [Manager.address]
    });
    const T3CRV = await deployments.deploy('T3CRV', {
        from: deployer,
        contract: 'MockERC20',
        args: ['Curve.fi DAI/USDC/USDT', '3CRV', 18]
    });
    const MIM3CRV = await deployments.deploy('MIM3CRV', {
        from: deployer,
        contract: 'MockERC20',
        args: ['Curve.fi Factory USD Metapool: Magic Internet Money 3Pool', 'MIM-3LP3CRV', 18]
    });
    const DAI = await deployments.deploy('DAI', {
        from: deployer,
        contract: 'MockERC20',
        args: ['Dai Stablecoin', 'DAI', 18]
    });
    const USDC = await deployments.deploy('USDC', {
        from: deployer,
        contract: 'MockERC20',
        args: ['USD Coin', 'USDC', 6]
    });
    const USDT = await deployments.deploy('USDT', {
        from: deployer,
        contract: 'MockERC20NonStandard',
        args: ['Tether', 'USDT', 6]
    });
    const MIM = await deployments.deploy('MIM', {
        from: deployer,
        contract: 'MockERC20',
        args: ['MIM Stablecoin', 'MIM', 18]
    });
    const MOCK3CRV = await deployments.deploy('MOCK3CRV', {
        from: deployer,
        contract: 'MockERC20',
        args: ['Curve.fi DAI/USDC/USDT', 'MOCK3CRV', 18]
    });
    const CRV = await deployments.deploy('CRV', {
        contract: 'MockERC20',
        from: deployer,
        args: ['Curve.fi', 'CRV', 18]
    });
    const WETH = await deployments.deploy('WETH', {
        from: deployer,
        contract: 'MockERC20',
        args: ['Wrapped ETH', 'WETH', 18]
    });
    const StableSwap = await deployments.deploy('MockStableSwap3Pool', {
        from: deployer,
        args: [
            deployer,
            [DAI.address, USDC.address, USDT.address],
            T3CRV.address,
            200,
            4000000,
            5000000000
        ]
    });
    const MIMStableSwap = await deployments.deploy('MockStableSwap2Pool', {
        from: deployer,
        args: [
            deployer,
            [MIM.address, MOCK3CRV.address],
            MIM3CRV.address,
            200,
            4000000,
            5000000000
        ]
    });
    await deployments.execute(
        'T3CRV',
        { from: deployer },
        'transferOwnership',
        StableSwap.address
    );
    await deployments.execute(
        'MIM3CRV',
        { from: deployer },
        'transferOwnership',
        MIMStableSwap.address
    );
    await deployments.execute(
        'DAI',
        { from: deployer },
        'mint',
        deployer,
        ethers.utils.parseEther('10000000000000')
    );
    await deployments.execute(
        'USDC',
        { from: deployer },
        'mint',
        deployer,
        '10000000000000000000'
    );
    await deployments.execute(
        'USDT',
        { from: deployer },
        'mint',
        deployer,
        '10000000000000000000'
    );
    await deployments.execute(
        'MIM',
        { from: deployer },
        'mint',
        deployer,
        ethers.utils.parseEther('10000000000000')
    );
    await deployments.execute(
        'MOCK3CRV',
        { from: deployer },
        'mint',
        deployer,
        ethers.utils.parseEther('10000000000000')
    );
    await deployments.execute(
        'DAI',
        { from: deployer },
        'approve',
        StableSwap.address,
        ethers.constants.MaxUint256
    );
    await deployments.execute(
        'USDC',
        { from: deployer },
        'approve',
        StableSwap.address,
        ethers.constants.MaxUint256
    );
    await deployments.execute(
        'USDT',
        { from: deployer },
        'approve',
        StableSwap.address,
        ethers.constants.MaxUint256
    );
    await deployments.execute(
        'MIM',
        { from: deployer },
        'approve',
        MIMStableSwap.address,
        ethers.constants.MaxUint256
    );
    await deployments.execute(
        'MOCK3CRV',
        { from: deployer },
        'approve',
        MIMStableSwap.address,
        ethers.constants.MaxUint256
    );
    await deployments.execute(
        'MockStableSwap3Pool',
        { from: deployer },
        'add_liquidity',
        [ethers.utils.parseEther('200000000'), '200000000000000', '200000000000000'],
        0
    );
    await deployments.execute(
        'MockStableSwap2Pool',
        { from: deployer },
        'add_liquidity',
        [ethers.utils.parseEther('200000000'), ethers.utils.parseEther('200000000')],
        0
    );
    await deployments.deploy('StablesConverter', {
        from: deployer,
        args: [
            DAI.address,
            USDC.address,
            USDT.address,
            T3CRV.address,
            StableSwap.address,
            Manager.address
        ]
    });
    const MetaVault = await deployments.deploy('MetaVault', {
        from: deployer,
        args: [
            DAI.address,
            USDC.address,
            USDT.address,
            T3CRV.address,
            YAXIS.address,
            '10000000000000',
            1
        ]
    });
    const LegacyController = await deployments.deploy('LegacyController', {
        from: deployer,
        args: [Manager.address, MetaVault.address]
    });
    await deployments.deploy('Harvester', {
        from: deployer,
        args: [Manager.address, Controller.address, LegacyController.address]
    });
    const Gauge = await deployments.deploy('MockCurveGauge', {
        from: deployer,
        args: [T3CRV.address]
    });
    const Minter = await deployments.deploy('MockCurveMinter', {
        from: deployer,
        args: [CRV.address]
    });
    const Router = await deployments.deploy('MockUniswapRouter', {
        from: deployer,
        args: ['0x0000000000000000000000000000000000000000']
    });
    await deployments.deploy('VaultStables', {
        contract: 'Vault',
        from: deployer,
        args: ['Vault: Stables', 'MV:S', Manager.address]
    });
    await deployments.deploy('NativeStrategyCurve3Crv', {
        from: deployer,
        args: [
            'Curve: 3CRV',
            T3CRV.address,
            CRV.address,
            WETH.address,
            DAI.address,
            USDC.address,
            USDT.address,
            Gauge.address,
            Minter.address,
            StableSwap.address,
            Controller.address,
            Manager.address,
            Router.address
        ]
    });
};

module.exports.tags = ['test'];
