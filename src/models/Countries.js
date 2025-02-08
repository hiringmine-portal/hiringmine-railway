import mongoose, { Schema } from 'mongoose';

const countrySchema = new mongoose.Schema({
    id: Number,
    name: String,
    iso3: String,
    iso2: String,
    numeric_code: String,
    phone_code: String,
    capital: String,
    currency: String,
    currency_name: String,
    currency_symbol: String,
    tld: String,
    native: String,
    region: String,
    region_id: String,
    subregion: String,
    subregion_id: String,
    nationality: String,
    timezones: Array,
    translations: Object,
    latitude: String,
    longitude: String,
    emoji: String,
    emojiU: String
});

export default mongoose.model('Country', countrySchema);