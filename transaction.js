// transaction.js update
import 'dotenv/config';
import fetch from 'node-fetch';
import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

export async function transactionHandler({ action, token, amount, slippage = 10 }) {
  const payer = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY));
  const wallet = payer.publicKey.toBase58();
  const connection = new Connection(process.env.SOLANA_RPC);

  if (!action || !token) throw new Error('Missing action or token');

  if (action === 'HOLD') {
    return { status: 'HOLD', message: 'No transaction performed' };
  }

  if (action === 'DCA') {
    amount = amount; // Example: halve the amount
  }

  const lamports = Math.floor(amount * LAMPORTS_PER_SOL).toString();
  const isSell = action === 'SELL';

  const tokenIn = isSell ? token : 'So11111111111111111111111111111111111111112';
  const tokenOut = isSell ? 'So11111111111111111111111111111111111111112' : token;

  // Step 1: Get route from GMGN
  const routeRes = await fetch(`https://gmgn.ai/defi/router/v1/sol/tx/get_swap_route?` +
    `token_in_address=${tokenIn}&` +
    `token_out_address=${tokenOut}&` +
    `in_amount=${lamports}&` +
    `from_address=${wallet}&` +
    `slippage=${slippage}&` +
    `fee=0.002&` +
    `is_anti_mev=true`
  );
  const route = await routeRes.json();
  if (route.code !== 0 || !route.data?.raw_tx?.swapTransaction) {
    throw new Error(route.msg || 'Failed to get swap route');
  }

  // Step 2: Deserialize and sign transaction
  const txBuf = Buffer.from(route.data.raw_tx.swapTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([payer]);

  // Step 3: Send to GMGN proxy
  const sendRes = await fetch('https://gmgn.ai/txproxy/v1/send_transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chain: 'sol',
      signedTx: Buffer.from(tx.serialize()).toString('base64'),
      isAntiMev: true
    })
  });

  const sendResult = await sendRes.json();
  if (!sendResult.data?.hash) throw new Error('Transaction failed to broadcast');

  return {
    status: action,
    txHash: sendResult.data.hash,
    token,
    amount,
    slippage
  };
}
