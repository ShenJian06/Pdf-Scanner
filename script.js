let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let imageLoader = document.getElementById("imageLoader");
let loaderOverlay = document.getElementById("loaderOverlay");
let loaderText = document.getElementById("loader-text");

let originalImage = null;
let currentImage = null;
let cropping = false;
let cropStart = null;
let cropEnd = null;

// =================== Event Listeners ===================
imageLoader.addEventListener("change", handleImageLoad);

canvas.addEventListener("mousedown", (e) => {
  if (activeTool !== 'crop') return;
  cropping = true;
  const rect = canvas.getBoundingClientRect();
  cropStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});

canvas.addEventListener("mousemove", (e) => {
  if (cropping && cropStart) {
    const rect = canvas.getBoundingClientRect();
    cropEnd = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drawImage(currentImage);
    drawCropRect();
  }
});

canvas.addEventListener("mouseup", () => {
  if (cropping && cropStart && cropEnd) {
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);

    const croppedImageData = ctx.getImageData(x, y, width, height);
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(croppedImageData, 0, 0);

    cropStart = cropEnd = null;
    cropping = false;
  }
});

let activeTool = null;

// =================== Tool Logic ===================
const tools = {
  crop: () => (activeTool = 'crop'),

  rotate: () => {
    if (!currentImage) return;
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");

    off.width = canvas.height;
    off.height = canvas.width;
    offCtx.translate(off.width / 2, off.height / 2);
    offCtx.rotate(Math.PI / 2);
    offCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    canvas.width = off.width;
    canvas.height = off.height;
    ctx.drawImage(off, 0, 0);
  },

  clarify: () => {
    if (!currentImage) return;
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.1);
      data[i + 1] = Math.min(255, data[i + 1] * 1.1);
      data[i + 2] = Math.min(255, data[i + 2] * 1.1);
    }
    ctx.putImageData(imageData, 0, 0);
  },

scan: () => {
  const video = document.getElementById("video");
  const captureBtn = document.getElementById("captureBtn");

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.style.display = "block";
      captureBtn.style.display = "inline-block";
      canvas.style.display = "none";

      captureBtn.onclick = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        currentImage = new Image();
        currentImage.src = canvas.toDataURL();

        // Stop camera
        stream.getTracks().forEach(track => track.stop());
        video.style.display = "none";
        captureBtn.style.display = "none";
        canvas.style.display = "block";
      };
    })
    .catch(err => {
      alert("Camera access denied or not available.");
      console.error(err);
    });
},



  reset: () => {
    if (!originalImage) return;
    drawImage(originalImage);
  },

  ocr: async () => {
    if (!window.Tesseract) {
      alert("OCR requires Tesseract.js to be loaded.");
      return;
    }

    loaderOverlay.style.display = "flex";

    const result = await Tesseract.recognize(canvas, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          loaderText.textContent = `OCR Progress: ${Math.round(m.progress * 100)}%`;
        }
      }
    });

    loaderOverlay.style.display = "none";
    alert("OCR Result:\n" + result.data.text);

    const textBlob = new Blob([result.data.text], { type: 'text/plain' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(textBlob);
    a.download = "ocr-result.txt";
    a.click();
  },

  save: () => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF();
    pdf.addImage(imgData, 'PNG', 10, 10, 180, 250);
    pdf.save('scan.pdf');
  }
};

// =================== Tool Button Handler ===================
document.querySelectorAll(".tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tool = btn.dataset.tool;
    if (tools[tool]) tools[tool]();
  });
});

// =================== Image Load Handler ===================
function handleImageLoad(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      originalImage = img;
      drawImage(img);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// =================== Helpers ===================
function drawImage(img) {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  currentImage = img;
}

function drawCropRect() {
  if (!cropStart || !cropEnd) return;
  ctx.strokeStyle = "#00ffff";
  ctx.lineWidth = 2;
  ctx.setLineDash([6]);
  ctx.strokeRect(
    cropStart.x,
    cropStart.y,
    cropEnd.x - cropStart.x,
    cropEnd.y - cropStart.y
  );
  ctx.setLineDash([]);
}
