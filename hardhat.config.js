require('@nomiclabs/hardhat-truffle5');

module.exports = {
    networks: {
        hardhat: {}
    },
    solidity: {
        version: '0.6.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    paths: {
        sources: './contracts',
        tests: './test'
    },
    mocha: {
        timeout: 20000
    }
};
