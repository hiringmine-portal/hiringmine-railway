import mongoose from "mongoose";

const appreciationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // Users who appreciated this user
    appreciatedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Users this user has appreciated
    appreciatingTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

export default mongoose.model('Appreciation', appreciationSchema);