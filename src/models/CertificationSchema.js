import mongoose from "mongoose";

const CertificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    certificationName: {
        type: String,
        required: true,
    },
    issuingOrganization: {
        type: String,
        required: true,
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
});

export default mongoose.model('Certification', CertificationSchema);