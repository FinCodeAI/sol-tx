import 'dotenv/config';
import { Helius } from 'helius-sdk';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';

export async function transactionHandler(body) {
  const {
    action = 'HOLD',
    amount = 0.01,
    target = process.env.RECIPIENT_WALLET,
  } = body;

  const helius = new Helius(process.env.HELIUS_API_KEY);
  const secretKeyBase58 = process.env.SOL_PRIVATE_KEY;
  const payer = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));

  console.log(`🚀 Action: ${action} | Amount: ${amount} SOL`);

  if (action === 'HOLD') {
    return { status: 'HOLD', message: 'No transaction sent.' };
  }

  const instructions = [];

  if (['BUY', 'DCA', 'SELL'].includes(action)) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(target),
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      })
    );
  } else {
    throw new Error('Invalid action: ' + action);
  }

  try {
    const sig = await helius.rpc.sendSmartTransaction(instructions, [payer]);
    return { status: 'sent', signature: sig };
  } catch (err) {
    console.error('❌ TX Error:', err.message);
    throw new Error('Transaction failed: ' + err.message);
  }
}
