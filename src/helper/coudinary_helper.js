import cloudinary from "../config/cloudinary.js";

// function to upload image to cloudnary
const uploadToCloudinary = async (filePath) => {
    try {
        const result = await cloudinary.uploader.upload(filePath);

        return {
            url : result.secure_url,
            publicId : result.public_id
        };

    } catch (error) {
        console.error("error while uploading to cloudinary", error);
        throw new Error("error while uploading to cloudinary");
    }
}

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);

        return result; // { result: 'ok' } if successful
    } catch (error) {
        console.error("Error while deleting from Cloudinary:", error);
        throw new Error("Failed to delete image from Cloudinary.");
    }
};

export {
    uploadToCloudinary,
    deleteFromCloudinary 
};