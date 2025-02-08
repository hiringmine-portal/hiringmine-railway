import mongoose, { Schema } from "mongoose";

// New Report Schema
const ReportSchema = new Schema({
    job: { type: Schema.Types.ObjectId, ref: 'JobAd' },
    profile: { type: Schema.Types.ObjectId, ref: 'User' },
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    details: String,
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});


export default mongoose.model('Report', ReportSchema);
