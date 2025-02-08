import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

export const connectDB = async () => {
  try {
    const con = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${con.connection.host}`);
  } catch (error) {
    console.log(error);
  }
};


const _config = {
  port: process.env.PORT || 5003,
  jwtSecretKey: process.env.JWT_SECRET_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  nodeEnv: process.env.NODE_ENV
}

// export const config = {
//   get(key) {
//     console.log(key, "====>>> key")
//     console.log(_config[key], "====>>> _config[key]")
//     return _config[key];
//   }
// }

export const config = Object.freeze(_config);