import mongoose from "mongoose";


const EducationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    institutionName: {
        type: String,
        required: true,
    },
    degree: String,
    fieldOfStudy: String,
    startMonth: {
        type: String,
    },
    startYear: {
        type: String,
    },
    endMonth: {
        type: String,
    },
    endYear: {
        type: String,
    },
    grade: {
        type: String,
    },
    currentlyProcessing: {
        type: Boolean,
        default: false
    },
});

export default mongoose.model('Education', EducationSchema);
