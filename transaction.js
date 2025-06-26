import 'dotenv/config';
import { Helius } from 'helius-sdk';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';

// === CONFIG ===
const helius = new Helius(process.env.HELIUS_API_KEY);
const token = process.env.TOKEN_ADDRESS;
const recipient = process.env.RECIPIENT_WALLET;

// === Load Phantom-style base58 key ===
const secretKeyBase58 = process.env.SOL_PRIVATE_KEY;
const payer = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));

// === Sample TX Logic (Replace with dynamic input from n8n) ===
const action = process.env.ACTION || 'HOLD'; // BUY, SELL, DCA, HOLD
const amount = parseFloat(process.env.AMOUNT) || 0.01;
const entryPrice = parseFloat(process.env.ENTRY_PRICE) || 0;
const target = process.env.TARGET_WALLET || recipient;

console.log(`🚀 Action: ${action} | Amount: ${amount} SOL`);

if (action === 'HOLD') {
  console.log('⏸️ HOLD — No transaction will be made.');
  process.exit(0);
}

// === Build Instructions ===
const instructions = [];

if (['BUY', 'DCA'].includes(action)) {
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: new PublicKey(target),
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    })
  );
} else if (action === 'SELL') {
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: new PublicKey(target),
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    })
  );
} else {
  console.error('❌ Invalid action:', action);
  process.exit(1);
}

// === Send Transaction ===
(async () => {
  try {
    const sig = await helius.rpc.sendSmartTransaction(instructions, [payer]);
    console.log('✅ Sent with signature:', sig);
  } catch (err) {
    console.error('❌ TX Error:', err.message);
    process.exit(1);
  }
})();
