import express from "express";
import { authMiddleware } from "../middlewares/auth_middleware.js";
import { isRoleAdmin } from "../middlewares/admin_middleware.js";
import {isRoleUser} from "../middlewares/user_middleware.js"
import { checkSimilarComplaints } from "../middlewares/check_similar_complaints.js";
import { restoreDraftIfNeeded } from "../middlewares/restore_Complaint_draft.js";
import upload from "../middlewares/multer_upload.js";
import { compressImage } from "../middlewares/compress_image.js";
import {
    file_complaint,
    delete_complaint,
    update_status,
    escalate_to_municipality,
    rate_complaint
} from "../controllers/complaint_file_controller.js"
import {
    get_single_complaint_by_user,
    get_complaints_by_user,
    get_complaints_by_location,
    get_single_complaint_by_id
} from "../controllers/complaint_view_controller.js";


const router = express.Router();

router.post(
    "/file",
    authMiddleware,
    isRoleUser,
    upload.single('image'),// name on frontend also should be 'image'
    compressImage, // compress only if file exists
    checkSimilarComplaints, // image is uploaded here
    restoreDraftIfNeeded, // image deleted here if complant not needed
    file_complaint
);

router.delete("/:id",authMiddleware, isRoleUser,delete_complaint);

router.patch("/update-status/:id",authMiddleware, isRoleAdmin, update_status);

router.post("/escalate/:id",authMiddleware, isRoleAdmin, escalate_to_municipality);

router.patch("/rate/:id",authMiddleware, isRoleUser ,rate_complaint);



// for view_complaints

// Get a single complaint filed by the currently logged-in user
router.get('/user/:id',authMiddleware, get_single_complaint_by_user);

// Get multiple complaints filed by user (admin can pass ?id=USER_ID)
// Example: /complaints/user?page=1&limit=5&order=asc&status=resolved
router.get('/user',authMiddleware, get_complaints_by_user);

// Get complaints by location (ward or palika)
//  Example: /complaints/location?ward_id=2&status=pending&tags=road,electricity&order=desc&page=1&limit=5
router.get('/location',authMiddleware, get_complaints_by_location);

// Get complaint by ID (admin sees all fields, user doesn't see user_ids)
router.get('/:id',authMiddleware, get_single_complaint_by_id);


export default router;