import redis from "../config/redis.js";
import { query } from "../config/db.js";
import { deleteFromCloudinary } from "../helper/coudinary_helper.js";

export const restoreDraftIfNeeded = async (req, res, next) => {
  try {
    const { confirmDuplicate, existingComplainId } = req.body;
    const user = req.userInfo;

    //if no existingComplainId in this point, new complaint with no similar complaint
    if(!existingComplainId){
      return next();
    }

    const tempKey = `draft:complaint:${user.id}`;
    const draftRaw = await redis.get(tempKey);

    if (!draftRaw) {
      console.warn("Redis draft not found for user:", user.id);
      return res.status(404).json({
        success: false,
        message: "No complaint draft found or it has expired.",
      });
    }

    const draft = JSON.parse(draftRaw);

    // If user confirmed similarity, delete uploaded image
    if (
      existingComplainId &&
      (confirmDuplicate === true || confirmDuplicate === "true")
    ) {
      const imageId = draft.photoUrl;
      // Delete image from Cloudinary and DB if exists
        if (imageId) {
          const imageRes = await query(`SELECT * FROM images WHERE id = $1`, [imageId]);
          const image = imageRes.rows[0];

          if (image) {
            await deleteFromCloudinary(image.public_id);
            await query(`DELETE FROM images WHERE id = $1`, [imageId]);
          }
        }

      req.body = {
        ...draft,
        confirmDuplicate: true,
        existingComplainId: existingComplainId,
      };
      await redis.del(tempKey); // Cleanup
      return next();
    }

    // If user rejected similarity, restore the draft
    if (
      existingComplainId &&
      (confirmDuplicate === false || confirmDuplicate === "false")
    ) {
      req.body = {
        ...draft,
        confirmDuplicate: false,
        existingComplainId: null,
      };

      await redis.del(tempKey);
      return next();
    }
  } catch (err) {
    console.error("Error in restoreDraftIfNeeded middleware:", err);
    return res.status(500).json({
      success: false,
      message: "Error restoring draft complaint. Please try again.",
    });
  }
};