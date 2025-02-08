import mongoose from 'mongoose';
const SkillsSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please Add Skill name'],
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    skillDescription: {
      type: String,
      default: "",
    },
    postCounts: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
      required: [false, 'Please Add createdBy'],
    },
    updatedBy: {
      type: String,
      required: [false, 'Please Add UpdatedBy'],
    },
  },
  {
    timestamps: true,
  }
);

SkillsSchema.index({ isActive: 1 });

export default mongoose.model('Skills', SkillsSchema);
