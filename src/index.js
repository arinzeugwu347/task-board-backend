// 1. Importing Required Modules
const express = require('express');
const mongoose = require('mongoose');
const cors =  require('cors');
require('dotenv').config();


// 2. Initializing Express App
const app = express();

// 3. Middleware Setup (Processes every request)
app.use(express.json()); // Understands JSON in body

// Allow frontend to access backend
app.use(cors({
  origin: `${process.env.FRONTEND_URL}` || 'http://localhost:5173', // or '*' for dev
  credentials: true, // if you ever use cookies
}));

// Importing Routes and Using Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

//Connect board to main app
const boardRoutes = require('./routes/boardRoutes');
app.use('/api/boards', boardRoutes);
//connect List to main app
const listRoutes = require('./routes/listRoutes');
app.use('/api/lists', listRoutes);
//connect cards to the main app
const cardRoutes = require('./routes/cardRoutes');
app.use('/api/cards', cardRoutes);

// 4. Very Simple Route for Testing
app.get('/', (req, res) => {
    res.json({
        message: "Hello from Task Board Backend! Yeehaw!",
        time: new Date().toISOString(),
        typeof: "Backend"
    });
});



// 5. Connect to MongoDB
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log("Connected to MongoDB successfully!");

        // 6. Start the Server after DB Connection
        app.listen(PORT, () => {
            console.log("Server is running on port", PORT);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection failed:", err.message);
    });
