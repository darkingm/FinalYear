import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";
import { HDNodeWallet } from "ethers";

dotenv.config({ path: ".env.local", override: true });
dotenv.config();

const HARDHAT_DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";
const HARDHAT_DEFAULT_BALANCE = "10000000000000000000000"; // 10,000 ETH

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function buildHardhatAccounts() {
  const accounts = Array.from({ length: 20 }, (_, index) => {
    const wallet = HDNodeWallet.fromPhrase(
      HARDHAT_DEFAULT_MNEMONIC,
      undefined,
      `m/44'/60'/0'/0/${index}`
    );

    return {
      privateKey: wallet.privateKey,
      balance: HARDHAT_DEFAULT_BALANCE,
    };
  });

  const localMetamaskKey = normalizePrivateKey(process.env.LOCAL_METAMASK_PRIVATE_KEY);
  if (
    localMetamaskKey &&
    !accounts.some((account) => account.privateKey.toLowerCase() === localMetamaskKey.toLowerCase())
  ) {
    accounts.push({
      privateKey: localMetamaskKey,
      balance: HARDHAT_DEFAULT_BALANCE,
    });
  }

  return accounts;
}

function resolveLocalSignerAccounts() {
  const primaryKey = normalizePrivateKey(
    process.env.LOCAL_METAMASK_PRIVATE_KEY || process.env.PRIVATE_KEY
  );

  return primaryKey ? [primaryKey] : [];
}

function resolvePublicSignerAccounts() {
  const primaryKey = normalizePrivateKey(
    process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY
  );

  return primaryKey ? [primaryKey] : [];
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Needed for RWAFactory — avoids "stack too deep" with many params
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: buildHardhatAccounts(),
    },
    localhost: {
      url: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
      accounts: resolveLocalSignerAccounts(),
      chainId: 31337,
    },
    // Correct network name for Amoy testnet (80002)
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: resolvePublicSignerAccounts(),
      chainId: 80002,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon.drpc.org",
      accounts: resolvePublicSignerAccounts(),
      chainId: 137,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: resolvePublicSignerAccounts(),
      chainId: 42161,
    },

    // 🔥 NEW TESTNET CONFIGURATIONS 🔥
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: resolvePublicSignerAccounts(),
      chainId: 84532,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: resolvePublicSignerAccounts(),
      chainId: 97,
    },
    optimismSepolia: {
      url: process.env.OP_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
      accounts: resolvePublicSignerAccounts(),
      chainId: 11155420,
    },
    arbitrumSepolia: {
      url: process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: resolvePublicSignerAccounts(),
      chainId: 421614,
    },

    // ── VPS Hardhat node (chain ảo chạy trên VPS 103.20.96.79) ──
    // Dùng để deploy lại EscrowCore lên VPS khi cần:
    //   npx hardhat run scripts/bootstrap-local.ts --network vps
    vps: {
      url: process.env.VPS_RPC_URL || "http://103.20.96.79:8545",
      accounts: resolveLocalSignerAccounts().length > 0 ? resolveLocalSignerAccounts() : [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" // Hardhat #0
      ],
      chainId: 31337,
      timeout: 120000,
    },
  },
  etherscan: {
    apiKey: {
      amoy: process.env.POLYGONSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      optimisticSepolia: process.env.OPSCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  },
  sourcify: {
    enabled: false // Disabled to hide sourcify missing logs
  }
};

export default config;
