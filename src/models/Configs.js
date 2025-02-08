import mongoose, { Schema } from "mongoose";

const ConfigSchema = new Schema({
    type: {
        type: String,
    },
    status: {
        type: Boolean
    },
    web: {
        type: Boolean
    },
    android: {
        type: Boolean
    },
    iOs: {
        type: Boolean
    },
}, {
    timestamps: true,
});


export default mongoose.model('Config', ConfigSchema);