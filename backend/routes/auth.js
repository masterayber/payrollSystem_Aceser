const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const router = express.Router();
const JWT_SECRET = 'your_jwt_key_here';

//Signup Route
router.post('/signup', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = new User({ username, password, role });
        await user.save();

        res.status(201).json({ message: 'User Created Successfully'});
    }   catch (err) {
        res.status(500).json({ message: 'Server Error!', error: err.message });
    }
});

//Login Route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role}, JWT_SECRET, {
            expiresIn: '1h',
        });

        res.status(200).json({ token, message: 'Login Successful' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error', error: err.message});
    }
});

module.exports = router;