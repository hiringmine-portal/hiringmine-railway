import mongoose from 'mongoose';

const HashTagsSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please Add HashTag name'],
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: [false, 'Please Add is Active'],
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

export default mongoose.model('HashTags', HashTagsSchema);
