const { expectRevert, time } = require('@openzeppelin/test-helpers');

const yAxisMetaVault = artifacts.require('yAxisMetaVault');
const yAxisMetaVaultManager = artifacts.require('yAxisMetaVaultManager');
const StableSwap3PoolConverter = artifacts.require('StableSwap3PoolConverter');

const MockERC20 = artifacts.require('MockERC20');
const MockStableSwap3Pool = artifacts.require('MockStableSwap3Pool');

const verbose = process.env.VERBOSE;

function fromWeiWithDecimals(num, decimals = 18) {
    num = Number.parseFloat(String(num));
    for (let i = 0; i < decimals; i++) num = num * 0.1;
    return num.toFixed(2);
}

async function advanceBlocks(blocks) {
    for (let i = 0; i < blocks; i++) {
        await time.advanceBlock();
    }
}

contract('yAxisMetaVault', async (accounts) => {
    const { toWei } = web3.utils;
    const { fromWei } = web3.utils;
    const bob = accounts[1];

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = toWei('1000');

    let YAX;
    let DAI;
    let USDC;
    let USDT;
    let T3CRV; // addresses
    let yax;
    let dai;
    let usdc;
    let usdt;
    let t3crv; // MockERC20s

    let mvault;
    let MVAULT;

    let vmanager;
    let VMANAGER;

    let stableSwap3Pool;
    let STABLESWAP3POOL;

    let converter;
    let CONVERTER;

    before(async () => {
        yax = await MockERC20.new('yAxis', 'YAX', 18);
        dai = await MockERC20.new('Dai Stablecoin', 'DAI', 18);
        usdc = await MockERC20.new('USD Coin', 'USDC', 6);
        usdt = await MockERC20.new('Tether', 'USDT', 6);
        t3crv = await MockERC20.new('Curve.fi DAI/USDC/USDT', '3Crv', 18);

        YAX = yax.address;
        DAI = dai.address;
        USDC = usdc.address;
        USDT = usdt.address;
        T3CRV = t3crv.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IERC20 _tokenYAX, uint _yaxPerBlock, uint _startBlock)
        const _yaxPerBlock = '10000000000000';
        const _startBlock = 1;
        mvault = await yAxisMetaVault.new(
            DAI,
            USDC,
            USDT,
            T3CRV,
            YAX,
            _yaxPerBlock,
            _startBlock
        );
        MVAULT = mvault.address;

        // constructor (IERC20 _yax)
        vmanager = await yAxisMetaVaultManager.new(YAX);
        VMANAGER = vmanager.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV)
        stableSwap3Pool = await MockStableSwap3Pool.new(DAI, USDC, USDT, T3CRV);
        STABLESWAP3POOL = stableSwap3Pool.address;

        // constructor (IERC20 _tokenDAI, IERC20 _tokenUSDC, IERC20 _tokenUSDT, IERC20 _token3CRV, IStableSwap3Pool _stableSwap3Pool, IVaultManager _vaultMaster)
        converter = await StableSwap3PoolConverter.new(
            DAI,
            USDC,
            USDT,
            T3CRV,
            STABLESWAP3POOL,
            VMANAGER
        );
        CONVERTER = converter.address;

        await mvault.setConverter(CONVERTER);
        await vmanager.setVaultStatus(MVAULT, true);

        await dai.approve(MVAULT, MAX, { from: bob });
        await usdc.approve(MVAULT, MAX, { from: bob });
        await usdt.approve(MVAULT, MAX, { from: bob });
        await t3crv.approve(MVAULT, MAX, { from: bob });
        await mvault.approve(MVAULT, MAX, { from: bob });

        await yax.mint(MVAULT, INIT_BALANCE);
        await dai.mint(STABLESWAP3POOL, INIT_BALANCE);
        await usdc.mint(STABLESWAP3POOL, '1000000000');
        await usdt.mint(STABLESWAP3POOL, '1000000000');
        await t3crv.mint(STABLESWAP3POOL, INIT_BALANCE);

        await dai.mint(bob, INIT_BALANCE);
        await usdc.mint(bob, '1000000000');
        await usdt.mint(bob, '1000000000');
        await t3crv.mint(bob, INIT_BALANCE);
    });

    async function printBalances(title) {
        console.log(title);
        console.log('mvault T3CRV:    ', fromWei(await t3crv.balanceOf(mvault.address)));
        console.log('mvault MVLT:     ', fromWei(await mvault.balanceOf(mvault.address)));
        console.log('mvault Supply:   ', fromWei(await mvault.totalSupply()));
        console.log('-------------------');
        console.log(
            'bob balances: %s DAI/ %s USDC/ %s USDT/ %s T3CRV/ %s YAX',
            fromWei(await dai.balanceOf(bob)),
            fromWeiWithDecimals(await usdc.balanceOf(bob), 6),
            fromWeiWithDecimals(await usdt.balanceOf(bob), 6),
            fromWei(await t3crv.balanceOf(bob)),
            fromWei(await yax.balanceOf(bob))
        );
        console.log('bob MVLT:        ', fromWei(await mvault.balanceOf(bob)));
        console.log('-------------------');
    }

    async function printStakeInfo(account_name, account) {
        console.log('yaxPerBlock:        ', fromWei(await mvault.yaxPerBlock()));
        console.log('lastRewardBlock:    ', String(await mvault.lastRewardBlock()));
        console.log('accYaxPerShare:     ', fromWei(await mvault.accYaxPerShare()));
        const userInfo = await mvault.userInfo(account);
        console.log('%s UserInfo:        ', account_name, JSON.stringify(userInfo));
        console.log('%s amount:          ', account_name, fromWei(userInfo.amount));
        console.log('-------------------');
    }

    beforeEach(async () => {
        if (verbose) {
            await printBalances('\n=== BEFORE ===');
        }
    });

    afterEach(async () => {
        if (verbose) {
            await printBalances('\n=== AFTER ===');
        }
    });

    describe('vault should work', () => {
        it('deposit', async () => {
            const _amount = toWei('10');
            await expectRevert(
                mvault.deposit(_amount, DAI, toWei('100'), true, { from: bob }),
                'slippage'
            );
            await mvault.deposit(_amount, DAI, 1, true, { from: bob });
            assert.equal(String(await dai.balanceOf(bob)), toWei('990'));
        });

        it('depositAll', async () => {
            const _amounts = ['0', '10000000', '10000000', toWei('10')];
            // function depositAll(uint[4] calldata _amounts, uint _min_mint_amount, bool _isStake) external {
            await mvault.depositAll(_amounts, 1, true, { from: bob });
            assert.equal(String(await dai.balanceOf(bob)), toWei('990'));
            assert.equal(String(await usdc.balanceOf(bob)), '990000000');
            assert.equal(String(await usdt.balanceOf(bob)), '990000000');
            assert.equal(String(await t3crv.balanceOf(bob)), toWei('990'));
            if (verbose) {
                await printStakeInfo('bob', bob);
            }
        });

        it('stakeShares', async () => {
            const _amount = '10000000';
            await mvault.deposit(_amount, USDC, 1, false, { from: bob });
            const _shares = String(await mvault.balanceOf(bob));
            assert.equal(_shares, toWei('9.995'));
            // function stakeShares(uint _shares)
            await mvault.stakeShares(_shares, { from: bob });
            const userInfo = await mvault.userInfo(bob);
            assert.equal(String(userInfo.amount), toWei('50'));
            if (verbose) {
                await printStakeInfo('bob', bob);
            }
        });

        it('pendingYax', async () => {
            await advanceBlocks(10);
            const _pendingYax = String(await mvault.pendingYax(bob));
            assert.equal(_pendingYax, toWei('8.6'));
        });

        it('unstake(0) for getting reward', async () => {
            const _before = Number.parseInt(await yax.balanceOf(bob));
            await advanceBlocks(10);
            await mvault.unstake(0, { from: bob });
            const _after = Number.parseInt(await yax.balanceOf(bob));
            assert.ok(_before < _after, 'getting zero rewards!');
        });

        it('unstake', async () => {
            await mvault.unstake(toWei('20'), { from: bob });
            const userInfo = await mvault.userInfo(bob);
            assert.equal(String(userInfo.amount), toWei('30'));
        });

        it('withdraw T3CRV', async () => {
            await mvault.withdraw(toWei('5'), T3CRV, { from: bob });
            assert.equal(String(await mvault.balanceOf(bob)), toWei('15'));
            assert.equal(String(await t3crv.balanceOf(bob)), toWei('995'));
        });

        it('withdraw DAI', async () => {
            await mvault.withdraw(toWei('5'), DAI, { from: bob });
            assert.equal(String(await mvault.balanceOf(bob)), toWei('10'));
            assert.ok(
                Number.parseFloat(await dai.balanceOf(bob)) >=
                    Number.parseFloat(toWei('994.99')),
                'less DAI then expected!'
            );
        });

        it('withdraw USDT', async () => {
            await mvault.withdraw(toWei('5'), USDT, { from: bob });
            assert.equal(String(await mvault.balanceOf(bob)), toWei('5'));
            assert.ok(
                Number.parseFloat(await usdt.balanceOf(bob)) >= Number.parseFloat('995000000'),
                'less USDT then expected!'
            );
        });

        it('withdraw need unstake', async () => {
            await mvault.withdraw(toWei('10'), USDC, { from: bob });
            assert.equal(String(await mvault.balanceOf(bob)), toWei('0'));
            const userInfo = await mvault.userInfo(bob);
            assert.equal(String(userInfo.amount), toWei('25'));
            assert.ok(
                Number.parseFloat(await usdc.balanceOf(bob)) >= Number.parseFloat('990000000'),
                'less USDC then expected!'
            );
        });

        it('withdrawAll to USDC', async () => {
            const _amount = '5000000';
            await mvault.deposit(_amount, USDC, 1, false, { from: bob });
            assert.ok(
                Number.parseFloat(await mvault.balanceOf(bob)) >=
                    Number.parseFloat(toWei('4.99')),
                'less MVLT then expected!'
            );
            await mvault.withdrawAll(USDC, { from: bob });
            const userInfo = await mvault.userInfo(bob);
            assert.equal(String(userInfo.amount), '0');
            assert.equal(String(await mvault.balanceOf(bob)), '0');
            assert.ok(
                Number.parseFloat(await usdc.balanceOf(bob)) >=
                    Number.parseFloat('1015000000'),
                'less USDC then expected!'
            );
        });
    });

    describe('converter should work', () => {
        it('get_dy', async () => {
            const dy = String(await converter.get_dy(0, 1, toWei('10'), { from: bob }));
            assert.equal(dy, '10025012');
        });

        it('exchange DAI to USDC', async () => {
            await vmanager.setGovernance(bob);
            await dai.transfer(CONVERTER, toWei('10'), { from: bob });
            await converter.exchange(0, 1, toWei('10'), 1, { from: bob });
            assert.ok(
                Number.parseFloat(await dai.balanceOf(bob)) >=
                    Number.parseFloat(toWei('984.99')),
                'less DAI then expected!'
            );
            assert.ok(
                Number.parseFloat(await usdc.balanceOf(bob)) >=
                    Number.parseFloat('1025000000'),
                'less USDC then expected!'
            );
        });
    });
});
