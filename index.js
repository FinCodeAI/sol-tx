// index.js
import express from 'express';
import transactionHandler from './transaction.js';

const app = express();
app.use(express.json());

app.post('/tx', async (req, res) => {
  try {
    const result = await transactionHandler(req.body);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🟢 Server running on port ${PORT}`));
