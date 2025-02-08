export const signupTemplate = (otp, token) => {
    return `
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hiringmine Registration OTP</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #6E6BFA;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .otp {
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            color: #6E6BFA;
            margin: 20px 0;
            letter-spacing: 5px;
        }
        .button {
            display: inline-block;
            background-color: #6E6BFA;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 20px;
        }
        .footer {
            background-color: #f8f8f8;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Hiringmine</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Thank you for registering with Hiringmine. To complete your registration, please use the following One-Time Password (OTP):</p>
            <div class="otp">${otp}</div>
            <p>This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
            <p>Alternatively, you can click the button below to verify your email address:</p>
            <p style="text-align: center;">
                <a href="https://hiringmine.com/otpverification?q=${token}" class="button" 
                    style="color:white"
                >Verify Email</a>
            </p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Hiringmine. All rights reserved.</p>
            <p><a href="https://hiringmine.com" style="color: #6E6BFA;">https://hiringmine.com</a></p>
        </div>
    </div>
</body>
</html>`
}