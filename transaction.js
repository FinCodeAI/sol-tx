import dotenv from 'dotenv';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';

dotenv.config();

const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
const secretKey = bs58.decode(process.env.SOL_PRIVATE_KEY);
const user = Keypair.fromSecretKey(secretKey);
const gmgnApiBase = 'https://gmgn.ai/defi/router/v1/sol/tx';

export async function transactionHandler({ token, amount, action }) {
  try {
    const baseToken = 'So11111111111111111111111111111111111111112'; // wSOL
    const inputToken = action === 'SELL' ? token : baseToken;
    const outputToken = action === 'SELL' ? baseToken : token;

    let amountInLamports;

    if (action === 'DCA') {
      // Fetch holding balance
      const holding = await connection.getTokenAccountsByOwner(user.publicKey, {
        mint: token,
      });
      if (!holding.value.length) throw new Error('No tokens found in wallet.');
      
      const parsed = await connection.getParsedAccountInfo(holding.value[0].pubkey);
      const tokenAmount = parsed.value.data.parsed.info.tokenAmount.uiAmount;

      // Get token price from route
      const priceRes = await fetch(
        `${gmgnApiBase}/get_swap_route?token_in_address=${token}&token_out_address=${baseToken}&in_amount=1&from_address=${user.publicKey}&slippage=10`
      );
      const priceData = await priceRes.json();
      const tokenPrice = priceData?.routes?.[0]?.outAmount || 0;

      const dcaTokens = tokenAmount * 0.1;
      amountInLamports = Math.floor(dcaTokens * tokenPrice);
    } else if (action === 'HOLD') {
      return { status: 'HOLD', reason: 'No action performed' };
    } else {
      amountInLamports = Math.floor(amount * 1e9); // SOL to lamports
    }

    const swapUrl = `${gmgnApiBase}/get_swap_route?token_in_address=${inputToken}&token_out_address=${outputToken}&in_amount=${amountInLamports}&from_address=${user.publicKey}&slippage=10`;
    const routeRes = await fetch(swapUrl);
    const routeData = await routeRes.json();

    if (!routeData?.transaction) {
      throw new Error('Swap route unavailable');
    }

    const swapTx = routeData.transaction;
    const txBuffer = Buffer.from(swapTx, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    transaction.sign([user]);

    const sig = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      maxRetries: 3,
    });

    return {
      status: action,
      txHash: sig,
      token,
      amount: amountInLamports / 1e9,
      slippage: 10,
    };
  } catch (err) {
    console.error(err);
    return {
      error: 'Transaction failed',
      details: err.message || err.toString(),
    };
  }
}
