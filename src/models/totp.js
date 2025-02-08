import mongoose from "mongoose";

const TOTPSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    secret: {
        type: String,
        required: true,
    },
    QRCode: {
        type: String,
        required: true,
    },
    // otp: {
    //     type: String,
    //     required: true,
    // },
    // otpExpires: {
    //     type: Date,
    //     // required: true,
    // },
    // isVerified: {
    //     type: Boolean,
    //     default: false,
    // },
}, { timestamps: true });


const TOTP = mongoose.model('TOTP', TOTPSchema)
export default TOTP
