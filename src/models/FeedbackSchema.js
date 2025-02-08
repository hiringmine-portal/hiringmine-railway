import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    feedback: {
      type: String,
      //   required: true,
    },
    rating: {
      type: Number,
      //   required: true,
      min: 1,
      max: 5,
    },
    selectedOptions: {
      type: [String],
      enum: [
        "Job Posting",
        "Job Searching",
        "Profile Creation",
        "Finding Candidates",
      ],
      // required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Feedback", FeedbackSchema);
