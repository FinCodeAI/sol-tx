import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const GMGN_API = 'https://gmgn.ai/defi/router/v1/sol/tx';
const SLIPPAGE = 10;
const FEE = 0.002;

export async function transactionHandler({ token, amount, action }) {
  try {
    if (!token || !amount || !action) throw new Error('Missing parameters');

    const wallet = process.env.SOLANA_PUBLIC_KEY;
    const userPrivateKey = process.env.SOL_PRIVATE_KEY;
    if (!wallet || !userPrivateKey) throw new Error('Missing wallet credentials');

    let tokenIn, tokenOut;
    if (action === 'BUY' || action === 'DCA') {
      tokenIn = 'So11111111111111111111111111111111111111112'; // SOL
      tokenOut = token;
    } else if (action === 'SELL') {
      tokenIn = token;
      tokenOut = 'So11111111111111111111111111111111111111112';
    } else if (action === 'HOLD') {
      return { status: 'HOLD', reason: 'No transaction needed' };
    } else {
      throw new Error('Unsupported action');
    }

    const routeRes = await fetch(
      `${GMGN_API}/get_swap_route?token_in_address=${tokenIn}&token_out_address=${tokenOut}` +
        `&in_amount=${amount}&from_address=${wallet}&slippage=${SLIPPAGE}&fee=${FEE}&is_anti_mev=true`
    );

    const routeData = await routeRes.json();
    if (!routeData.routes?.[0]) throw new Error('No swap route found');

    const txRes = await fetch(`${GMGN_API}/build_swap_transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route: routeData.routes[0],
        wallet,
        userPrivateKey,
      })
    });

    const txResult = await txRes.json();
    if (!txResult?.txHash) throw new Error('Transaction failed to build or send');

    return {
      status: action,
      txHash: txResult.txHash,
      token,
      amount,
      slippage: SLIPPAGE
    };
  } catch (e) {
    console.error('Transaction error:', e);
    return { error: 'Transaction failed', details: e.message };
  }
}
