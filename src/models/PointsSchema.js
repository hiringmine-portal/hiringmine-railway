import mongoose from "mongoose";

const pointsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    points: {
        type: Number,
        default: 0,
        required: true,
    },
    earnedAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    // Add other fields as needed
});

export default mongoose.model('Points', pointsSchema);
