let steps = [];
let isRecording = false;

document.getElementById("startRecording").addEventListener("click", startRecording);
document.getElementById("stopRecording").addEventListener("click", stopRecording);

function sendMessageIfValid(message, callback) {
  if (chrome.runtime && chrome.runtime.id) {
    chrome.runtime.sendMessage(message, callback);
  } else {
    console.error("Extension context invalid");
  }
}

function sendMessageWithRetry(message, callback, maxRetries = 3, delay = 1000) {
  let retries = 0;

  function attemptSend() {
    sendMessageIfValid(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
        if (retries < maxRetries) {
          retries++;
          setTimeout(attemptSend, delay);
        } else {
          console.error("Max retries reached. Message failed.");
          callback(null); // Call the callback with null to indicate failure
        }
      } else {
        callback(response);
      }
    });
  }

  attemptSend();
}

function startRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: true }, (response) => {
    if (response !== null) {
      isRecording = true;
      updateUI();
    } else {
      console.error("Failed to start recording");
    }
  });
}

function stopRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: false }, (response) => {
    if (response !== null) {
      isRecording = false;
      updateUI();
    } else {
      console.error("Failed to stop recording");
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateSteps") {
    steps = message.steps;
    isRecording = message.isRecording;
    updateStepList();
    updateRecordingUI();
  }
});

function updateStepList() {
  const stepList = document.getElementById("stepList");
  
  // Only update new steps
  const currentStepCount = stepList.children.length;
  const fragment = document.createDocumentFragment();

  for (let i = currentStepCount; i < steps.length; i++) {
    const step = steps[i];
    const stepElement = createStepElement(step, i);
    fragment.appendChild(stepElement);

    // Process the screenshot and update the image asynchronously
    processScreenshot(step).then(processedScreenshot => {
      const img = stepElement.querySelector('img');
      img.src = processedScreenshot;
    });
  }

  stepList.appendChild(fragment);
}

function createStepElement(step, index) {
  const stepElement = document.createElement("div");
  stepElement.className = "step";

  const img = document.createElement("img");
  img.src = step.screenshot; // Display the screenshot immediately
  img.alt = `Step ${index + 1} screenshot`;
  stepElement.appendChild(img);

  const info = document.createElement("div");
  info.className = "step-info";
  if (step.type === 'iframeInteraction') {
    info.textContent = `Step ${index + 1}: Iframe interaction at (${step.x}, ${step.y}) - ${new URL(step.url).hostname}`;
  } else {
    info.textContent = `Step ${index + 1}: ${step.type} at (${step.x}, ${step.y}) - ${new URL(step.url).hostname}`;
  }
  stepElement.appendChild(info);

  return stepElement;
}

function addRedCircle(img, step) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;

  const scaleX = img.width / step.viewportWidth;
  const scaleY = img.height / step.viewportHeight;

  let x, y;
  if (step.type === 'iframeInteraction') {
    x = (step.iframePosition.x + step.x - step.scrollX) * scaleX;
    y = (step.iframePosition.y + step.y - step.scrollY) * scaleY;
  } else {
    x = (step.x - step.scrollX) * scaleX;
    y = (step.y - step.scrollY) * scaleY;
  }

  // Zoom parameters
  const zoomFactor = 1.5; // Adjust this value to change the zoom level
  const zoomedWidth = canvas.width / zoomFactor;
  const zoomedHeight = canvas.height / zoomFactor;

  // Calculate the top-left corner of the zoomed area
  let sx = x - zoomedWidth / 2;
  let sy = y - zoomedHeight / 2;

  // Adjust if the zoomed area goes out of bounds
  sx = Math.max(0, Math.min(sx, img.width - zoomedWidth));
  sy = Math.max(0, Math.min(sy, img.height - zoomedHeight));

  // Draw the zoomed image
  ctx.drawImage(img, sx, sy, zoomedWidth, zoomedHeight, 0, 0, canvas.width, canvas.height);

  // Recalculate the circle position based on the zoom
  const circleX = (x - sx) * (canvas.width / zoomedWidth);
  const circleY = (y - sy) * (canvas.height / zoomedHeight);

  // Ensure the circle is always visible
  const circleRadius = 20;
  const adjustedCircleX = Math.max(circleRadius, Math.min(circleX, canvas.width - circleRadius));
  const adjustedCircleY = Math.max(circleRadius, Math.min(circleY, canvas.height - circleRadius));

  // Draw the red circle
  ctx.beginPath();
  ctx.arc(adjustedCircleX, adjustedCircleY, circleRadius, 0, 2 * Math.PI);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  ctx.stroke();

  return canvas.toDataURL();
}

function processScreenshot(step) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const processedScreenshot = addRedCircle(img, step);
      resolve(processedScreenshot);
    };
    img.src = step.screenshot;
  });
}

function updateRecordingUI() {
  document.getElementById("startRecording").style.display = isRecording ? "none" : "block";
  document.getElementById("stopRecording").style.display = isRecording ? "block" : "none";
}

function updateUI() {
  sendMessageWithRetry({ action: "getState" }, (response) => {
    if (response !== null) {
      isRecording = response.isRecording;
      steps = response.steps;
      updateStepList();
      updateRecordingUI();
    } else {
      console.error("Failed to get state");
    }
  });
}

// Initialize the side panel
updateUI();