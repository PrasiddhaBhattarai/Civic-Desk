import express from "express";
import { authMiddleware } from "../middlewares/auth_middleware.js";
import { 
    update_mean_ratings_in_redis,
    getCachedRating,
    getLatestRating
} from "../controllers/get_cached_rating.js";

const router = express.Router();

// path for cron job to update admin-ratings
router.post('/cron/update', update_mean_ratings_in_redis);

// avg rating from cache
router.get('/cached/:id',authMiddleware, getCachedRating);

// avg rating from database query
router.get('/latest/:id',authMiddleware, getLatestRating);

export default router;