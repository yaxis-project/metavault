const { constants, ether, expectRevert } = require('@openzeppelin/test-helpers');
const { fromWei } = web3.utils;

exports.INIT_BALANCE = ether('1000');

exports.MAX = web3.utils.toTwosComplement(-1);

exports.constants = constants;

exports.ether = ether;

exports.expectRevert = expectRevert;

exports.fromWei = fromWei;

exports.fromWeiWithDecimals = (num, decimals = 18) => {
    num = Number.parseFloat(String(num));
    for (let i = 0; i < decimals; i++) num = num * 0.1;
    return num.toFixed(2);
};

exports.verbose = process.env.VERBOSE;
