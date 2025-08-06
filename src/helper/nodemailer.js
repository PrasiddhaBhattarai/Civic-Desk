import nodemailer from 'nodemailer';
import { config } from "dotenv";
config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const PutMailOptions = (receiverEmail, subject, htmlBody) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: receiverEmail,
        subject: subject,
        html: htmlBody
    }
    return mailOptions;
};


const registerEmailVerificationMail = async (email, code) => {
    const receiverEmail = email;
    const subject = 'Account Verification-Code';
    const htmlBody = `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #2E86C1;">Email Verification Code</h2>
                    <p>Hello,</p>
                    <p>Your verification code is:</p>
                    <p style="font-size: 24px; font-weight: bold; color: #2980B9; letter-spacing: 2px;">${code}</p>
                    <p>This code will expire in <strong>3 minutes</strong>.</p>
                    <hr style="border:none; border-top:1px solid #ccc; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">If you did not request this code, please ignore this email.</p>
                    <p style="font-size: 12px; color: #999;">Thank you,<br>Smart Palika Team</p>
                </div>
            `
    const mailOptions = PutMailOptions(receiverEmail, subject, htmlBody);

    try {
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error in sending email: ', error);
        throw error;
    }
}

export { registerEmailVerificationMail };

// Example info Output (Gmail + SMTP)
// 
// {
//   accepted: [ 'recipient@example.com' ],
//   rejected: [],
//   envelopeTime: 500,
//   messageTime: 600,
//   messageSize: 1024,
//   response: '250 2.0.0 OK 1698765432 q15-20020a170902a1234-abc123',
//   envelope: {
//     from: 'john@gmail.com',
//     to: [ 'recipient@example.com' ]
//   },
//   messageId: '<abcdef123456@yourhostname>'
// }