module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { YAX, SYAX, YaxisChef, YaxEthUniswapV2Pair, deployer } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        YAX = yax.address;
        const syax = await deployments.get('sYAX');
        SYAX = syax.address;
        const Chef = await deployments.get('MockYaxisChef');
        YaxisChef = Chef.address;
        const Pair = await deployments.get('YaxEthUniswapV2Pair');
        YaxEthUniswapV2Pair = Pair.address;
        await deploy('YaxisVoteProxy', {
            from: deployer,
            log: true
        });
    }

    const votePower = await deploy('YaxisVotePower', {
        from: deployer,
        log: true,
        args: [YAX, YaxisChef, SYAX, YaxEthUniswapV2Pair]
    });

    if (chainId != '1') {
        await execute('YaxisVoteProxy', { from: deployer }, 'setVoteProxy', votePower.address);
    }
};

module.exports.tags = ['governance', 'snapshot'];
