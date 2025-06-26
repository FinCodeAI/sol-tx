import express from 'express';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

config(); // Load .env

// 1. Setup Express server
const app = express();
app.use(bodyParser.json());

// 2. Connect to Helius RPC
const connection = new Connection(
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  'confirmed'
);

// 3. Load and decode the wallet from .env
const secretKey = Uint8Array.from(
  JSON.parse(Buffer.from(process.env.SOL_PRIVATE_KEY, 'base64').toString())
);
const fromKeypair = Keypair.fromSecretKey(secretKey);

// 4. Transaction endpoint
app.post('/send', async (req, res) => {
  try {
    const { to, amount } = req.body;

    if (!to || !amount) {
      return res.status(400).json({ error: 'Missing "to" or "amount"' });
    }

    const toPubkey = new PublicKey(to);
    const lamports = amount * LAMPORTS_PER_SOL;

    // Build the instruction
    const instruction = SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports,
    });

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // Compile message
    const message = new TransactionMessage({
      payerKey: fromKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    // Sign and send
    const tx = new VersionedTransaction(message);
    tx.sign([fromKeypair]);

    const signature = await connection.sendTransaction(tx);
    return res.json({ signature });

  } catch (err) {
    console.error('❌ Transaction failed:', err);
    res.status(500).json({ error: 'Transaction failed', detail: err.message });
  }
});

// 5. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
