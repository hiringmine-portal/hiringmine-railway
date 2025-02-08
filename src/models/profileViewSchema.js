import mongoose from "mongoose";

const profileViewSchema = new mongoose.Schema({
    viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastViewed: { type: Date, default: Date.now },
    viewCount: { type: Number, default: 1 }
});

profileViewSchema.index({ viewerId: 1, profileId: 1 }, { unique: true });
export default mongoose.model('ProfileView', profileViewSchema);