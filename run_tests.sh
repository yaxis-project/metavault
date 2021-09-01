#! /bin/bash

set -e

# Add tests here that should be ran during CI
yarn test:v3
yarn test:token
