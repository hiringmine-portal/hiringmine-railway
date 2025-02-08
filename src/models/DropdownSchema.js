import mongoose, { Schema } from "mongoose";

const DropdownSchema = new Schema({
    type: {
        type: String,
        required: [true, 'Please Add Dropdown name']
    },
    options: {
        type: Array,
        required: [true, 'Please Add Dropdown options'],
        default: [],
    },
}, {
    timestamps: true,
});
    

export default mongoose.model('Dropdown', DropdownSchema);