import {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

// Load wallet
const secretKey = Uint8Array.from(
  JSON.parse(Buffer.from(process.env.SOL_PRIVATE_KEY, "base64").toString())
);
const wallet = Keypair.fromSecretKey(secretKey);
const connection = new Connection(process.env.HELIUS_RPC);

// Main function
export async function handleTransaction(input) {
  const { action, params } = input;
  const { token, wallet: toWallet, amount, entry_price, symbol } = params;

  console.log(`[${symbol}] Action: ${action}, Amount: ${amount}`);

  if (action === "HOLD") {
    console.log("Action is HOLD — no transaction sent.");
    return { success: true, message: "Held. No action taken." };
  }

  if (!["BUY", "SELL", "DCA"].includes(action)) {
    throw new Error("Invalid action type.");
  }

  // Example transfer logic (replace with SPL/Jupiter swap if needed)
  const toPubkey = new PublicKey(toWallet);
  const lamports = amount * LAMPORTS_PER_SOL;

  const ix = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey,
    lamports,
  });

  const { blockhash } = await connection.getLatestBlockhash();

  const msg = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([wallet]);

  const signature = await connection.sendTransaction(tx);
  console.log(`${action} transaction sent: ${signature}`);

  return { success: true, tx: signature };
}
