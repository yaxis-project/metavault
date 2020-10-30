import {ethers} from "hardhat";
import chai from "chai";
import {solidity} from "ethereum-waffle";
import {CurveContractV2} from "../lib/curvefi";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {ThreePoolFixture, threePoolFixture} from "./shared/fixtures";
import {getLatestBlock, mineBlock} from "./shared/utilities";

chai.use(solidity);
const {expect} = chai;

describe("3PoolCrv", () => {
	let signers: SignerWithAddress[]
	let fixture: ThreePoolFixture
	let curveTokenV2: CurveContractV2
	before(async () => {
		signers = await ethers.getSigners();
		fixture = await threePoolFixture(signers[0])
		curveTokenV2 = fixture.curve3CrvToken
	})


	describe("name", async () => {
		it("should name", async () => {
			expect(await curveTokenV2.name()).to.eq("Curve.fi DAI/USDC/USDT")
		});
	});
	describe("symbol", async () => {
		it("should symbol", async () => {
			expect(await curveTokenV2.symbol()).to.eq("3Crv");
		});
	});
	describe("balanceOf", async () => {
		it("should balanceOf", async () => {
			expect(await curveTokenV2.balanceOf(signers[0].address)).to.eq("0");
		});
	});
	describe("deposit", async () => {
		it("should deposit", async () => {
			await fixture.stableSwap3Pool.add_liquidity([1000000, 100000, 10000], 0)
			expect(await curveTokenV2.balanceOf(signers[0].address)).to.eq("1152352719166053");
		});
		it("should withdraw", async () => {
			await fixture.stableSwap3Pool.remove_liquidity("13393926561", [0, 0, 0])
			expect(await curveTokenV2.balanceOf(signers[0].address)).to.eq("1152339325239492");
		});
	});

});
