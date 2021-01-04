# yAxis Security Bug Bounty

In order to ensure longevity of the project and incentivize white hat hackers for finding vulnerabilities within the yAxis contracts, we are introducing a bounty program which rewards valid reports with YAX from the project treasury.

## Payment Amounts

### Critical: 5000 YAX

Critical reports require that a strategy or vault would suffer a complete loss of funds.

### High: 1000 YAX

High reports would cause users to temporarily be unable to recover funds.

### Medium: 500 YAX

Medium reports include unexpected behaviors of the contract which would cause harm to users.

### Low: 100 YAX

Low reports include unexpected behaviors of the contract which do not cause harm to users.

## Program Rules

The following behavior is forbidden and will cause the reporter to be ineligible:

- Any testing with mainnet or public testnet contracts; all testing should be done on private testnets
- Any testing with pricing oracles or third party smart contracts
- Attempting phishing or other social engineering attacks against our employees and/or customers
- Any testing with third party systems and applications (e.g. browser extensions) as well as websites (e.g. SSO providers, advertising networks)
- Any denial of service attacks
- Automated testing of services that generates significant amounts of traffic
- Disassembly or reverse engineering of binaries for which source code is not published, not including smart contract bytecode
- Public disclosure of an unpatched vulnerability in an embargoed bounty

Please send reports to: https://immunefi.com/bounty/yaxis/

Or email: security@yaxis.finance

Or reach out to the Team role on Discord: https://discord.gg/FxakjWT

## In-Scope & Eligible for Bounty

The following assets are considered in-scope and eligible for bounty rewards.

_Special note: flash-loan attacks and oracle manipulation reports are in-scope and eligible for bounty in this program._

### Github repository: metavault

Located at: https://github.com/yaxis-project/metavault

The contracts in the metavault have undergone a complete refactor (with the exception of the yAxisMetaVault contract). As of right now, the refactored contracts are not deployed to mainnet.

### yAxisMetavault

Deployed at: https://etherscan.io/address/0xbfbec72f2450ef9ab742e4a27441fa06ca79ea6a#code

This contract is considered stable but is the highest valued asset of the bounty program. Critical issues found here would require redeployment and user migration to a new contract.

### StrategyControllerV1

Deployed at: https://etherscan.io/address/0x2ebe1461d2fc6dabf079882cfc51e5013bba49b6#code

This is the current controller for the yAxis Metavault. It will soon be replaced by a V2 controller. Until then, it is considered in-scope.

### StrategyCurve3Crv

Deployed at: https://etherscan.io/address/0xd721d16a685f63a4e8c4e8c5988b76bec6a85c90#code

This is the current strategy of the yAxis Metavault.

### yAxisBar

Deployed at: https://etherscan.io/address/0xeF31Cb88048416E301Fee1eA13e7664b887BA7e8#code

This is the YAX staking contract that mints sYAX to stakers.

### yAxisToken

Deployed at: https://etherscan.io/address/0xb1dc9124c395c1e97773ab855d66e879f053a289#code

This is the YAX token contract.

### yAxisChef

Deployed at: https://etherscan.io/address/0xc330e7e73717cd13fb6ba068ee871584cf8a194f#code

This is the liquidity provider staking contract that mints YAX to LPs.

### yAxisMetavaultManager

Deployed at: https://etherscan.io/address/0x9cd645330e64b07810dde54dee1240060071f6aa#code

This is a storage reference contract that most contracts related to the vault refer to.

### Ineligible Reports

- Attacks that the reporter has already exploited himself, leading to damage
- Attacks that rely on social engineering
- Attacks requiring access to leaked keys/credentials
- Attacks requiring access to privileged addresses (governance, strategist)
- Incorrect data supplied by third party oracles
- Basic economic governance attacks (e.g. 51% attack)
- Lack of liquidity
- Best practice critiques
- Deployment/private keys/secrets in test data
- Sybil attacks

## In-Scope & Ineligible for Bounty

The following assets are considered in-scope, but will not be rewarded with any bounty for reports.

### yAxis Domains & Sites

Located at: https://yaxis.io/

Includes all paths and sub-domains.

#### Excluding:

- Theoretical vulnerabilities without any proof or demonstration
- Content spoofing / Text injection issues
- Self-XSS
- Captcha bypass using OCR
- CSRF with no security impact (logout CSRF, change language, etc.)
- Missing HTTP Security Headers (such as X-FRAME-OPTIONS) or cookie security flags (such as “httponly”)
- Server-side information disclosure such as IPs, server names, and most stack traces
- Vulnerabilities used to enumerate or confirm the existence of users or tenants
- Vulnerabilities requiring unlikely user actions
- URL Redirects (unless combined with another vulnerability to produce a more severe vulnerability)
- Lack of SSL/TLS best practices
- DDoS vulnerabilities
- Attacks requiring privileged access from within the organization

## Out-of-Scope & Ineligible for Bounty

### Ghost.org (Blog)

This is our blogging platform site, which is hosted by Ghost.org.

### Discord & Telegram

These are messaging protocols hosted by their respective platforms.

### Any asset not explicitly listed in this program

If you come across something that you think should be considered in scope, feel free to reach out and we can asses. However, we want the focus of this bounty to be on the smart contracts.
