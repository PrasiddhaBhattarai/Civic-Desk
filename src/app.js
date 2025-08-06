import express from "express";
import { query } from "./config/db.js";
import authRoutes from "./routes/auth_routes.js";
import cookieParser from "cookie-parser";
import complaintRoutes from "./routes/complaint_routes.js"
import averageRatingRoutes from "./routes/avg_ward_rating_routes.js"

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/complaint", complaintRoutes);
app.use("/api/rating", averageRatingRoutes)

export {app};