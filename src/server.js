require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { runAgent } = require('./agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ParcelPilot Support Agent'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const result = await runAgent(message, {
      role: 'agent'
    });

    res.json(result);
  } catch (error) {
    console.error('Agent error:', error);

    res.status(500).json({
      error: 'Agent request failed',
      message: error.message
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`ParcelPilot Support Agent running on port ${PORT}`);
});
