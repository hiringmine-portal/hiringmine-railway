// @desc    Admin Approval to Skills
// @route   PUT /api/admin/approve-skill
// @access  ADMIN

import mongoose from "mongoose";
import { INTERNALERROR, OK } from "../constants/httpStatus.js";
import JobAd from "../models/JobAd.js";
import { sendError, sendSuccess } from "../utils/responses.js";
import ReportSchema from "../models/ReportSchema.js";
import Users from '../models/Register.js';
import { redis } from "../app.js";
import { scanAndDelete } from "../utils/index.js";

export const approveSkill = async (req, res) => {
    try {
        const { skillId } = req.params;

        if (!skillId) {
            return res.status(400).json({ status: false, message: 'Skill ID is required.' });
        }

        // // Find and update the skill to set adminApproval to true
        // const updatedSkill = await Skills.findByIdAndUpdate(
        //     skillId,
        //     { adminApproval: true },
        //     { new: true }
        // );

        // if (!updatedSkill) {
        //     return res.status(404).json({ status: false, message: 'Skill not found.' });
        // }

        // res.status(200).json({ status: true, message: 'Skill approved successfully.', data: updatedSkill });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};


export const GetJobs = async (req, res) => {
    try {
        // Extract query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortField = req.query.sortField || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const isActive = req.query.isActive === 'true' ? true : false;
        const isVerified = req.query.isVerified === 'true' ? true : false;

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        // Prepare the base query
        const baseQuery = { isActive, isVerified };

        // Prepare the sort object
        const sort = { [sortField]: sortOrder };

        // Execute the main query
        const jobs = await JobAd.find(baseQuery)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("category")
            // .select('designation companyName category position jobType createdAt') // Select only necessary fields
            .lean(); // Use lean() for better performance when you don't need Mongoose documents

        // Get total count of active jobs (for pagination info)
        const totalJobs = await JobAd.countDocuments(baseQuery);

        // Prepare pagination info
        const totalPages = Math.ceil(totalJobs / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Send the response
        // res.json({
        //     jobs,
        //     currentPage: page,
        //     totalPages,
        //     totalJobs,
        //     hasNextPage,
        //     hasPrevPage
        // });

        res.status(OK).send(sendSuccess({
            status: true,
            message: 'Jobs fetched successfully',
            data: {
                jobs,
                currentPage: page,
                totalPages,
                totalJobs,
                hasNextPage,
                hasPrevPage
            }
        }))

    } catch (error) {
        console.error('Error fetching active jobs:', error);
        // res.status(500).json({ message: 'Internal server error' });
        res.status(INTERNALERROR).send(sendError({
            status: false,
            message: error.message || 'Error fetching active jobs',
        }))
    }
}


// router.put('/:jobId/toggle-active',);

export const toggleJobActiveStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        // Validate jobId
        await redis.del(`/api/jobAds/${jobId}${process.env.CACHE_KEY}`);
        const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
        await scanAndDelete(pattern);
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            // return res.status(400).json({ message: 'Invalid job ID' });
            return res.status(400).send(sendError({
                status: false,
                message: 'Invalid job ID',
                data: null
            }));
        }

        // Find the job and update its isActive status
        const job = await JobAd.findById(jobId);

        if (!job) {
            return res.status(404).send(sendError({
                status: false,
                message: 'Job not found',
                data: null
            }));
        }

        // Toggle the isActive status
        job.isActive = !job.isActive;

        // Save the updated job
        await job.save();


        res.status(OK).send(sendSuccess({
            status: true,
            message: 'Job status updated successfully',
            data: {
                jobId: job._id,
                isActive: job.isActive
            }
        }))


    } catch (error) {
        res.status(INTERNALERROR).send(sendError({
            status: false,
            message: error.message || 'Error updating job status',
            data: null
        }))
    }
}
export const toggleJobApprovalStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        // Validate jobId
        await redis.del(`/api/jobAds/${jobId}${process.env.CACHE_KEY}`);
        const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
        await scanAndDelete(pattern);
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            // return res.status(400).json({ message: 'Invalid job ID' });
            return res.status(400).send(sendError({
                status: false,
                message: 'Invalid job ID',
                data: null
            }));
        }

        // Find the job and update its isActive status
        const job = await JobAd.findById(jobId);

        if (!job) {
            return res.status(404).send(sendError({
                status: false,
                message: 'Job not found',
                data: null
            }));
        }

        // Toggle the isActive status
        job.isVerified = !job.isVerified;

        // Save the updated job
        await job.save();


        res.status(OK).send(sendSuccess({
            status: true,
            message: 'Job status updated successfully',
            data: {
                jobId: job._id,
                isActive: job.isActive
            }
        }))


    } catch (error) {
        res.status(INTERNALERROR).send(sendError({
            status: false,
            message: error.message || 'Error updating job status',
            data: null
        }))
    }
}
export const toggleJobHiddenStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        // Validate jobId
        await redis.del(`/api/jobAds/${jobId}${process.env.CACHE_KEY}`);
        const pattern = `/api/jobAds/all?limit=*&pageNo=*&keyWord=*&category=*${process.env.CACHE_KEY}`
        await scanAndDelete(pattern);
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            // return res.status(400).json({ message: 'Invalid job ID' });
            return res.status(400).send(sendError({
                status: false,
                message: 'Invalid job ID',
                data: null
            }));
        }

        // Find the job and update its isActive status
        const job = await JobAd.findById(jobId);

        if (!job) {
            return res.status(404).send(sendError({
                status: false,
                message: 'Job not found',
                data: null
            }));
        }

        // Toggle the isActive status
        job.isHidden = !job.isHidden;

        // Save the updated job
        await job.save();


        res.status(OK).send(sendSuccess({
            status: true,
            message: 'Job status updated successfully',
            data: {
                jobId: job._id,
                isActive: job.isActive
            }
        }))


    } catch (error) {
        res.status(INTERNALERROR).send(sendError({
            status: false,
            message: error.message || 'Error updating job status',
            data: null
        }))
    }
}



// export const GetReportsJob = async (req, res) => {
//     try {
//         const reports = await ReportSchema.find()
//             .populate('job', 'designation')
//             .populate('reporter', 'name email')
//             .sort('-createdAt');
//         res.json(reports);
//     } catch (error) {
//         res.status(500).json({ message: 'Error fetching reports', error: error.message });
//     }
// }

export const GetReportsJob = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pipeline = [
            {
                $lookup: {
                    from: 'jobads', // Assuming your job collection is named 'jobs'
                    localField: 'job',
                    foreignField: '_id',
                    as: 'jobData'
                }
            },
            {
                $lookup: {
                    from: 'users', // Assuming your user collection is named 'users'
                    localField: 'reporter',
                    foreignField: '_id',
                    as: 'reporterData'
                }
            },
            {
                $project: {
                    _id: 1,
                    job: {
                        designation: { $arrayElemAt: ['$jobData.designation', 0] },
                        _id: { $arrayElemAt: ['$jobData._id', 0] },
                        reportCount: { $arrayElemAt: ['$jobData.reportCount', 0] },
                        isActive: { $arrayElemAt: ['$jobData.isActive', 0] },
                        // isHidden: { $arrayElemAt: ['$jobData.isHidden', 0] },
                        // Add this line to see all fields from jobData
                        // allFields: { $arrayElemAt: ['$jobData', 0] }
                    },
                    reporter: {
                        firstName: { $arrayElemAt: ['$reporterData.firstName', 0] },
                        email: { $arrayElemAt: ['$reporterData.email', 0] },
                        _id: { $arrayElemAt: ['$reporterData._id', 0] }
                    },
                    // Include other fields from your ReportSchema as needed
                    reason: 1,
                    details: 1,
                    status: 1,
                    createdAt: 1
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const reports = await ReportSchema.aggregate(pipeline);

        const totalReports = await ReportSchema.countDocuments();
        const totalPages = Math.ceil(totalReports / limit);

        res.status(200).send(sendSuccess({
            status: true,
            message: 'Reports fetched successfully',
            data: {
                reports,
                currentPage: page,
                totalPages,
                totalReports
            }
        }))

    } catch (error) {
        // res.status(500).json({ message: 'Error fetching reports', error: error.message });
        res.status(500).send(sendError({ message: 'Error fetching reports', error: error.message }));
    }
};



export const GetUsers = async (req, res) => {
    try {
        // Extract query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortField = req.query.sortField || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const isActive = req.query.isActive === 'true' ? true : false;

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        // Prepare the base query
        const baseQuery = { isActive };

        // Prepare the sort object
        const sort = { [sortField]: sortOrder };

        // Execute the main query
        const users = await Users.find(baseQuery)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            // .populate("category")
            // .select('designation companyName category position jobType createdAt') // Select only necessary fields
            .lean(); // Use lean() for better performance when you don't need Mongoose documents

        // Get total count of active jobs (for pagination info)
        const totalUsers = await Users.countDocuments(baseQuery);

        // Prepare pagination info
        const totalPages = Math.ceil(totalUsers / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Send the response
        // res.json({
        //     jobs,
        //     currentPage: page,
        //     totalPages,
        //     totalJobs,
        //     hasNextPage,
        //     hasPrevPage
        // });

        res.status(OK).send(sendSuccess({
            status: true,
            message: 'Jobs fetched successfully',
            data: {
                users,
                currentPage: page,
                totalPages,
                totalUsers,
                hasNextPage,
                hasPrevPage
            }
        }))

    } catch (error) {
        console.error('Error fetching active jobs:', error);
        // res.status(500).json({ message: 'Internal server error' });
        res.status(INTERNALERROR).send(sendError({
            status: false,
            message: error.message || 'Error fetching active jobs',
        }))
    }
}


export const ToggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;

        // status ==> blocked , delete
        const { status } = req.body;
        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send(sendError({
                status: false,
                message: 'Invalid User ID',
                data: null
            }));
        }

        // Find the job and update its isActive status
        const user = await Users.findById(userId);

        if (!user) {
            return res.status(404).send(sendError({
                status: false,
                message: 'User not found',
                data: null
            }));
        }

        if (status === "blocked") {
            // Toggle the isActive status
            user.isActive = !user.isActive;
            user.isBlocked = !user.isBlocked;
        } else if (status === "deleted") {
            // user.isActive = user.isDeleted ? false : true;
            user.isDeleted = !user.isDeleted;
        }

        // Save the updated job
        await user.save();


        res.status(OK).send(sendSuccess({
            status: true,
            message: 'Job status updated successfully',
            data: {
                userId: user._id,
                isBlocked: user.isBlocked
            }
        }))


    } catch (error) {
        res.status(INTERNALERROR).send(sendError({
            status: false,
            message: error.message || 'Error updating User status',
            data: null
        }))
    }
}