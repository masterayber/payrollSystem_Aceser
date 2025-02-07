const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendEmail = async (email, otp) => {
  try {
    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Good day! Your OTP for password reset is ${otp}. This otp expires in 5 minutes.`,
    });

    console.log("Email sent: ", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email. Please try again later");
  }
};

module.exports = sendEmail;
