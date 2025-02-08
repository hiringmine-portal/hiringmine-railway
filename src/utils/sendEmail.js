import nodemailer from "nodemailer";

const emailConfig = {
    service: "gmail",
    auth: {
        user: process.env.PORTAL_EMAIL,
        pass: process.env.PORTAL_PASSWORD,
    },
};

export async function sendEmail(emailOption) {
    const transporter = nodemailer.createTransport(emailConfig);

    const mailOptions = {
        from: process.env.PORTAL_EMAIL,
        ...emailOption
    };

    try {
        await transporter.sendMail(mailOptions);
        return {
            success: true,
            message: "Email sent successfully"
        };
    } catch (error) {
        throw `Error sending OTP to ${mail} via email: ${error}`;
    }


}