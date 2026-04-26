import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * EscrowCore.test.ts — comprehensive test suite
 *
 * Coverage targets (original plan Phase 5):
 *   - Happy path: deposit ERC20, depositNative, releasePayment,
 *     buyerConfirmDelivery (onTime true/false), refund, refundExpired,
 *     depositBatch, depositNativeBatch.
 *   - Edge: duplicate orderId, invalid status transitions, pause guard,
 *     access control (OPERATOR_ROLE, ADMIN_ROLE, buyer/seller only),
 *     length mismatch in batch, msg.value mismatch in nativeBatch,
 *     SBT dynamic fee, zero-address seller rejection.
 */

describe("EscrowCore", function () {
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let feeVault: HardhatEthersSigner;

  let escrow: any;
  let usdt: any;

  const FEE_BPS = 50n; // 0.5%
  const ORDER_TIMEOUT = 30n * 24n * 60n * 60n; // 30 days

  function orderId(label: string) {
    return ethers.keccak256(ethers.toUtf8Bytes(label));
  }

  async function mintAndApprove(to: HardhatEthersSigner, amount: bigint) {
    await usdt.connect(admin).mint(to.address, amount);
    await usdt.connect(to).approve(await escrow.getAddress(), amount);
  }

  beforeEach(async function () {
    [admin, operator, buyer, seller, stranger, feeVault] =
      await ethers.getSigners();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDT.deploy(admin.address, 0);

    const EscrowCore = await ethers.getContractFactory("EscrowCore");
    escrow = await EscrowCore.deploy(feeVault.address);

    // Grant operator role
    const OPERATOR_ROLE = await escrow.OPERATOR_ROLE();
    await escrow.grantRole(OPERATOR_ROLE, operator.address);
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * HAPPY PATH
   * ═══════════════════════════════════════════════════════════════════════ */

  describe("deposit (ERC20)", () => {
    it("creates order with correct fields and emits OrderCreated", async () => {
      const amount = ethers.parseUnits("100", 6);
      await mintAndApprove(buyer, amount);
      const id = orderId("erc20-1");

      await expect(
        escrow
          .connect(buyer)
          .deposit(id, await usdt.getAddress(), amount, seller.address)
      )
        .to.emit(escrow, "OrderCreated")
        .withArgs(id, buyer.address, seller.address, await usdt.getAddress(), () => true, () => true);

      const o = await escrow.getOrder(id);
      expect(o.buyer).to.equal(buyer.address);
      expect(o.seller).to.equal(seller.address);
      expect(o.status).to.equal(1n); // Paid
      expect(o.amount + o.fee).to.equal(amount);
    });

    it("calculates 0.5% fee correctly", async () => {
      const amount = ethers.parseUnits("1000", 6);
      await mintAndApprove(buyer, amount);
      const id = orderId("fee-check");

      await escrow
        .connect(buyer)
        .deposit(id, await usdt.getAddress(), amount, seller.address);

      const o = await escrow.getOrder(id);
      const expectedFee = (amount * FEE_BPS) / 10000n;
      expect(o.fee).to.equal(expectedFee);
      expect(o.amount).to.equal(amount - expectedFee);
    });
  });

  describe("depositNative", () => {
    it("creates order with native token marker (address(0))", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("native-1");

      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      const o = await escrow.getOrder(id);
      expect(o.buyer).to.equal(buyer.address);
      expect(o.token).to.equal(ethers.ZeroAddress);
      expect(o.status).to.equal(1n);
      expect(o.amount + o.fee).to.equal(value);
    });
  });

  describe("releasePayment", () => {
    it("transfers amount to seller, fee to vault, status=Completed", async () => {
      const amount = ethers.parseUnits("100", 6);
      await mintAndApprove(buyer, amount);
      const id = orderId("release-1");
      await escrow
        .connect(buyer)
        .deposit(id, await usdt.getAddress(), amount, seller.address);

      const o = await escrow.getOrder(id);
      const sellerBefore = await usdt.balanceOf(seller.address);
      const vaultBefore = await usdt.balanceOf(feeVault.address);

      await expect(escrow.connect(operator).releasePayment(id))
        .to.emit(escrow, "OrderCompleted")
        .withArgs(id);

      expect(await usdt.balanceOf(seller.address)).to.equal(
        sellerBefore + o.amount
      );
      expect(await usdt.balanceOf(feeVault.address)).to.equal(
        vaultBefore + o.fee
      );

      const updated = await escrow.getOrder(id);
      expect(updated.status).to.equal(2n); // Completed
    });
  });

  describe("buyerConfirmDelivery", () => {
    it("releases funds and emits DeliveryConfirmed(onTime=true) within 24h", async () => {
      const amount = ethers.parseUnits("50", 6);
      await mintAndApprove(buyer, amount);
      const id = orderId("confirm-1");
      await escrow
        .connect(buyer)
        .deposit(id, await usdt.getAddress(), amount, seller.address);

      await expect(escrow.connect(buyer).buyerConfirmDelivery(id))
        .to.emit(escrow, "DeliveryConfirmed")
        .withArgs(id, buyer.address, seller.address, true);

      expect((await escrow.getOrder(id)).status).to.equal(2n);
    });

    it("emits onTime=false after 24h", async () => {
      const amount = ethers.parseUnits("50", 6);
      await mintAndApprove(buyer, amount);
      const id = orderId("confirm-late");
      await escrow
        .connect(buyer)
        .deposit(id, await usdt.getAddress(), amount, seller.address);

      // Advance 25 hours
      await time.increase(25 * 60 * 60);

      await expect(escrow.connect(buyer).buyerConfirmDelivery(id))
        .to.emit(escrow, "DeliveryConfirmed")
        .withArgs(id, buyer.address, seller.address, false);
    });
  });

  describe("refund", () => {
    it("refunds full amount+fee to buyer", async () => {
      const value = ethers.parseEther("2");
      const id = orderId("refund-native");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      const buyerBefore = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(operator).refund(id);

      const buyerAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerAfter - buyerBefore).to.equal(value);
      expect((await escrow.getOrder(id)).status).to.equal(3n); // Refunded
    });
  });

  describe("refundExpired", () => {
    it("anyone can call after expiresAt", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("expire-1");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await time.increase(Number(ORDER_TIMEOUT) + 1);

      await expect(escrow.connect(stranger).refundExpired(id))
        .to.emit(escrow, "OrderExpired")
        .withArgs(id);

      expect((await escrow.getOrder(id)).status).to.equal(5n); // Expired
    });
  });

  describe("raiseDispute", () => {
    it("buyer can dispute, status flips to Disputed", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("dispute-1");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await escrow.connect(buyer).raiseDispute(id);
      expect((await escrow.getOrder(id)).status).to.equal(4n); // Disputed
    });

    it("seller can dispute", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("dispute-seller");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await escrow.connect(seller).raiseDispute(id);
      expect((await escrow.getOrder(id)).status).to.equal(4n);
    });
  });

  describe("depositBatch (ERC20)", () => {
    it("creates multiple orders in one tx", async () => {
      const amounts = [
        ethers.parseUnits("100", 6),
        ethers.parseUnits("200", 6),
      ];
      const total = amounts[0] + amounts[1];
      await mintAndApprove(buyer, total);

      const ids = [orderId("batch-1"), orderId("batch-2")];
      const sellers = [seller.address, seller.address];

      await escrow
        .connect(buyer)
        .depositBatch(ids, await usdt.getAddress(), amounts, sellers);

      for (const id of ids) {
        const o = await escrow.getOrder(id);
        expect(o.buyer).to.equal(buyer.address);
        expect(o.status).to.equal(1n);
      }
    });
  });

  describe("depositNativeBatch", () => {
    it("creates multiple native orders", async () => {
      const amounts = [ethers.parseEther("1"), ethers.parseEther("2")];
      const total = amounts[0] + amounts[1];
      const ids = [orderId("nb-1"), orderId("nb-2")];
      const sellers = [seller.address, seller.address];

      await escrow
        .connect(buyer)
        .depositNativeBatch(ids, sellers, amounts, { value: total });

      for (const id of ids) {
        expect((await escrow.getOrder(id)).status).to.equal(1n);
      }
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * EDGE CASES
   * ═══════════════════════════════════════════════════════════════════════ */

  describe("Edge cases", () => {
    it("rejects duplicate orderId", async () => {
      const amount = ethers.parseUnits("10", 6);
      await mintAndApprove(buyer, amount * 2n);
      const id = orderId("dup");
      await escrow
        .connect(buyer)
        .deposit(id, await usdt.getAddress(), amount, seller.address);

      await expect(
        escrow
          .connect(buyer)
          .deposit(id, await usdt.getAddress(), amount, seller.address)
      ).to.be.revertedWith("Order exists");
    });

    it("rejects release when status != Paid", async () => {
      const id = orderId("not-paid");
      const value = ethers.parseEther("1");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });
      await escrow.connect(operator).releasePayment(id);

      await expect(
        escrow.connect(operator).releasePayment(id)
      ).to.be.revertedWith("Invalid status");
    });

    it("rejects release after expiresAt", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("expired-release");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await time.increase(Number(ORDER_TIMEOUT) + 1);

      await expect(
        escrow.connect(operator).releasePayment(id)
      ).to.be.revertedWith("Order expired");
    });

    it("refund only works for Paid or Disputed", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("refund-completed");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });
      await escrow.connect(operator).releasePayment(id);

      await expect(
        escrow.connect(operator).refund(id)
      ).to.be.revertedWith("Invalid status");
    });

    it("refund works on Disputed orders", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("refund-disputed");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });
      await escrow.connect(buyer).raiseDispute(id);

      await escrow.connect(operator).refund(id);
      expect((await escrow.getOrder(id)).status).to.equal(3n);
    });

    it("refundExpired reverts before expiresAt", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("too-early");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await expect(
        escrow.connect(stranger).refundExpired(id)
      ).to.be.revertedWith("Not expired yet");
    });

    it("stranger cannot dispute", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("stranger-dispute");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await expect(
        escrow.connect(stranger).raiseDispute(id)
      ).to.be.revertedWith("Not authorized");
    });

    it("depositBatch reverts on length mismatch", async () => {
      const amounts = [ethers.parseUnits("10", 6)];
      await mintAndApprove(buyer, amounts[0]);

      await expect(
        escrow.connect(buyer).depositBatch(
          [orderId("a"), orderId("b")],
          await usdt.getAddress(),
          amounts, // length 1 vs 2
          [seller.address, seller.address]
        )
      ).to.be.revertedWith("Length mismatch");
    });

    it("depositNativeBatch reverts on incorrect msg.value", async () => {
      const amounts = [ethers.parseEther("1"), ethers.parseEther("2")];
      const ids = [orderId("nbv-1"), orderId("nbv-2")];
      const sellers = [seller.address, seller.address];

      await expect(
        escrow.connect(buyer).depositNativeBatch(ids, sellers, amounts, {
          value: ethers.parseEther("1"), // should be 3
        })
      ).to.be.revertedWith("Incorrect ETH value sent");
    });

    it("rejects zero-address seller", async () => {
      const value = ethers.parseEther("1");
      await expect(
        escrow
          .connect(buyer)
          .depositNative(orderId("zero-seller"), ethers.ZeroAddress, { value })
      ).to.be.revertedWith("Invalid seller");
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * ACCESS CONTROL
   * ═══════════════════════════════════════════════════════════════════════ */

  describe("Access control", () => {
    it("only OPERATOR_ROLE can releasePayment", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("acl-release");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await expect(
        escrow.connect(stranger).releasePayment(id)
      ).to.be.reverted;
    });

    it("only OPERATOR_ROLE can refund", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("acl-refund");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await expect(escrow.connect(stranger).refund(id)).to.be.reverted;
    });

    it("only buyer can call buyerConfirmDelivery", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("acl-confirm");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });

      await expect(
        escrow.connect(seller).buyerConfirmDelivery(id)
      ).to.be.revertedWith("Not the buyer");
    });

    it("only ADMIN_ROLE can updatePlatformFee", async () => {
      await expect(
        escrow.connect(stranger).updatePlatformFee(100)
      ).to.be.reverted;
    });

    it("fee cannot exceed MAX_FEE_PERCENT", async () => {
      await expect(
        escrow.connect(admin).updatePlatformFee(1001)
      ).to.be.revertedWith("Fee too high");
    });

    it("only ADMIN_ROLE can pause/unpause", async () => {
      await expect(escrow.connect(stranger).pause()).to.be.reverted;
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * PAUSE
   * ═══════════════════════════════════════════════════════════════════════ */

  describe("Pause", () => {
    it("deposits revert when paused", async () => {
      await escrow.connect(admin).pause();

      await expect(
        escrow
          .connect(buyer)
          .depositNative(orderId("paused"), seller.address, {
            value: ethers.parseEther("1"),
          })
      ).to.be.reverted;
    });

    it("release still works when paused (admin function)", async () => {
      const value = ethers.parseEther("1");
      const id = orderId("pause-release");
      await escrow
        .connect(buyer)
        .depositNative(id, seller.address, { value });
      await escrow.connect(admin).pause();

      // releasePayment is not gated by whenNotPaused
      await escrow.connect(operator).releasePayment(id);
      expect((await escrow.getOrder(id)).status).to.equal(2n);
    });

    it("can unpause and resume deposits", async () => {
      await escrow.connect(admin).pause();
      await escrow.connect(admin).unpause();

      await escrow
        .connect(buyer)
        .depositNative(orderId("unpaused"), seller.address, {
          value: ethers.parseEther("1"),
        });
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * ADMIN FUNCTIONS
   * ═══════════════════════════════════════════════════════════════════════ */

  describe("Admin", () => {
    it("updatePlatformFee changes the default fee", async () => {
      await escrow.connect(admin).updatePlatformFee(100); // 1%
      expect(await escrow.platformFeePercent()).to.equal(100n);
    });

    it("updateFeeVault rejects zero address", async () => {
      await expect(
        escrow.connect(admin).updateFeeVault(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid vault");
    });

    it("updateFeeVault changes vault", async () => {
      await escrow.connect(admin).updateFeeVault(stranger.address);
      expect(await escrow.feeVault()).to.equal(stranger.address);
    });
  });
});
