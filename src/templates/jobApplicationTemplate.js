export const JobApplicationTemplate = (
    jobTitle,
    companyName,
    candidateName,
    candidateEmail,
    profileUrl,
    resumeUrl,
    applicationDate) => {
    return `<!DOCTYPE html>
<html>

<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: #6851FF;
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }

        .content {
            background: #ffffff;
            padding: 20px;
            border: 1px solid #e1e1e1;
            border-radius: 0 0 8px 8px;
        }

        .job-info {
            background: #f0edff;
            border-left: 4px solid #6851FF;
            padding: 15px;
            margin: 15px 0;
        }

        .candidate-info {
            background: #f8f8f8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .button {
            background: #6851FF;
            color: white;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 6px;
            display: inline-block;
            margin: 10px 10px 10px 0;
        }

        .footer {
            text-align: center;
            padding-top: 20px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>

<body>
    <div class="email-container">
        <div class="header">
            <h2>New Job Application</h2>
        </div>

        <div class="content">
            <p>Hello,</p>

            <div class="job-info">
                <p>A candidate has applied for <strong>${jobTitle}</strong> position at
                    <strong>${companyName}</strong>.
                </p>
            </div>

            <div class="candidate-info">
                <h3>Candidate Information</h3>
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 30%; color: #666;">Name:</td>
                        <td><strong>${candidateName}</strong></td>
                    </tr>
                    <tr>
                        <td style="color: #666;">Email:</td>
                        <td>${candidateEmail}</td>
                    </tr>

                </table>
            </div>

            <p><strong>Access candidate details:</strong></p>
            <p>
                <a href="${profileUrl}" class="button" style="color:white;" >View Profile</a>
                <a href="${resumeUrl}" class="button" style="background: #2E7D32; color:white ">View Resume</a>
            </p>

            <p style="margin-top: 20px; color: #666;">
                Applied on: ${applicationDate}
            </p>
        </div>

        <div class="footer">
            <p>This is an automated email from Hiring Mine.</p>
        </div>
    </div>
</body>

</html>`
}