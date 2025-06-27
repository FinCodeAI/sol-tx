import {
  Connection,
  Keypair,
  sendAndConfirmRawTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const PRIVATE_KEY = process.env.SOL_PRIVATE_KEY; // base58-encoded
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Decode base58 private key
const secretKey = bs58.decode(PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(secretKey);

export async function transactionHandler(data) {
  const { token, amount, action } = data;
  if (!token || !amount || !action) {
    throw new Error('Missing token, amount, or action');
  }

  // HOLD = No action
  if (action === 'HOLD') {
    return { status: 'HOLD', reason: 'No transaction needed' };
  }

  // Determine tokenIn / tokenOut
  let tokenIn, tokenOut;
  if (action === 'BUY' || action === 'DCA') {
    tokenIn = 'So11111111111111111111111111111111111111112'; // SOL
    tokenOut = token;
  } else if (action === 'SELL') {
    tokenIn = token;
    tokenOut = 'So11111111111111111111111111111111111111112';
  } else {
    throw new Error('Unsupported action');
  }

  const amountInLamports = Math.floor(amount * 1e9); // Convert SOL to lamports

  const slippage = 10; // in %
  const routeUrl = `https://gmgn.ai/defi/router/v1/sol/tx/get_swap_route` +
    `?token_in_address=${tokenIn}` +
    `&token_out_address=${tokenOut}` +
    `&in_amount=${amountInLamports}` +
    `&from_address=${wallet.publicKey.toBase58()}` +
    `&slippage=${slippage}` +
    `&fee=0.002&is_anti_mev=true`;

  const routeRes = await fetch(routeUrl);
  const routeData = await routeRes.json();

  if (!routeData.tx || !routeData.tx.data) {
    throw new Error('Invalid transaction data from GMGN');
  }

  const txBuffer = Buffer.from(routeData.tx.data, 'base64');

  const txid = await connection.sendRawTransaction(txBuffer, {
    skipPreflight: true,
  });

  return {
    status: action,
    txHash: txid,
    token,
    amount,
    slippage,
  };
}
