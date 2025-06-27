import dotenv from 'dotenv';
dotenv.config();

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

import bs58 from 'bs58';
import fetch from 'node-fetch';

async function fetchTokenBalance(tokenAddress, walletAddress) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${process.env.Sparrowfast}`;
  const body = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getTokenAccountsByOwner',
    params: [
      walletAddress,
      { mint: tokenAddress },
      { encoding: 'jsonParsed' }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const json = await res.json();
  const accounts = json.result?.value;

  if (!accounts || accounts.length === 0) return 0;

  return parseFloat(accounts[0].account.data.parsed.info.tokenAmount.uiAmount) || 0;
}

export async function transactionHandler({ action, token, amount, percentage = null, slippage = 10 }) {
  const payer = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY));
  const wallet = payer.publicKey.toBase58();
  const connection = new Connection(process.env.SOLANA_RPC);

  try {
    if (!token || !action) throw new Error('Missing parameters');

    const tokenIn = (action === 'BUY' || action === 'DCA') ? 'So11111111111111111111111111111111111111112' : token;
    const tokenOut = (action === 'BUY' || action === 'DCA') ? token : 'So11111111111111111111111111111111111111112';

    if (action === 'HOLD') {
      return { status: 'HOLD', reason: 'No transaction needed' };
    }

    let inAmount = amount;

    if (action === 'DCA' || action === 'SELL') {
      const balance = await fetchTokenBalance(token, wallet);
      if (!balance || balance <= 0) throw new Error('Insufficient token balance');

      const pct = percentage || amount;
      if (!pct || pct <= 0 || pct > 1) throw new Error('Invalid percentage for sell/DCA');

      inAmount = balance * pct;
    }
    console.log("Token balance:", balance);
    console.log("Sell percentage:", percentage);
    console.log("Calculated amount to sell:", sellAmount);

    const lamports = Math.round(inAmount * LAMPORTS_PER_SOL);

    // Step 1: Get swap route from GMGN
    const routeUrl = `https://gmgn.ai/defi/router/v1/sol/tx/get_swap_route?` +
      `token_in_address=${tokenIn}&` +
      `token_out_address=${tokenOut}&` +
      `in_amount=${lamports}&` +
      `from_address=${wallet}&` +
      `slippage=${slippage}&fee=0.002&is_anti_mev=true`;

    const routeRes = await fetch(routeUrl);
    const route = await routeRes.json();

    const txBase64 = route.data?.transaction || route.data?.raw_tx?.swapTransaction;
    if (route.code !== 0 || !txBase64) {
      throw new Error(route.msg || 'Failed to get swap transaction');
    }

    const txBuf = Buffer.from(txBase64, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([payer]);

    const signature = await connection.sendTransaction(tx);
    return {
      status: action,
      txHash: signature,
      token,
      amount: inAmount,
      slippage
    };
  } catch (error) {
    console.error('[TX ERROR]', error);
    return {
      error: 'Transaction failed',
      details: error.message
    };
  }
}
