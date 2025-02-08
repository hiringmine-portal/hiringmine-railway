import mongoose from "mongoose";

const sponsors = new mongoose.Schema({
  views: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });



export default mongoose.model('Sponsors', sponsors);
