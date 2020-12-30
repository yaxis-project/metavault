module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        commonjs: true,
        es6: true,
        mocha: true
    },
    extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        artifacts: true,
        assert: true,
        contract: true,
        network: true,
        web3: true
    },
    parserOptions: {
        ecmaVersion: 2020
    },
    ignorePatterns: ['node_modules/', 'dist/'],
    rules: {
        'standard/no-callback-literal': 0
    }
};
