// transaction.js
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

  // Handle HOLD
  if (action === 'HOLD') {
    return { status: 'HOLD', message: 'No transaction performed' };
  }

  // Handle SELL percentage (e.g., "SELL_10", "SELL_25", etc.)
  let isSell = false;
  if (action.startsWith('SELL')) {
    isSell = true;
    const pct = parseInt(action.split('_')[1] || '100', 10);
    if (![10, 25, 50, 75, 100].includes(pct)) {
      throw new Error('Invalid SELL percentage');
    }

    // Get wallet balance for the token
    const balanceRes = await fetch(`https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=${process.env.HELIUS_API_KEY}`);
    const balances = await balanceRes.json();
    const tokenInfo = balances.tokens.find(t => t.mint === token);
    if (!tokenInfo || !tokenInfo.amount) throw new Error('Token balance not found');
    amount = (parseFloat(tokenInfo.amount) * (pct / 100)).toFixed(6);
  }

  // Handle DCA (e.g., buy with 50% of given amount)
  if (action === 'DCA') {
    amount = amount / 2;
  }

  const lamports = Math.floor(amount * LAMPORTS_PER_SOL).toString();
  const tokenIn = isSell ? token : 'So11111111111111111111111111111111111111112';
  const tokenOut = isSell ? 'So11111111111111111111111111111111111111112' : token;

  // Step 1: Get route
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

  // Step 2: Sign transaction
  const txBuf = Buffer.from(route.data.raw_tx.swapTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([payer]);

  // Step 3: Send transaction
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
