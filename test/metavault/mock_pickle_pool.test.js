const {expectRevert, time} = require('@openzeppelin/test-helpers');

const MockPickleJar = artifacts.require('MockPickleJar');
const MockPickleMasterChef = artifacts.require('MockPickleMasterChef');

const MockERC20 = artifacts.require('MockERC20');

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

contract('mock_pickle_pool.test', async (accounts) => {
    const { toWei } = web3.utils;
    const { fromWei } = web3.utils;
    const alice = accounts[0];
    const bob = accounts[1];
    const carol = accounts[2];

    const MAX = web3.utils.toTwosComplement(-1);
    const INIT_BALANCE = toWei('1000');

    let PICKLE; let DAI; let USDC; let USDT; let T3CRV; // addresses
    let pickle; let dai; let usdc; let usdt; let t3crv; // MockERC20s

    let pjar;
    let PJAR;

    let pchef;
    let PCHEF;

    before(async () => {
        pickle = await MockERC20.new('Pickle', 'PICKLE', 18);
        t3crv = await MockERC20.new('Curve.fi DAI/USDC/USDT', '3Crv', 18);

        PICKLE = pickle.address;
        T3CRV = t3crv.address;

        // constructor (IERC20 _t3crv)
        pjar = await MockPickleJar.new(T3CRV);
        PJAR = pjar.address;

        // constructor(IERC20 _pickleToken, IERC20 _lpToken)
        pchef = await MockPickleMasterChef.new(PICKLE, PJAR);
        PCHEF = pchef.address;

        await t3crv.approve(PJAR, MAX, {from: bob});
        await pjar.approve(PCHEF, MAX, {from: bob});

        await pickle.mint(PCHEF, INIT_BALANCE);

        await t3crv.mint(bob, INIT_BALANCE);
    });

    async function printBalances(title) {
        console.log(title);
        console.log('pjar T3CRV:      ', fromWei(await t3crv.balanceOf(PJAR)));
        console.log('pjar PJAR:       ', fromWei(await pjar.balanceOf(PJAR)));
        console.log('-------------------');
        console.log('pchef PJAR:      ', fromWei(await pjar.balanceOf(PCHEF)));
        console.log('pchef PICKLE:    ', fromWei(await pickle.balanceOf(PCHEF)));
        console.log('-------------------');
        console.log('bob T3CRV:       ', fromWei(await t3crv.balanceOf(bob)));
        console.log('bob PJAR:        ', fromWei(await pjar.balanceOf(bob)));
        console.log('bob PICKLE:      ', fromWei(await pickle.balanceOf(bob)));
        console.log('-------------------');
    }

    describe('pjar should work', () => {
        it('pjar deposit', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pjar deposit ===');
            }
            const _amount = toWei('10');
            await pjar.deposit(_amount, {from: bob});
            assert.equal(String(await t3crv.balanceOf(bob)), toWei('990'));
            assert.equal(String(await pjar.balanceOf(bob)), '9900990099009900990'); // -1%
            assert.equal(String(await pjar.balance()), toWei('10'));
            assert.approximately(Number(await pjar.available()), Number(toWei('9.5')), 10 ** -12); // 95%
            assert.equal(String(await t3crv.balanceOf(PJAR)), toWei('10'));
            assert.equal(String(await pjar.totalSupply()), '9900990099009900990');
            if (verbose) {
                await printBalances('\n=== AFTER pjar deposit ===');
            }
        });

        it('pjar withdraw', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pjar withdraw ===');
            }
            const _amount = toWei('1');
            await pjar.withdraw(_amount, {from: bob});
            assert.equal(String(await t3crv.balanceOf(bob)), toWei('991.01'));
            assert.equal(String(await pjar.balanceOf(bob)), '8900990099009900990');
            assert.equal(String(await t3crv.balanceOf(PJAR)), toWei('8.99'));
            if (verbose) {
                await printBalances('\n=== AFTER pjar withdraw ===');
            }
        });

        it('pjar withdrawAll', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pjar withdrawAll ===');
            }
            await pjar.withdrawAll({from: bob});
            assert.approximately(Number(await t3crv.balanceOf(bob)), Number(toWei('1000')), 10 ** -12);
            assert.equal(String(await t3crv.balanceOf(bob)), '999999999999999999999');
            assert.equal(String(await pjar.balanceOf(bob)), '0');
            assert.equal(String(await t3crv.balanceOf(PJAR)), '1'); // 1 wei left because of div precision math
            if (verbose) {
                await printBalances('\n=== AFTER pjar withdrawAll ===');
            }
        });
    });

    describe('pchef should work', () => {
        it('get PJAR (via pjar deposit)', async () => {
            const _amount = toWei('100');
            await pjar.deposit(_amount, {from: bob});
            assert.approximately(Number(await pjar.balanceOf(bob)), Number(toWei('99.00990099009901')), 10 ** -12); // -1%
        });

        it('pchef deposit', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pchef deposit ===');
            }
            const _pid = 14;
            const _amount = toWei('10');
            await pchef.deposit(_pid, _amount, {from: bob});
            assert.approximately(Number(await pjar.balanceOf(bob)), Number(toWei('89.00990099009901')), 10 ** -12);
            assert.equal(String(await pjar.balanceOf(PCHEF)), toWei('10'));
            if (verbose) {
                await printBalances('\n=== AFTER pchef deposit ===');
            }
        });

        it('pchef deposit(0) - claim', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pchef deposit(0) - claim ===');
            }
            const _pid = 14;
            await pchef.deposit(_pid, 0, {from: bob});
            assert.approximately(Number(await pjar.balanceOf(bob)), Number(toWei('89.00990099009901')), 10 ** -12);
            assert.equal(String(await pjar.balanceOf(PCHEF)), toWei('10'));
            assert.equal(String(await pickle.balanceOf(bob)), toWei('1'));
            if (verbose) {
                await printBalances('\n=== AFTER pchef deposit(0) - claim ===');
            }
        });

        it('pchef withdraw', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pchef withdraw ===');
            }
            const _pid = 14;
            const _amount = toWei('1');
            await pchef.withdraw(_pid, _amount, {from: bob});
            assert.approximately(Number(await pjar.balanceOf(bob)), Number(toWei('90.00990099009901')), 10 ** -12);
            assert.equal(String(await pjar.balanceOf(PCHEF)), toWei('9'));
            if (verbose) {
                await printBalances('\n=== AFTER pchef withdraw ===');
            }
        });

        it('pchef emergencyWithdraw', async () => {
            if (verbose) {
                await printBalances('\n=== BEFORE pchef emergencyWithdraw ===');
            }
            const _pid = 14;
            await pchef.emergencyWithdraw(_pid, {from: bob});
            assert.approximately(Number(await pjar.balanceOf(bob)), Number(toWei('99.00990099009901')), 10 ** -12);
            assert.equal(String(await pjar.balanceOf(PCHEF)), toWei('0'));
            const userInfo = await pchef.userInfo(14, bob);
            assert.equal(String(userInfo.amount), '0');
            if (verbose) {
                await printBalances('\n=== AFTER pchef emergencyWithdraw ===');
            }
        });
    });
});
