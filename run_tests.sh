#! /bin/bash

set -e

# Add tests here that should be ran during CI
yarn test:metavault
yarn test:token
