import { query } from '../config/db.js';
import redis from "../config/redis.js";

// i) Update all ward admin average ratings to Redis cache
const update_mean_ratings_in_redis = async (req, res) => {
    try {
        const secret = req.headers['x-cron-secret'];
        if (secret !== process.env.CRON_SECRET) {
            return res.status(401).json({
                sucess: false,
                message: 'Unauthorized'
            });
        }

        const result = await query(`
            SELECT 
              u.id AS admin_id,
              ROUND(AVG(c.rating)::numeric, 2) AS mean_rating
            FROM users u
            JOIN complaints c ON u.ward_id = c.ward_id
            WHERE u.role = 'ward_admin' AND c.rating IS NOT NULL
            GROUP BY u.id, u.ward_id    
        `);

        if (result.rowCount === 0) {
            return res.status(200).json({
                success: false,
                message: 'No ratings found'
            });
        }

        for (const row of result.rows) {
            const key = `ward_admin_rating:${row.admin_id}`;

            await redis.set(key, row.mean_rating, 'EX', 3600); // 1 hour expiry
        }

        console.log('Ward admin ratings successfully cached in Redis.');
        res.status(200).json({
            success: true,
            message: 'Ward admin ratings updated successfully'
        });
    } catch (error) {
        console.error('Error updating ward admin ratings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

const getCachedRating = async (req, res) => {
    try {
        const adminId = parseInt(req.params.id, 10);
        if (Number.isNaN(adminId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin ID'
            });
        }

        const data = await redis.get(`ward_admin_rating:${adminId}`);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Cached data not found'
            });
        };
        const rating = parseFloat(data);
        res.status(200).json({
            success: true,
            message: 'Cached average rating found successfully',
            rating
        });
    } catch (error) {
        console.error('Error getting cached ward admin rating:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

const getLatestRating = async (req, res) => {
    try {
        const adminId = parseInt(req.params.id, 10);
        if (Number.isNaN(adminId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin ID'
            });
        }
        const result = await query(`
            SELECT 
              ROUND(AVG(c.rating)::numeric, 2) AS mean_rating
            FROM users u
            JOIN complaints c ON u.ward_id = c.ward_id
            WHERE u.id = $1 AND u.role = 'ward_admin' AND c.rating IS NOT NULL 
        `, [adminId]);

        if (result.rowCount === 0 || result.rows[0].mean_rating === null) {
            return res.status(404).json({
                success: false,
                message: 'No rating found.'
            });
        }

        const rating = result.rows[0].mean_rating;

        res.status(200).json({
            success: true,
            message: 'Latest average rating found successfully',
            rating
        });

    } catch (error) {
        console.error('Error getting latest ward admin rating:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
}

export {
    update_mean_ratings_in_redis,
    getCachedRating,
    getLatestRating
};