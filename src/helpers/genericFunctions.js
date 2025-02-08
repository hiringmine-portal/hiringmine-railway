import axios from 'axios';
import PointsSchema from '../models/PointsSchema.js';
import Users from '../models/Register.js';
import AWS from 'aws-sdk'
import { config } from '../config/default.js';



export const checkIfUserExists = async (field, value) => {
    const user = await Users.findOne({ [field]: value });
    return user !== null;
};
export const checkIfUserExistsAndReturnUser = async (field, value) => {
    const user = await Users.findOne({ [field]: value });
    return user;
};

// Function to award referral bonus
export const awardPoints = async (userId, bonusPoints, reason, category, referringUserId) => {
    try {
        // Find the user
        const user = await Users.findById(userId);
        if (!user) {
            console.error(`User with ID ${userId} not found`);
            return;
        }

        // Update user's totalPoints
        await Users.findByIdAndUpdate(userId, { $inc: { totalPoints: bonusPoints } });

        // Record the referrer's ID in the user's document if referringUserId is provided

        if (referringUserId) {
            await Users.findByIdAndUpdate(userId, { referrerId: referringUserId });
        }

        // Record the bonus points in Points schema
        const points = new PointsSchema({
            user: userId,
            points: bonusPoints,
            earnedAt: Date.now(),
            reason,
            category,
        });
        await points.save();
    } catch (error) {
        console.error(`Error awarding referral bonus for user ${userId}: ${error.message}`);
    }
};

export const fetchLinkedinData = async (git = false, linkedinUrl) => {
    try {
        let response;
        if (git) {
            response = await axios.get('https://gist.githubusercontent.com/InnoSufiyan/b5375e4c810edbce5c27611a3ea9b201/raw/9b3e3839cc456d5d2f28773dc9d31f6030cc00ac/innosufiyan.json');
        } else {

            response = await axios.get('https://nubela.co/proxycurl/api/v2/linkedin', {
                headers: {
                    'Authorization': 'Bearer dORiMbopxMrhvJCSrA0YDw',
                },
                params: {
                    url: linkedinUrl,
                }
            });
        }

        return response.data;
    } catch (error) {
        console.error('Error fetching LinkedIn data:', error);
        throw new Error('Unable to fetch LinkedIn data');
    }
};

export const mapLinkedInDataToExperience = (linkedInExperience, userId) => {
    const { starts_at, ends_at, company, title, description, location } = linkedInExperience;

    const startDate = new Date(starts_at.year, starts_at.month - 1, starts_at.day);
    const endDate = ends_at ? new Date(ends_at.year, ends_at.month - 1, ends_at.day) : new Date();

    const durationInMilliseconds = endDate - startDate;
    const durationInYears = durationInMilliseconds / (1000 * 60 * 60 * 24 * 365);

    return {
        user: userId,
        position: title,
        companyName: company,
        description: description || '',
        startMonth: starts_at.month - 1,
        startYear: starts_at.year,
        endMonth: ends_at ? ends_at.month - 1 : null,
        endYear: ends_at ? ends_at.year : null,
        currentlyWorking: !ends_at,
        totalDuration: durationInYears,
        city: location ? location.split(',')[0] : '',
        country: location ? location.split(',')[location.split(',').length - 1] : '',
        // locationType: 'onsite', // or based on your logic
    };
};



// Configure AWS SDK
AWS.config.update({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: 'ap-southeast-2', // e.g., 'us-east-1'
});

const s3 = new AWS.S3();

// Function to upload images from LinkedIn URLs to S3
export const uploadImageToS3 = async (imageUrl, folder) => {
    try {
        // Download image from LinkedIn
        const response = await axios({
            url: imageUrl,
            responseType: 'arraybuffer',
        });
        const imageBuffer = Buffer.from(response.data, 'binary');

        // Upload to S3
        const params = {
            Bucket: 'singabucket.hiringmine',
            Key: `${folder}/${Date.now()}.jpg`, // Change extension based on file type if needed
            Body: imageBuffer,
            ContentType: response.headers['content-type'], // Ensure correct content type
        };

        const data = await s3.upload(params).promise();
        return data.Location; // URL of the uploaded image
    } catch (error) {
        console.error('Error uploading image to S3:', error);
        throw error;
    }
};
