import 'dotenv/config';
import { Helius } from 'helius-sdk';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Main transaction logic
 * @param {Object} body - incoming JSON payload
 * @returns {Object} result with status or transaction signature
 */
export async function transactionHandler(body) {
  const {
    action = 'HOLD',
    amount = 0.01,
    target = process.env.RECIPIENT_WALLET,
  } = body;

  const helius = new Helius(process.env.HELIUS_API_KEY);
  const secretKeyBase58 = process.env.SOL_PRIVATE_KEY;

  if (!secretKeyBase58) throw new Error("Missing SOL_PRIVATE_KEY in env");

  const payer = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));

  console.log(`🚀 Action: ${action} | Amount: ${amount} SOL`);

  // Return early for HOLD
  if (action === 'HOLD') {
    return { status: 'HOLD', message: 'No transaction sent.' };
  }

  // Only accept known action types
  if (!['BUY', 'DCA', 'SELL'].includes(action)) {
    throw new Error('Invalid action: ' + action);
  }

  // Prepare transfer instruction
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: new PublicKey(target),
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    }),
  ];

  // Send via Helius smart transaction
  try {
    const sig = await helius.rpc.sendSmartTransaction(instructions, [payer]);
    return { status: 'sent', signature: sig };
  } catch (err) {
    console.error('❌ TX Error:', err.message);
    throw new Error('Transaction failed: ' + err.message);
  }
}
