import sharp from "sharp";
import fs from "fs";

const MAX_ALLOWED_SIZE = 550 * 1024; // 550 KB

const compressImage = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/(\.[\w\d_-]+)$/i, "_compressed.jpg");

    let quality = 80;
    let buffer;

    do {
      buffer = await sharp(inputPath)
        .resize({ width: 1024 })       // Resize to max width
        .jpeg({ quality })             // Convert to JPEG
        .toBuffer();

      quality -= 10;
      //if (quality < 30) break;        // Avoid excessive degradation
    } while (buffer.length > MAX_ALLOWED_SIZE);

    // Write compressed buffer to output path
    fs.writeFileSync(outputPath, buffer);

    // Remove original file (any format)
    fs.unlinkSync(inputPath);

    // Update file info to use new compressed file
    req.file.path = outputPath;
    req.file.filename = outputPath.split("/").pop(); // or path.basename()
    req.file.mimetype = "image/jpeg";

    next();
  } catch (err) {
    console.error("Image compression failed:", err);
    return res.status(500).json({
      success: false,
      message: "Image compression failed.",
    });
  }
};

export {compressImage}