import { INTERNALERROR } from "../constants/httpStatus.js";
import UserCappingCounter from "../models/UserCappingCounterSchema.js";
import { sendError } from "../utils/responses.js";

const checkDownloadLimit = async (req, res, next) => {
    const userId = req.user._id;
    const dailyLimit = 5;
    const weeklyLimit = 10;
    const monthlyLimit = 15;

    let counter = await UserCappingCounter.findOne({ userId });
    if (!counter) {
        counter = await UserCappingCounter.create({
            userId,
            daily: { resumeDownloads: { count: 0, lastReset: new Date() } },
            weekly: { resumeDownloads: { count: 0, lastReset: new Date() } },
            monthly: { resumeDownloads: { count: 0, lastReset: new Date() } },
        });
    }

    const now = new Date();

    const shouldReset = (lastResetDate, period) => {
        const elapsed = now - lastResetDate;
        switch (period) {
            case "daily": return elapsed >= 24 * 60 * 60 * 1000;
            case "weekly": return elapsed >= 7 * 24 * 60 * 60 * 1000;
            case "monthly": return now.getMonth() !== lastResetDate.getMonth();
            default: return false;
        }
    };

    if (shouldReset(counter.daily.resumeDownloads.lastReset, "daily")) {
        counter.daily.resumeDownloads.count = 0;
        counter.daily.resumeDownloads.lastReset = now;
    }
    if (shouldReset(counter.weekly.resumeDownloads.lastReset, "weekly")) {
        counter.weekly.resumeDownloads.count = 0;
        counter.weekly.resumeDownloads.lastReset = now;
    }
    if (shouldReset(counter.monthly.resumeDownloads.lastReset, "monthly")) {
        counter.monthly.resumeDownloads.count = 0;
        counter.monthly.resumeDownloads.lastReset = now;
    }

    if (counter.daily.resumeDownloads.count >= dailyLimit) {
        return res.status(INTERNALERROR).json(
            sendError({
                status: false,
                message: "Daily Limit Reached, Try again tomorrow",
                data: null,
            })
        );;
    }
    if (counter.weekly.resumeDownloads.count >= weeklyLimit) {
        return res.status(INTERNALERROR).json(
            sendError({
                status: false,
                message: "Weekly Limit Reached, Try again next week",
                data: null,
            })
        );
    }
    if (counter.monthly.resumeDownloads.count >= monthlyLimit) {
        return res.status(INTERNALERROR).json(
            sendError({
                status: false,
                message: "Monthly Limit Reached, Try again next month",
                data: null,
            })
        );
    }

    counter.daily.resumeDownloads.count += 1;
    counter.weekly.resumeDownloads.count += 1;
    counter.monthly.resumeDownloads.count += 1;

    await counter.save();
    next();
};

export default checkDownloadLimit;
