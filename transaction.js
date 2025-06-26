const express = require('express');
const bodyParser = require('body-parser');
const { Connection, Keypair } = require('@solana/web3.js');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const connection = new Connection(
  "https://mainnet.helius-rpc.com/?api-key=" + process.env.HELIUS_API_KEY,
  "confirmed"
);

const secretKey = Uint8Array.from(
  JSON.parse(Buffer.from(process.env.SOL_PRIVATE_KEY, 'base64').toString())
);

const payer = Keypair.fromSecretKey(secretKey);

app.post('/transaction', async (req, res) => {
  try {
    // Your transaction logic here
    res.status(200).send('Transaction endpoint ready');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
