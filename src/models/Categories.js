import mongoose, { Schema } from 'mongoose';

const CategoriesSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please Add Cateogry name'],
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Please Add Cateogry name'],
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
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: [false, 'Please Add createdBy'],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: [false, 'Please Add UpdatedBy'],
    },
  },
  {
    timestamps: true,
  }
);

CategoriesSchema.index({ postCounts: -1 });  // Sorted in descending order as per the query


export default mongoose.model('Categories', CategoriesSchema);
