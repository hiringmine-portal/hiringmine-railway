import mongoose from "mongoose";


const ResumeDownloadLogSchema = new mongoose.Schema({
    downloadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User ID of the downloader
    resumeOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },  // User ID of the resume owner
}, { timestamps: true }
);

export default mongoose.model("ResumeDownloadLogs", ResumeDownloadLogSchema);
