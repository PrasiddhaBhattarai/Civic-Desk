import { query } from '../config/db.js';

// i) Get a single complaint filed by the current user
const get_single_complaint_by_user = async (req, res) => {
    try {
        const userId = req.userInfo.id;
        const complaintId = parseInt(req.params.id, 10);

        const result = await query(
            `SELECT c.*, i.url AS image_url, cs.rating as currentUser_rating
             FROM complaints c
             JOIN complaint_supporters cs ON cs.complaint_id = c.id
             LEFT JOIN images i ON c.photo_path = i.id
             WHERE c.id = $1 AND cs.user_id = $2`,
            [complaintId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        res.json({
            success: true,
            message: "Complaints found",
            complaint: result.rows[0]
        });

    } catch (error) {
        console.error('Error fetching complaint:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

// ii) Get multiple complaints filed by the user (with filters and ordering)
const get_complaints_by_user = async (req, res) => {
    try {
        let userId;
        const userId_0 = req.userInfo.id;
        const { status, page = 1, limit = 10, order = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const parsedId = parseInt(req.query.id, 10);

        // only admin can view other users' complaint history
        // or if user is checking his/her own history
        const isAdmin = req.userInfo.role === 'ward_admin' || req.userInfo.role === 'municipality_admin';
        const ownHistory = userId_0 === parsedId;

        if (isAdmin || ownHistory) {
            userId = Number.isNaN(parsedId) ? userId_0 : parsedId;
        } else {
            userId = userId_0;
        }

        const isResolved = status === 'resolved';
        const orderBy = isResolved ? 'resolved_at' : 'submitted_at';
        const direction = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const params = [userId];
        let queryStr = `
            SELECT c.*, i.url AS image_url, cs.rating as currentUser_rating, cs.feedback
            FROM complaints c
            JOIN complaint_supporters cs ON cs.complaint_id = c.id
            LEFT JOIN images i ON c.photo_path = i.id
            WHERE cs.user_id = $1
        `;

        if (status) {
            queryStr += ` AND status = $2`;
            params.push(status);
        }

        queryStr += ` ORDER BY ${orderBy} ${direction} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryStr, params);

        if (result.rowCount === 0) {
            res.status(404).json({
                success: false,
                message: "no complaints found"
            })
        }
        res.json({
            success: true,
            message: "Complaints found",
            complaints: result.rows
        });

    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

// iii) Get complaints by location (for general users), filterable
const get_complaints_by_location = async (req, res) => {
    try {
        const {
            ward_id,
            palika_id,
            status,
            tags,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            order = 'desc'
        } = req.query;

        const wardId = parseInt(ward_id, 10);
        const palikaId = parseInt(palika_id, 10);

        if (Number.isNaN(wardId) && Number.isNaN(palikaId)) {
            return res.status(400).json({
                success: false,
                message: 'Either ward_id or palika_id is required and must be a valid integer.'
            });
        }

        const offset = (page - 1) * limit;
        const filters = [];
        const params = [];
        let joinClause = '';
        let locationClause = '';

        if (!Number.isNaN(wardId)) {
            locationClause = `c.ward_id = $${params.length + 1}`;
            params.push(wardId);
        } else if (!Number.isNaN(palikaId)) {
            joinClause = `JOIN wards w ON w.id = c.ward_id`;
            locationClause = `w.palika_id = $${params.length + 1}`;
            params.push(palikaId);
        }


        if (status) {
            filters.push(`c.status = $${params.length + 1}`);
            params.push(status);
        }

        if (tags) {
            const tagList = tags.split(',');
            filters.push(`c.tags && $${params.length + 1}::text[]`);
            params.push(tagList);
        }

        if (startDate) {
            filters.push(`c.submitted_at >= $${params.length + 1}`);
            params.push(startDate);
        }

        if (endDate) {
            filters.push(`c.submitted_at <= $${params.length + 1}`);
            params.push(endDate);
        }

        const isResolved = status === 'resolved';
        const orderBy = isResolved ? 'resolved_at' : 'submitted_at';
        const direction = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const whereClause = [locationClause, ...filters].join(' AND ');

        const finalQuery = `
            SELECT c.*, i.url AS image_url
            FROM complaints c
            ${joinClause}
            LEFT JOIN images i ON c.photo_path = i.id
            WHERE ${whereClause}
            ORDER BY ${orderBy} ${direction}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        params.push(limit, offset);

        const result = await query(finalQuery, params);

        if (result.rowCount === 0) {
            res.status(404).json({
                success: false,
                message: "no complaints found"
            })
        }

        res.json({
            success: true,
            complaints: result.rows
        });

    } catch (error) {
        console.error('Error fetching complaints by location:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

// iv) Get a single complaint by ID (role-based access)
const get_single_complaint_by_id = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const role = req.userInfo.role;

        const result = await query(`
            SELECT c.*, i.url AS image_url, w.name AS Ward_number, CONCAT(p.name, ' ', p.type) AS palika
            FROM complaints c
            LEFT JOIN images i ON c.photo_path = i.id
            JOIN wards w ON w.id = c.ward_id
            JOIN palika p ON p.id = w.palika_id
            WHERE c.id = $1`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        const complaint = result.rows[0];

        // Fetch all user_ids who supported this complaint
        const supporterResult = await query(
            `SELECT user_id, feedback, rating FROM complaint_supporters WHERE complaint_id = $1`,
            [id]
        );

        // Add supporter user_ids to the response
        complaint.supporter_ids = supporterResult.rows.map(row => row.user_id);
        complaint.suporter_count = supporterResult.rowCount;

        // hide sensitive info if role is user
        if (role === 'user') {
            delete complaint.user_id;
            delete complaint.supporter_ids;
            return res.json({
                success: true,
                complaint
            })
        }

        // Add feedback map (only non-null feedbacks)
        const feedbackMap = {};
        const ratingMap = {};
        for (const row of supporterResult.rows) {
            if (row.feedback !== null) {
                ratingMap[row.user_id] = row.rating;
                feedbackMap[row.user_id] = row.feedback;
            }
            else if (row.rating !== null) {
                ratingMap[row.user_id] = row.rating;
            }
        }
        if (Object.keys(ratingMap).length > 0) {
            complaint.ratings = ratingMap;
        }
        if (Object.keys(feedbackMap).length > 0) {
            complaint.feedbacks = feedbackMap;
        }

        res.json({
            success: true,
            complaint
        });

    } catch (error) {
        console.error('Error fetching complaint:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export {
    get_single_complaint_by_user,
    get_complaints_by_user,
    get_complaints_by_location,
    get_single_complaint_by_id
}