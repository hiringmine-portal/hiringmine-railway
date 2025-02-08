import { redis } from '../app.js';
import { OK } from '../constants/httpStatus.js';
import Skills from '../models/Skills.js';
import { sendSuccess } from '../utils/responses.js';

// @desc    Get Skills
// @route   GET /api/skills
// @access  PUBLIC
export const getSkills = async (req, res) => {
    try {
        const { query } = req.query; // Optional search query parameter

        const cacheKey = req.originalUrl + process.env.CACHE_KEY;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.status(OK).send(
                sendSuccess({
                    status: true,
                    message: 'All Admin Approved Skills fetched successfully.',
                    data: JSON.parse(cachedData)
                })
            );
        }

        // Build the query object with the adminApproval filter
        let filter = { active: true };

        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        // Find skills that match the query and have been approved by the admin
        const skills = await Skills.find(filter);

        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(skills));

        res.status(OK).send(
            sendSuccess({
                status: true,
                message: 'All Admin Approved Skills fetched successfully.',
                data: skills
            })
        );
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

// @desc    Get Skills Pending Admin Approval
// @route   GET api/skills/pending
// @access  Admin
export const getPendingSkills = async (req, res) => {
    try {
        const cacheKey = req.originalUrl + process.env.CACHE_KEY;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.status(OK).send(
                sendSuccess({
                    status: true,
                    message: 'Pending skills fetched successfully.'
                })
            );
        }
        const pendingSkills = await Skills.find({ isActive: false }).select('name');

        if (pendingSkills.length === 0) {
            return res.status(404).send(
                sendError({
                    status: false,
                    message: "No pending skills found.",
                    data: null,
                })
            );
        }

        redis.setex(cacheKey, process.env.REDIS_SECONDS, JSON.stringify(pendingSkills));

        return res.status(200).send(
            sendSuccess({
                status: true,
                message: "Pending skills fetched successfully.",
                data: pendingSkills,
            })
        );
    } catch (error) {
        res.status(500).send(
            sendError({
                status: false,
                message: error.message,
                data: null,
            })
        );
    }
};
