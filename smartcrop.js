const dropArea = document.getElementById("drop-area");
const previewList = document.getElementById("preview-list");
const downloadAllButton = document.getElementById("download-all");
let croppedImages = [];

// Drag and drop events
dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("drag-over");
  handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
  Array.from(files).forEach(file => {
    const cropSize = getCropSizeFromFileName(file.name);
    if (cropSize) {
      // Compress the image before further processing
      new Compressor(file, {
        quality: 0.8, // Set compression quality (0-1)
        success: (compressedFile) => {
          const reader = new FileReader();
          reader.onload = () => createPreview(reader.result, compressedFile, cropSize);
          reader.readAsDataURL(compressedFile);
        },
        error(err) {
          console.error(`Error compressing ${file.name}:`, err);
        }
      });
    } else {
      alert(`Invalid crop size in filename: ${file.name}`);
    }
  });
}

// Extract width and height from filename
function getCropSizeFromFileName(fileName) {
  const sizeMatch = fileName.match(/(\d+)x(\d+)/);
  return sizeMatch ? { width: parseInt(sizeMatch[1]), height: parseInt(sizeMatch[2]) } : null;
}

// Crop image, generate preview, and add to list
function createPreview(imageSrc, file, cropSize) {
  const img = new Image();
  img.src = imageSrc;
  img.onload = () => {
    // Use Smartcrop to determine the best crop area
    smartcrop.crop(img, { width: cropSize.width, height: cropSize.height }).then(result => {
      const crop = result.topCrop;

      // Supersample canvas dimensions (2x the target dimensions)
      const upscaleFactor = 2;
      const canvas = document.createElement("canvas");
      canvas.width = cropSize.width * upscaleFactor;
      canvas.height = cropSize.height * upscaleFactor;
      const ctx = canvas.getContext("2d");

      // Enable high-quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw the optimal crop area on a high-resolution canvas
      ctx.drawImage(
        img,
        crop.x, crop.y, crop.width, crop.height,                  // Source crop area from Smartcrop
        0, 0, canvas.width, canvas.height                        // Draw on entire upscaled canvas
      );

      // Downscale to target dimensions with high-quality JPEG export
      const downscaleCanvas = document.createElement("canvas");
      downscaleCanvas.width = cropSize.width;
      downscaleCanvas.height = cropSize.height;
      const downscaleCtx = downscaleCanvas.getContext("2d");
      downscaleCtx.imageSmoothingEnabled = true;
      downscaleCtx.imageSmoothingQuality = "high";

      downscaleCtx.drawImage(canvas, 0, 0, cropSize.width, cropSize.height);

      // Convert to JPEG blob with high quality
      downscaleCanvas.toBlob((blob) => {
        const croppedImageURL = URL.createObjectURL(blob);
        croppedImages.push({ name: file.name, blob });

        const listItem = document.createElement("li");
        const originalImage = document.createElement("img");
        originalImage.src = imageSrc;
        const croppedImage = document.createElement("img");
        croppedImage.src = croppedImageURL;

        listItem.appendChild(originalImage);
        listItem.appendChild(croppedImage);

        const downloadButton = document.createElement("button");
        downloadButton.innerText = "Download Cropped Image";
        downloadButton.onclick = () => downloadImage(blob, file.name);
        listItem.appendChild(downloadButton);

        previewList.appendChild(listItem);
      }, "image/jpeg", 0.9); // Set JPEG quality to 90%
    });
  };
}


function downloadImage(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `cropped_${fileName.replace(/\.[^/.]+$/, ".jpg")}`; // Replace extension with .jpg
  link.click();
}

downloadAllButton.onclick = () => downloadAllCroppedImages();

function downloadAllCroppedImages() {
  const zip = new JSZip();
  croppedImages.forEach(image => zip.file(`cropped_${image.name.replace(/\.[^/.]+$/, ".jpg")}`, image.blob));
  zip.generateAsync({ type: "blob" }).then(blob => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "all_cropped_images.zip";
    link.click();
  });
}
