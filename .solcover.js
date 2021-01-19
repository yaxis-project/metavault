module.exports = {
    skipFiles: ['interfaces/', 'metavault/mock'],
    mocha: {
        grep: '@skip-on-coverage',
        invert: true
    }
};
