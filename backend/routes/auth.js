const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Employee = require('../models/employees')

const router = express.Router();
const JWT_SECRET = 'your_jwt_secret_key_here';

// Signup route
router.post('/signup', async (req, res) => {
  // Extract data from the request body
  const { firstName, lastName, email, username, password, role } = req.body;

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create user in `users` collection
    const user = new User({
      firstName,
      lastName,
      email,
      username,
      password,
      role, //Optional
    });
    await user.save();

// Create corresponding employee in 'employees' collection
    const newEmployee = new Employee({
      firstName,
      lastName,
      email,
    })
    await newEmployee.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Username' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Password' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({ token, message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Forgot Password route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user =  await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email is not registered' })
    }

    const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: '5m',
    });

    console.log('Password reset token: ${resetToken}');

    res.status(200).json({ message: 'Password reset token has been sent to your email',});
  } catch (err) {
    res.status(500).json({ message: "Server error. Please try again later", error: err.message});
  }
});
  
module.exports = router;