import { query } from "../config/db.js";
import redis from "../config/redis.js";
import { uploadToCloudinary } from "../helper/coudinary_helper.js";
import fs from "fs";

const complaintCategories = {
  "Roads & Transport": [
    "potholes",
    "illegal parking",
    "accident"
  ],
  "Sanitation": [
    "garbage",
    "open drains",
    "bad smell"
  ],
  "Water Supply": [
    "no water",
    "contaminated water"
  ],
  "Power": [
    "streetlight out",
    "power cuts"
  ],
  "Health": [
    "dead animals"
  ],
  "Environment": [
    "pollution",
    "noise complaints"
  ]
};

// Middleware to detect nearby similar complaints
export const checkSimilarComplaints = async (req, res, next) => {
  try {
    const { existingComplainId } = req.body;

    // Skip check if user confirmed duplicate manually
    if (existingComplainId) {
      return next();
    }

    const { latitude, longitude } = req.body;
    const user = req.userInfo;
    // console.log("user id: ",user.id);
    const tags = JSON.parse(req.body.tags); // transported through form data, treated as string rather than array otherwise

    //check if all tags are valid
    // Flatten all values from complaintCategories into one array
    const validTags = Object.values(complaintCategories).flat();

    // Check if every tag is included in the validTags list
    const allTagsValid = tags.every(tag => validTags.includes(tag));

    if (!allTagsValid) {
      return res.status(404).json({
        success: false,
        message: 'Some tags are invalid.'
      });
    }

    const tempKey = `draft:complaint:${user.id}`;


    if (!latitude || !longitude || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Location and tags are required to check for similar complaints."
      });
    }

    // Upload image to Cloudinary and save to DB if file exists
    let imageId = null;
    // check if file is missing in req object
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.path);

      // Remove temp file from disk
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.warn("Failed to delete temp image:", req.file.path, err);
      }

      // Store image in DB
      const imgInsert = await query(
        `INSERT INTO images (url, public_id) VALUES ($1, $2) RETURNING id`,
        [uploadResult.url, uploadResult.publicId]
      );
      imageId = imgInsert.rows[0].id;
      req.body.photoUrl = imageId; // Replace photoUrl in body with image ID
    } else {
      return res.status(400).json({
        success: false,
        message: 'image is required. Please upload an image.'
      });
    }

    // Search for nearby complaints (within 100m) sharing at least one tag
    const sql = `
      SELECT c.id, c.description, c.tags, ST_AsGeoJSON(c.location)::json AS location, i.url
      FROM complaints c
      JOIN images i ON i.id = c.photo_path
      WHERE ST_DWithin(c.location, ST_SetSRID(ST_Point($1, $2), 4326), 200)
      AND c.tags && $3::text[]
    `;

    const result = await query(sql, [longitude, latitude, tags]);
    // console.log("row count",result.rowCount);

    if (result.rowCount > 0) {
      // 1. Extract complaint_id from each row
      const similarComplaintIds = result.rows.map(row => row.id);

      // 2. Add to req.body
      req.body.similarComplaintIds = similarComplaintIds;

      await redis.set(tempKey, JSON.stringify(req.body), 'EX', 300); // expire in 5 minutes

      return res.status(200).json({
        success: false,
        message: "Similar complaints found nearby. Confirm if your complaint is one of them.",
        similar: result.rows,
        draftKey: tempKey
      });
    }

    return next(); // No similar complaints found
  } catch (err) {
    console.error("Error in checkSimilarComplaints middleware:", err);
    return res.status(500).json({
      success: false,
      message: "Error while checking for similar complaints."
    });
  }
};