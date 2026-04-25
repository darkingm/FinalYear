import { ethers } from 'ethers';

export type BuyoutHolder = {
    holder_address: string;
    token_balance: string | number | bigint;
};

export type BuyoutProof = {
    holder_address: string;
    token_balance: string;
    token_balance_wei: string;
    amount_wei: string;
    leaf_hash: string;
    proof: string[];
};

const TOKEN_DECIMALS = 10n ** 18n;
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

function normalizeWholeTokens(value: string | number | bigint): bigint {
    const tokens = BigInt(value);
    if (tokens <= 0n) throw new Error('token balance must be greater than 0');
    return tokens;
}

function hashPair(a: string, b: string): string {
    const left = BigInt(a) <= BigInt(b) ? a : b;
    const right = left === a ? b : a;
    return ethers.keccak256(ethers.concat([left, right]));
}

export function buyoutLeafHash(holderAddress: string, tokenBalanceWei: bigint): string {
    return ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [ethers.getAddress(holderAddress), tokenBalanceWei],
    );
}

export function buildBuyoutMerkleSnapshot(
    holders: BuyoutHolder[],
    pricePerTokenWei: string | bigint,
): { merkle_root: string; claims: BuyoutProof[] } {
    const priceWei = BigInt(pricePerTokenWei);
    if (priceWei <= 0n) throw new Error('pricePerTokenWei must be greater than 0');

    const claims = holders
        .map((holder) => {
            const wholeTokens = normalizeWholeTokens(holder.token_balance);
            const tokenBalanceWei = wholeTokens * TOKEN_DECIMALS;
            const normalizedAddress = ethers.getAddress(holder.holder_address);
            const leaf = buyoutLeafHash(normalizedAddress, tokenBalanceWei);
            const amountWei = (tokenBalanceWei * priceWei) / TOKEN_DECIMALS;

            return {
                holder_address: normalizedAddress.toLowerCase(),
                token_balance: wholeTokens.toString(),
                token_balance_wei: tokenBalanceWei.toString(),
                amount_wei: amountWei.toString(),
                leaf_hash: leaf,
                proof: [] as string[],
            };
        })
        .sort((a, b) => a.leaf_hash.localeCompare(b.leaf_hash));

    if (claims.length === 0) {
        throw new Error('Cannot build buyout snapshot without token holders');
    }

    let level = claims.map((claim, index) => ({ hash: claim.leaf_hash, claimIndexes: [index] }));

    while (level.length > 1) {
        const nextLevel: typeof level = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1];

            if (!right) {
                nextLevel.push(left);
                continue;
            }

            for (const claimIndex of left.claimIndexes) {
                claims[claimIndex].proof.push(right.hash);
            }
            for (const claimIndex of right.claimIndexes) {
                claims[claimIndex].proof.push(left.hash);
            }
            nextLevel.push({
                hash: hashPair(left.hash, right.hash),
                claimIndexes: [...left.claimIndexes, ...right.claimIndexes],
            });
        }
        level = nextLevel;
    }

    return {
        merkle_root: level[0]?.hash || ZERO_HASH,
        claims,
    };
}
