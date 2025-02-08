import mongoose from "mongoose";

const ExperienceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    position: {
        type: String,
        required: true,
    },
    employmentType: {
        type: String,
        // required: true,
    },
    companyName: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        // required: true,
    },
    country: {
        type: String,
        // required: true,
    },
    currentlyWorking: {
        type: Boolean,
        default: false
    },
    startMonth: {
        type: String,
        required: true,
    },
    startYear: {
        type: String,
        required: true,
    },
    endMonth: {
        type: String,
    },
    endYear: {
        type: String,
    },
    locationType: {
        type: String,
        enum: ["onsite", "remote", "hybrid"]
    },
    totalDuration: {
        type: Number,
        required: true,
    },
    description: String, // Description of the user's experience
});

export default mongoose.model('Experience', ExperienceSchema);