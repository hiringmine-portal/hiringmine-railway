import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { Redis } from "ioredis";
import { config, connectDB } from "./config/default.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import jobAdsRoutes from "./routes/jobAdsRoutes.js";
import categoriesRoutes from "./routes/categoriesRoutes.js";
import notFoundMiddleWare from "./middleware/not-found.js";
import errorHandlerMiddleWare from "./middleware/error-handler.js";
import filterationRoutes from "./routes/filterationRoutes.js";
import transactionsRoutes from "./routes/transactionsRoutes.js";
import socialLinkRoutes from "./routes/socialLinkRoutes.js";
import sponsorsRoutes from "./routes/sponsorsRoutes.js";
import dropdownRoutes from "./routes/dropdownRoutes.js";
import configsRoutes from "./routes/configsRoutes.js";
import skillsRoutes from "./routes/skillsRoutes.js";
import { decryptMiddleware } from "./middleware/decryptMiddleware.js";
import adminRoutes from "./routes/adminRoutes.js";
import resumesRoutes from "./routes/resumes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
// import cron from "./cronJobs.js"
// import dropdownRoutes from "./routes/dropdownRoutes.js";

const app = express();
const PORT = config.port

dotenv.config();
connectDB();

export const redis = new Redis({
  host: 'redis-19098.c292.ap-southeast-1-1.ec2.redns.redis-cloud.com',
  port: 19098,
  password: 'wWTCSejS0CfPI1SW5A2riDEEE3U1cupi',
});

redis.on("connect", () => {
  console.log("Redis is connected");
});


const corsOptions = {
  origin: '*',
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));
app.use(decryptMiddleware)


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/jobAds", jobAdsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/filterations", filterationRoutes);
app.use("/api/socialLink", socialLinkRoutes);
app.use("/api/dropdown", dropdownRoutes);
app.use("/api/sponsors", sponsorsRoutes);
app.use("/api/configs", configsRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/resumes", resumesRoutes);
app.use("/api/feedback", feedbackRoutes);

app.get("/", (request, response) => {
  response.sendStatus(200).json({
    message: "Server has been running...",
  });
});

app.use(notFoundMiddleWare);
app.use(errorHandlerMiddleWare);

app.listen(PORT, () => {
  console.log(`Server is Running at http://localhost:${PORT}`);
});
