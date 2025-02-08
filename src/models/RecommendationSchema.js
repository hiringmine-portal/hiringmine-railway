import mongoose from "mongoose";

const recommendationSchema = new mongoose.Schema({
    giver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    relationship: {
        type: String,
        required: false,
    },
    position: {
        type: String,
        required: false,
    },
    visibility: {
        type: Boolean,
        default: true,
    },
    // You can add more fields as needed
}, { timestamps: true });

export default mongoose.model('Recommendation', recommendationSchema);