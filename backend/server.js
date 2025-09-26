const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'https://deadline-app.vercel.app',
    'https://deadline-frontend.hb.bizmrg.com',
    'https://api.deadline.185-241-195-19.sslip.io',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'mongodb+srv://your-username:your-password@cluster.mongodb.net/deadlineapp?retryWrites=true&w=majority'
    : 'mongodb://localhost:27017/deadlineapp');

if (process.env.NODE_ENV === 'production' || process.env.MONGODB_URI) {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('Connected to MongoDB');
  }).catch(err => {
    console.error('MongoDB connection error:', err);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
} else {
  console.log('Running without MongoDB (development mode)');
}

// Task schema
const taskSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  tasks: [{
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    category: { type: String, default: 'other' },
    priority: { type: String, default: 'medium' },
    starred: { type: Boolean, default: false },
    created: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Deadline Backend API is running', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tasks/:userId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Development mode without MongoDB
      console.log(`Dev mode: Returning empty tasks for user ${req.params.userId}`);
      return res.json({});
    }
    
    const tasks = await Task.find({ userId: req.params.userId });
    const tasksObj = {};
    tasks.forEach(task => {
      tasksObj[task.date] = task.tasks;
    });
    res.json(tasksObj);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:userId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Development mode without MongoDB
      console.log(`Dev mode: Simulating save for user ${req.params.userId}`);
      return res.json({ success: true });
    }
    
    const { date, tasks } = req.body;
    await Task.findOneAndUpdate(
      { userId: req.params.userId, date },
      { tasks },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:userId/:date', async (req, res) => {
  try {
    await Task.findOneAndDelete({ userId: req.params.userId, date: req.params.date });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Telegram Bot integration for reminders (simplified)
app.post('/api/remind/:userId', async (req, res) => {
  // Here you would integrate with Telegram Bot API to send messages
  // For now, just log
  console.log(`Reminder for user ${req.params.userId}: ${req.body.message}`);
  res.json({ success: true });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
