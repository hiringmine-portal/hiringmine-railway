import { BADREQUEST, CREATED, INTERNALERROR, OK } from "../constants/httpStatus.js";
import { responseMessages } from "../constants/responseMessages.js";
import Filteration from "../models/Filteration.js";
import socialLinkOptionSchema from "../models/SocialLinkOptionSchema.js";
import { sendError, sendSuccess } from "../utils/responses.js";

const { ADD_SUCCESS_MESSAGES, GET_SUCCESS_MESSAGES, MISSING_FIELDS } = responseMessages

export const createSocialLinkOptions = async (req, res) => {
    try {
        const { platform, url } = req.body;

        // Check if the social link option already exists
        const existingOption = await socialLinkOptionSchema.findOne({ platform });
        if (existingOption) {
            return res.status(400).json(sendError({ message: 'Social link option already exists' }));
        }

        // Create a new social link option
        const newOption = new socialLinkOptionSchema({
            platform,
            url,
        });

        // Save the new social link option to the database
        await newOption.save();

        res.status(201).json(sendSuccess({ message: 'Social link option added successfully', option: newOption }));
    } catch (error) {
        console.error('Error adding social link option:', error);
        res.status(500).json(sendError({ message: 'Internal server error' }));
    }
};
export const getSocialLinkOptions = async (req, res) => {
    try {
        // Fetch all social link options from the database
        const options = await socialLinkOptionSchema.find();

        res.status(200).json(sendSuccess({ options }));
    } catch (error) {
        console.error('Error fetching social link options:', error);
        res.status(500).json(sendError({ message: 'Internal server error' }));
    }
};

