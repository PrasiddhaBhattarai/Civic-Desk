// controller logics for filing complaint, and modifying the complaints as per requirement
// doesn't include viewing complaint logic

import { query } from "../config/db.js";
import { findWardFromLocation } from "../utils/ward_locator.js";
import { deleteFromCloudinary } from "../helper/coudinary_helper.js";

// i) File complaint
const file_complaint = async (req, res) => {
    try {
        const { description, latitude, longitude, photoUrl, confirmDuplicate, existingComplainId } = req.body;
        const tags = JSON.parse(req.body.tags);
        const user = req.userInfo;

        // If confirmDuplicate = true, add support to existing complaint
        if (confirmDuplicate && existingComplainId) {
            //
            if (!req.body.similarComplaintIds.includes(existingComplainId)) {
                return res.status(404).json({
                    success: false,
                    message: "The specified complaint was not found in the list of similar complaints."
                });
            }
            // console.log("inside");
            const exists = await query(`
                INSERT INTO complaint_supporters (complaint_id,user_id)
                SELECT $1, $2
                WHERE NOT EXISTS (
                    SELECT 1 FROM complaint_supporters WHERE   complaint_id = $1 AND user_id = $2
                )
                RETURNING complaint_id, supported_at
            `, [existingComplainId, user.id]);

            if (exists.rowCount === 0) {
                return res.status(400).json({
                    success: false,
                    message: "You have already supported this complaint or it doesn't exist."
                });
            }

            return res.status(200).json({
                success: true,
                message: "Complaint support recorded.",
                complaint: exists.rows[0]
            });
        }


        // new complaint file
        if (!description || !latitude || !longitude || !tags || !Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                message: "Missing or invalid required fields."
            });
        }

        const ward = await findWardFromLocation(latitude, longitude);
        if (!ward) {
            return res.status(400).json({
                success: false,
                message: "Location is outside any known ward."
            });
        }

        // const insertComplaint = `
        //     INSERT INTO complaints (user_id, ward_id, description, location, photo_path, tags)
        //     VALUES ($1, $2, $3, ST_SetSRID(ST_Point($4, $5), 4326), $6, $7)
        //     RETURNING id, status, submitted_at
        // `;
        const insertComplaint = `
            WITH inserted AS (
               INSERT INTO complaints (user_id, ward_id, description, location,     photo_path, tags)
                VALUES ($1, $2, $3, ST_SetSRID(ST_Point($4, $5), 4326), $6, $7)
                RETURNING id, status, submitted_at, ward_id
            )
            SELECT 
                inserted.id,
                inserted.status,
                inserted.submitted_at,
                w.name AS ward_number,
                CONCAT(p.name, ' ', p.type) AS palika
            FROM inserted
            JOIN wards w ON w.id = inserted.ward_id
            JOIN palika p ON p.id = w.palika_id;
        `;

        const result = await query(insertComplaint, [user.id, ward.id, description, longitude, latitude, photoUrl || null, tags]);
        const complaintId = result.rows[0].id;

        await query(`
            INSERT INTO complaint_supporters (complaint_id, user_id)
            VALUES ($1, $2)
        `, [complaintId, user.id]);

        res.status(201).json({
            success: true,
            message: "Complaint filed successfully.",
            complaint: result.rows[0],
        });
    } catch (error) {
        console.error("Error in file_complaint", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
}

// ii) Delete complaint (user only if owned)
const delete_complaint = async (req, res) => {
    try {
        const user = req.userInfo;
        const id = parseInt(req.params.id, 10);

        const result = await query(`SELECT * FROM complaints WHERE id = $1`, [id]);
        const complaint = result.rows[0];

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found."
            });
        }

        const imageId = complaint.photo_path;

        //get all supporters
        const supportRes = await query(`
            SELECT user_id FROM complaint_supporters WHERE complaint_id = $1
        `, [id]);
        const supporterIds = supportRes.rows.map(r => r.user_id);

        // If the user is the one who filed the complaint
        if (complaint.user_id === user.id) {
            // If there are other supporters
            if (supporterIds.length > 1) {
                const newOwnerId = supporterIds.find(uid => uid !== user.id);

                //assign new owner_user
                await query(`
                    UPDATE complaints SET user_id = $1 WHERE id = $2
                `, [newOwnerId, id]);

                //remove user from complaint_supporters
                await query(`
                    DELETE FROM complaint_supporters WHERE complaint_id = $1 AND user_id = $2
                `, [id, user.id]);

                return res.status(200).json({
                    success: true,
                    message: "Ownership transferred to another supporter and you were removed from the complaint."
                });
            } else {
                // Delete image from Cloudinary and DB if exists
                if (imageId) {
                    const imageRes = await query(`SELECT * FROM images WHERE id = $1`, [imageId]);
                    const image = imageRes.rows[0];

                    if (image) {
                        await deleteFromCloudinary(image.public_id);
                        await query(`DELETE FROM images WHERE id = $1`, [imageId]);
                    }
                }
                // No other supporters, delete the complaint
                await query(`DELETE FROM complaints WHERE id = $1`, [id]);
                await query(`DELETE FROM complaint_supporters WHERE complaint_id = $1`, [id]);
                return res.status(200).json({
                    success: true,
                    message: "Complaint deleted successfully."
                });
            }
        }

        // If user is just a supporter, remove their support
        if (supporterIds.includes(user.id)) {
            await query(`
                DELETE FROM complaint_supporters WHERE complaint_id = $1 AND user_id = $2
            `, [id, user.id]);

            return res.status(200).json({
                success: true,
                message: "You have been removed from the list of supporters.",
            });
        }

        return res.status(403).json({
            success: false,
            message: "You are not authorized to delete or modify this complaint."
        });
    } catch (error) {
        console.error("Error in delete_complaint", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
}

// iii) Update status (admin of that ward only)
const update_status = async (req, res) => {
    try {
        const admin = req.userInfo;
        const id = parseInt(req.params.id, 10);
        const { status } = req.body;
        // (status IN (
        //   'registered','under_review','assigned','in_progress','resolved'
        // ))

        const result = await query(`SELECT * FROM complaints WHERE id = $1`, [id]);
        const complaint = result.rows[0];

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found."
            });
        }

        // verify ward_admin,
        const isWardAdmin = admin.role === 'ward_admin' && admin.ward_id === complaint.ward_id && !complaint.escalated_to_municipality;
        // check if municipality_admin is assigned to complaint and verify the admin
        const isMunicipalityAdmin = admin.role === 'municipality_admin' && complaint.escalated_to_municipality;

        if (!isWardAdmin && !isMunicipalityAdmin) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this complaint"
            });
        }

        if (complaint.status === "resolved") {
            return res.status(400).json({
                success: false,
                message: "Complaint is already marked resolved"
            });
        }

        const updateFields = [`status = $1`];
        const values = [status, id];
        if (status === "resolved") {
            updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
        }

        const sql = `UPDATE complaints SET ${updateFields.join(", ")} WHERE id = $2`;

        await query(sql, values);

        res.status(200).json({
            success: true,
            message: "Complaint status updated."
        });
    } catch (error) {
        console.error("Error in update_complaint_status!", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
}

//if necessary, ward_admin transfer complaint to municipality_admin
const escalate_to_municipality = async (req, res) => {
    try {
        const admin = req.userInfo;
        const id  = parseInt(req.params.id, 10);

        const result = await query(`SELECT * FROM complaints WHERE id = $1`, [id]);
        const complaint = result.rows[0];

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found.",
            });
        }

        if (complaint.ward_id !== admin.ward_id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to escalate this complaint.",
            });
        }

        await query(`UPDATE complaints SET escalated_to_municipality = true WHERE id = $1`, [id]);

        res.status(200).json({
            success: true,
            message: "Complaint escalated to municipality.",
        });
    } catch (error) {
        console.error("Error in escalate_to_municipality!", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
}

// iv) Rate complaint (only after resolved, by original user)
const rate_complaint = async (req, res) => {
    try {
        const user = req.userInfo;
        const id  = parseInt(req.params.id, 10);
        const { rating, feedback } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5."
            });
        }

        const result = await query(`SELECT * FROM complaints WHERE id = $1`, [id]);
        const complaint = result.rows[0];

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found."
            });
        }

        const supportRes = await query(`SELECT * FROM complaint_supporters WHERE complaint_id = $1 AND user_id = $2`, [id, user.id]);
        const hasPermission = complaint.user_id === user.id || supportRes.rowCount > 0;
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to rate this complaint."
            });
        }

        if (complaint.status !== 'resolved') {
            return res.status(400).json({
                success: false,
                message: "You can only rate resolved complaints."
            });
        }

        // update rating in commplaint_supporters
        await query(`
            UPDATE complaint_supporters
            SET rating = $1, feedback = $2
            WHERE complaint_id = $3 AND user_id = $4
        `, [rating, feedback || null, id, user.id]);

        // Recalculate average
        const avgRes = await query(`
            SELECT AVG(rating)::numeric(3,2) as avg_rating
            FROM complaint_supporters
            WHERE complaint_id = $1 AND rating IS NOT NULL
        `, [id]);

        const avgRating = avgRes.rows[0].avg_rating;
        await query(`
            UPDATE complaints SET rating = $1 WHERE id = $2
        `, [avgRating, id]);

        res.status(200).json({
            success: true,
            message: "Thank you for your feedback."
        });
    } catch (error) {
        console.error("Error in user rate_complaint!", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
}

export {
    file_complaint,
    delete_complaint,
    update_status,
    escalate_to_municipality,
    rate_complaint
}