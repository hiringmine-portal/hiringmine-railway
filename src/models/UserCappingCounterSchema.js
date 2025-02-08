import mongoose from "mongoose";

const limitSchema = new mongoose.Schema({
    count: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now },
});

const userCappingCounterSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    daily: {
        resumeDownloads: limitSchema,
    },
    weekly: {
        resumeDownloads: limitSchema,
    },
    monthly: {
        resumeDownloads: limitSchema,
    },
});

export default mongoose.model("UserCappingCounter", userCappingCounterSchema);
