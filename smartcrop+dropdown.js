const dropArea = document.getElementById("drop-area");
const previewList = document.getElementById("preview-list");
const downloadAllButton = document.getElementById("download-all");
const resolutionSelect = document.querySelector(".resolution-select");
const resolutionDropdown = document.getElementById("resolution-dropdown");
const applyResolutionButton = document.getElementById("apply-resolution");
const customResWidth = document.getElementById("width");
const customResHeight = document.getElementById("height");
const loader = document.querySelector(".loader");
let rawImages;
let croppedImages = [];
let cropSize = {
  "width": null,
  "height": null
};
let pendingFile = null; // Store file awaiting resolution selection

// Drag and drop events
dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("drag-over");
  rawImages = e.dataTransfer.files;
  resolutionSelect.classList.remove('hidden')
});

function handleFiles(files, cropSize) {
  loader.classList.remove('hide-loader');
  resolutionSelect.classList.add('hidden');
  Array.from(files).forEach(file => {
    processFile(file, cropSize);
  });
}

function handleLoader() {
  if (croppedImages.length >= rawImages.length) {
    loader.classList.add('hide-loader');
  }
}

function processFile(file, cropSize) {
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
}

function handleUserEntry() {
  if (customResWidth.value && customResHeight.value && resolutionDropdown.value) {
    alert("Please use only the dropdown or a custom size");
  } else if (customResWidth.value && customResHeight.value) {
    cropSize.width = customResWidth.value;
    cropSize.height = customResHeight.value;
    handleFiles(rawImages, cropSize);
  } else if (resolutionDropdown.value) {
    let selectedResolution = resolutionDropdown.value.split("x");
    cropSize.width = parseInt(selectedResolution[0]);
    cropSize.height = parseInt(selectedResolution[1]);
    handleFiles(rawImages, cropSize);
  } else {
    alert("Please select a size or enter a custom size.");
  }
}

// Use dropdown selection for resolution when no size in filename
applyResolutionButton.onclick = () => {
  if (rawImages) {
    handleUserEntry();
    pendingFile = null; // Reset pending file after processing
  } else {
    alert("No images to crop");
  }
};

// Create preview with Smartcrop for cropping accuracy
function createPreview(imageSrc, file, cropSize) {  
  const img = new Image();
  img.src = imageSrc;
  img.onload = () => {
    smartcrop.crop(img, { width: cropSize.width, height: cropSize.height }).then(result => {
      const crop = result.topCrop;

      // Supersample canvas dimensions (2x target dimensions for quality)
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
        crop.x, crop.y, crop.width, crop.height,         // Source crop area from Smartcrop
        0, 0, canvas.width, canvas.height               // Draw on entire upscaled canvas
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
        handleLoader();
        const listItem = document.createElement("li");
        const croppedImage = document.createElement("img");
        const imageInfoContainer = document.createElement("div");
        const imageSizeInfo = document.createElement("p");
        const imageNameInfo = document.createElement("p");
        imageNameInfo.innerText = file.name;
        imageSizeInfo.innerText = `${img.width}x${img.height} → ${cropSize.width}x${cropSize.height}`
        croppedImage.src = croppedImageURL;
        imageInfoContainer.appendChild(imageNameInfo);
        imageInfoContainer.appendChild(imageSizeInfo);
        listItem.appendChild(croppedImage);
        listItem.appendChild(imageInfoContainer);

        const downloadButton = document.createElement("span");
        downloadButton.classList.add("downloadButton");
        const downloadIcon = document.createElement("img");
        downloadIcon.src = "./assets/download-button.png"
        downloadButton.appendChild(downloadIcon);
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
  //link.download = `cropped_${fileName.replace(/\.[^/.]+$/, ".jpg")}`; // Replace extension with .jpg
  link.download = `${fileName.replace(/\.[^/.]+$/, "")}_${cropSize.width}x${cropSize.height}px.jpg`; // Replace extension with .jpg
  link.click();
}

downloadAllButton.onclick = () => downloadAllCroppedImages();

function downloadAllCroppedImages() {
  const zip = new JSZip();
  //croppedImages.forEach(image => zip.file(`${cropSize.width}x${cropSize.height}_${image.name.replace(/\.[^/.]+$/, ".jpg")}`, image.blob));
  croppedImages.forEach(image => zip.file(`${image.name.replace(/\.[^/.]+$/, "")}_${cropSize.width}x${cropSize.height}.jpg`, image.blob));
  zip.generateAsync({ type: "blob" }).then(blob => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "all_cropped_images.zip";
    link.click();
  });
}
