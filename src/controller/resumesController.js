import { INTERNALERROR, NOTFOUND, OK } from "../constants/httpStatus.js";
import Users from "../models/Register.js";
import ResumeDownloadLogSchema from "../models/ResumeDownloadLogSchema.js";
import { sendError, sendSuccess } from "../utils/responses.js";

export const getResumeDownloadLogs = async (req, res) => {
    try {
        const logs = await ResumeDownloadLogSchema.find().populate("downloadedBy", "name email").populate("resumeOwner", "name email");

        return res.status(OK).send(
            sendSuccess({
                status: true,
                message: "Download logs fetched successfully.",
                data: logs,
            })
        )
    } catch (error) {
        res.status(INTERNALERROR).send(
            sendSuccess({
                status: false,
                message: "Failed to fetch download logs.",
                data: error.message,
            })
        )
    }
};

// @desc Log Resume Download
// @route POST /api/resumes/download
// @access Authenticated
export const logResumeDownload = async (req, res) => {
    try {
        const { resumeOwnerId } = req.body; // ID of the person whose resume is being downloaded
        const downloadedById = req.user._id; // ID of the user downloading the resume

        if (!resumeOwnerId || !downloadedById) {
            return res.status(NOTFOUND).send(
                sendError({
                    status: false,
                    message: "Missing required fields.",
                })
            )
        }

        // Log the download
        await ResumeDownloadLogSchema.create({
            downloadedBy: downloadedById,
            resumeOwner: resumeOwnerId,
        });

        // Increment 'resumesDownloadedByOthers' for the resume owner
        await Users.findByIdAndUpdate(resumeOwnerId, {
            $inc: { resumesDownloadedByOthers: 1 },
        });

        // Increment 'resumesDownloadedByUser' for the downloader
        await Users.findByIdAndUpdate(downloadedById, {
            $inc: { resumesDownloadedByUser: 1 },
        });

        return res.status(OK).send(
            sendSuccess({
                status: true,
                message: "Resume download logged successfully.",
            })
        )
    } catch (error) {
        res.status(INTERNALERROR).send(
            sendError({
                status: false,
                message: "Failed to log resume download.",
                data: error.message,
            })
        )
    }
};
