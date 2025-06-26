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

const secretKey = Uint8Array.from(
  JSON.parse(Buffer.from(process.env.SOL_PRIVATE_KEY, "base64").toString())
);
const wallet = Keypair.fromSecretKey(secretKey);
const connection = new Connection(process.env.HELIUS_RPC);

export async function handleTransaction(input) {
  const { action, allocated, token_address } = input;

  if (action === "HOLD") {
    console.log("No action taken (HOLD).");
    return;
  }

  if (!["BUY", "SELL", "DCA"].includes(action)) {
    console.log(`Unknown action: ${action}`);
    return;
  }

  // For now we use a dummy transfer to represent the action
  const toPubkey = new PublicKey(token_address);
  const lamports = allocated * LAMPORTS_PER_SOL;

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

  const txid = await connection.sendTransaction(tx);
  console.log(`${action} transaction sent:`, txid);
}
