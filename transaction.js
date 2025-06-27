// transaction.js
import fetch from 'node-fetch';
import bs58 from 'bs58';
import {
  VersionedTransaction,
} from '@solana/web3.js';

const RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_KEY;
const GMGN_BASE_URL = 'https://gmgn.ai/defi';

export async function transactionHandler(input) {
  const { token, amount, action } = input;
  const fromAddress = process.env.SOL_PUBLIC_KEY;
  const privateKey = Uint8Array.from(JSON.parse(Buffer.from(process.env.SOL_PRIVATE_KEY, 'base64').toString()));
  const slippage = 10;
  const fee = 0.002;

  let tokenIn, tokenOut;

  if (action === 'BUY') {
    tokenIn = 'So11111111111111111111111111111111111111112'; // SOL
    tokenOut = token;
  } else if (action === 'SELL' || action === 'DCA') {
    tokenIn = token;
    tokenOut = 'So11111111111111111111111111111111111111112';
  } else if (action === 'HOLD') {
    return { status: 'HOLD', reason: 'No transaction needed' };
  } else {
    throw new Error('Unsupported action');
  }

  // DCA logic: reduce amount to 10%
  let finalAmount = amount;
  if (action === 'DCA') {
    finalAmount = amount * 0.1;
  }

  const routeUrl = `${GMGN_BASE_URL}/router/v1/sol/tx/get_swap_route` +
    `?token_in_address=${tokenIn}` +
    `&token_out_address=${tokenOut}` +
    `&in_amount=${finalAmount}` +
    `&from_address=${fromAddress}` +
    `&slippage=${slippage}` +
    `&fee=${fee}` +
    `&is_anti_mev=true`;

  const routeRes = await fetch(routeUrl);
  const route = await routeRes.json();

  if (!route?.data?.raw_tx?.swapTransaction) {
    throw new Error('Invalid route response from GMGN');
  }

  const rawTx = route.data.raw_tx.swapTransaction;
  const messageBuffer = Buffer.from(rawTx, 'base64');
  const transaction = VersionedTransaction.deserialize(messageBuffer);
  transaction.sign([{
    publicKey: transaction.message.staticAccountKeys[0],
    secretKey: privateKey,
  }]);

  const txProxyUrl = `${GMGN_BASE_URL}/txproxy/v1/send_transaction`;
  const txRes = await fetch(txProxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: bs58.encode(transaction.serialize()) })
  });

  const txResult = await txRes.json();

  if (!txResult?.data?.txHash) {
    throw new Error('Transaction submission failed');
  }

  return {
    status: action,
    txHash: txResult.data.txHash,
    token,
    amount: finalAmount,
    slippage,
  };
}
