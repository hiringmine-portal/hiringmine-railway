import mongoose from "mongoose";

const userSkillsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    skill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
        required: true,
    },
    // proficiencyLevel: String, // Optional: Add additional fields as needed
});

export default mongoose.model('UserSkill', userSkillsSchema);
