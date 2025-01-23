const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },

  lastName: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  jobTitle: {
    type: String,
    required: false
  },

  department: {
    type: String,
  },
});

module.exports = mongoose.model('Employee', employeeSchema);