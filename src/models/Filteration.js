import mongoose, { Schema } from "mongoose";

const FilterationSchema = new Schema({
    filterationName: {
        type: String,
        required: [true, 'Please Add Filteration name']
    },
    filterationOptions: {
        type: Array,
        required: [true, 'Please Add Filteration options'],
        default: [],
    },
    fieldName: {
        type: String,
    },
    propertyName: {
        type: String,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    type: {
        type: String,
        default: 'jobs',
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
}, {
    timestamps: true,
});

export default mongoose.model('Filteration', FilterationSchema);