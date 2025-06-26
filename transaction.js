const express = require('express');
const bodyParser = require('body-parser');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=" + process.env.HELIUS_API_KEY, "confirmed");
const secretKey = Uint8Array.from(JSON.parse(Buffer.from(process.env.SOL_PRIVATE_KEY, 'base64').toString()));
const payer = Keypair.fromSecretKey(secretKey);

app.post('/transaction', async (req, res) => {
  try {
    const toPubkey = new PublicKey(req.body.to);
    const lamports = req.body.amount;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey,
        lamports
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
    res.json({ success: true, signature });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.toString() });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Solana signer listening on port ${port}`);
});