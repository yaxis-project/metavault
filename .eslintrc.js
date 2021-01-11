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
        ethers: true,
        network: true,
        task: true
    },
    parserOptions: {
        ecmaVersion: 2020
    },
    ignorePatterns: ['node_modules/', 'dist/'],
    rules: {
        'standard/no-callback-literal': 0
    }
};
