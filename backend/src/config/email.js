const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // Port 587 uses STARTTLS
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

// Skip verification for development - Brevo requires IP whitelisting
console.log('Brevo SMTP Transporter configured (IP whitelisting required in Brevo account)');

module.exports = transporter;
