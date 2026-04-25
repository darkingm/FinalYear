import { expect } from "chai";
import { ethers } from "hardhat";

describe("RWA V2 governance", function () {
  it("self-delegates minted holders so future proposals can be voted on", async function () {
    const [admin, investor] = await ethers.getSigners();

    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const compliance = await ComplianceRegistry.deploy(admin.address);

    await compliance.setKYCStatus(investor.address, true, "VN", 0);

    const RWATokenV2 = await ethers.getContractFactory("RWATokenV2");
    const token = await RWATokenV2.deploy(
      "Demo Tower",
      "DTWR",
      "asset-001",
      0,
      "ipfs://demo",
      1_000_000n * 1_000_000n,
      100_000n * 1_000_000n,
      await compliance.getAddress(),
      admin.address,
      ethers.ZeroAddress,
    );

    const GovernanceRWA = await ethers.getContractFactory("GovernanceRWA");
    const governance = await GovernanceRWA.deploy(
      await token.getAddress(),
      admin.address,
      50,
      67,
      2 * 24 * 60 * 60,
      100,
    );

    await token.mint(investor.address, ethers.parseUnits("10", 18));

    expect(await token.delegates(investor.address)).to.equal(investor.address);

    const createTx = await governance
      .connect(investor)
      ["createProposal(uint8,string,string,bytes32)"](0, "Approve demo operations", "", ethers.ZeroHash);
    await createTx.wait();
    const proposalId = await governance.proposalCount();
    expect(proposalId).to.equal(1n);

    await expect(governance.connect(investor).castVote(proposalId, true))
      .to.emit(governance, "VoteCast")
      .withArgs(proposalId, investor.address, true, ethers.parseUnits("10", 18));
  });
});
