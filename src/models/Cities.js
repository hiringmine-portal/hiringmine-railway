import mongoose, { Schema } from 'mongoose';

const citySchema = new mongoose.Schema({
    id: Number,
    name: String,
    country_code: String,  // This should match the iso2 code from the country model
    state: String,
    population: Number,
    latitude: String,
    longitude: String
});

export default mongoose.model('City', citySchema);