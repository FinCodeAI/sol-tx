import dotenv from 'dotenv';
dotenv.config();

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';

import bs58 from 'bs58';
import fetch from 'node-fetch';

const connection = new Connection(process.env.SOLANA_RPC, 'confirmed');
const payer = Keypair.fromSecretKey(bs58.decode(process.env.SOL_PRIVATE_KEY));
const walletAddress = payer.publicKey.toBase58();

async function fetchTokenBalance(tokenAddress) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
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

  const amount = parseFloat(accounts[0].account.data.parsed.info.tokenAmount.uiAmount);
  return amount || 0;
}

export async function transactionHandler({ token, amount, action }) {
  try {
    if (!token || !action) throw new Error('Missing parameters');

    const tokenIn = (action === 'BUY' || action === 'DCA') ? 'So11111111111111111111111111111111111111112' : token;
    const tokenOut = (action === 'BUY' || action === 'DCA') ? token : 'So11111111111111111111111111111111111111112';

    if (action === 'HOLD') {
      return { status: 'HOLD', reason: 'No transaction needed' };
    }

    let sellAmount = amount;

    // Handle DCA and SELL percentage logic
    if (action === 'DCA' || action === 'SELL') {
      const currentBalance = await fetchTokenBalance(token);
      if (!currentBalance || currentBalance <= 0) throw new Error('Insufficient token balance');

      sellAmount = currentBalance * amount; // `amount` is treated as % (e.g. 0.1 for 10%)
    }

    const routeUrl = `https://gmgn.ai/defi/router/v1/sol/tx/get_swap_route?` +
      `token_in_address=${tokenIn}&` +
      `token_out_address=${tokenOut}&` +
      `in_amount=${sellAmount}&` +
      `from_address=${walletAddress}&` +
      `slippage=10&` +
      `fee=0.002&` +
      `is_anti_mev=true`;

    const routeRes = await fetch(routeUrl);
    const route = await routeRes.json();

    if (!route?.data?.transaction) {
      throw new Error('No transaction found in route response');
    }

    const txBuf = Buffer.from(route.data.transaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([payer]);

    const sig = await connection.sendTransaction(tx);
    return {
      status: action,
      txHash: sig,
      token,
      amount: action === 'SELL' || action === 'DCA' ? sellAmount : amount,
      slippage: 10
    };
  } catch (error) {
    console.error('[TX ERROR]', error);
    return {
      error: 'Transaction failed',
      details: error.message
    };
  }
}
