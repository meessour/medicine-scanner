const videoCanvas = document.getElementById('user-camera');

const enableCameraButton = document.getElementById("enable-camera-button");
const disableCameraButton = document.getElementById("disable-camera-button");
const scanResultContainer = document.getElementById("scan-result-container");
const switchCameraButton = document.getElementById("switch-camera");
const searchMedicineInput = document.getElementById("search-medicine");

const loadingBar = document.getElementById("loading-bar");

// Initiate socket for user
let socket = io();

let isCameraEnabled = false
const allCameraSources = []
let sourceId = undefined
let scanProgress;

const worker = Tesseract.createWorker({
    logger: m => {
        scanProgress = m?.progress;
        setLoadingProgress(scanProgress)
    }
});

// Initialize worker
(async () => {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    removeDisabledCameraButton();
})();

// Process the image
async function getTextFromImage(image) {
    if (!isCameraEnabled) return;

    const {data: {text}} = await worker.recognize(image);
    console.log(text);
    return text
}

function removeDisabledCameraButton() {
    enableCameraButton.disabled = false;
    setCameraDevices();
}

function showSwitchCameraButton() {
    switchCameraButton.classList.remove("hidden")
}

function hideSwitchCameraButton() {
    switchCameraButton.classList.add("hidden")
}

function setAvailableCameras() {
    if (allCameraSources.length > 1) {
        enableCameraButton.classList.add("including-switch-camera")
        switchCameraButton.classList.remove("hidden")
    } else {
        enableCameraButton.classList.remove("including-switch-camera")
        switchCameraButton.classList.add("hidden")
    }
}

function getRegistrationNumberFromText(text) {
    text = text ? text.trim().replace(/ /g, '') : text
    // RegEx for getting registration numbers starting with either "RVG", "RVH" or "EU/" and ending with a number
    const rx = /(RVG|RVH|EU\/)\d+(\d+|\/|\=)+/
    const arr = rx.exec(text);
    return arr ? arr[0] : undefined;
}

// Check if the user can use mediaDevices
if (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {

    enableCameraButton.addEventListener("click", callback => {
        enableCamera();
    });

    switchCameraButton.addEventListener("click", callback => {
        setNextCamera();
        enableCamera(sourceId);
    });

    disableCameraButton.addEventListener("click", callback => {
        showEnableCameraButton();
        hideCameraCanvas();

        setTimeout(function () {
            disableCamera();
        }, 1000);
    });

    searchMedicineInput.addEventListener("input", callback => {
        const searchValue = searchMedicineInput.value
        const registrationNumber = getRegistrationNumberFromText(searchValue)

        return (registrationNumber && registrationNumber.length > 0)
            ? fetchRegistrationNumber(registrationNumber)
            : undefined
    });
} else {
    console.log("getUserMedia() is not supported by your browser")
}

function showHideCameraButton() {
    disableCameraButton.classList.remove("hidden")
    enableCameraButton.classList.add("hidden")
}

function showEnableCameraButton() {
    enableCameraButton.classList.remove("hidden")
    disableCameraButton.classList.add("hidden")
}

function setCameraDevices() {
    allCameraSources.length = 0

    return navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {
            devices.forEach(function (device) {
                // returns all the user's video inputs
                if (device.kind === 'videoinput' &&
                    device.deviceId &&
                    device.deviceId.length) {
                    console.log("Device:", device.label)
                    allCameraSources.push(device.deviceId)
                }
            });
            setAvailableCameras();
            return true
        })
}

async function getUserMediaDevices(deviceId) {
    await setCameraDevices();
    sourceId = deviceId ? deviceId : allCameraSources[0]

    return {video: {mandatory: {sourceId: sourceId}}};
}

async function setNextCamera() {
    if (allCameraSources.length > 1 && sourceId) {
        const index = allCameraSources.indexOf(sourceId);

        if (index >= 0 && index < allCameraSources.length - 1) {
            sourceId = allCameraSources[index + 1]
        } else if (index >= 0 && index === allCameraSources.length - 1) {
            sourceId = allCameraSources[0]
        }
    }

}

let mediaStream;

async function enableCamera(sourceId = undefined) {
    const userMediaDevices = await getUserMediaDevices(sourceId)

    navigator.mediaDevices.getUserMedia(userMediaDevices).then((stream) => {
            console.log("Camera permission was granted")

            mediaStream = stream

            // Show the camera content as soon as metadata is laoded
            videoCanvas.addEventListener("loadedmetadata", callback => {
                const videoWidth = videoCanvas.videoWidth
                const videoHeight = videoCanvas.videoHeight
                const canvasWidth = videoCanvas.offsetWidth

                // Ratio table overview for calculating correct height taking the aspect ratio into account:
                //
                //              | Height       | Width       |
                //  ------------|--------------|-------------|
                //  VideoCanvas | canvasHeight | canvasWidth |
                //  VideoStream | videoHeight  | videoWidth  |
                //  ------------|--------------|-------------|

                const canvasHeight = (videoHeight * canvasWidth / videoWidth)

                console.log("canvasWidth:", canvasWidth, "canvasHeight:", canvasHeight)

                showCameraCanvas(parseInt(canvasHeight))
                showHideCameraButton();
            });

            videoCanvas.srcObject = stream
            videoCanvas.play();

            console.log("Taking snapshots")
            takeSnapshots(stream)
        }
    ).catch(function (error) {
        console.log("Camera permission was rejected or is not available", error)
    }).finally(function () {
        isCameraEnabled = true
        setCameraDevices()
    })
}

function setLoadingProgress(scanProgress) {
    // Percentage is 0 when progress is done (scanProgress = 1). This is to hide the loading bar when done
    const percentage = (scanProgress !== 1) ? scanProgress * 100 : 0

    loadingBar.style.width = `${percentage}%`
}

function disableCamera() {
    mediaStream.getTracks().forEach(function (track) {
        console.log("disable stream")

        track.stop();
        videoCanvas.srcObject = undefined
        isCameraEnabled = false
        setCameraDevices()
    });
}

function takeSnapshots() {
    // interval in millisecconds per screencapture
    const intervalPerScreenshot = 2000;

    (function captureScreen() {
        if (mediaStream && mediaStream.active) {

            new Promise(resolve => resolve(scanProgress))
                .then(scanProgress => {
                    // Wait for the worker to finish current batch
                    if (scanProgress !== 1) return;

                    return getBlobScreenshot()
                        .then(blob => {
                            const image = getImageFromBlob(blob)
                            return getTextFromImage(image)
                        })
                        .then(text => {
                            return getRegistrationNumberFromText(text)
                        })
                        .then(registrationNumber => {
                            return (registrationNumber && registrationNumber.length > 0)
                                ? fetchRegistrationNumber(registrationNumber)
                                : undefined
                        })
                })
                .catch(error => {
                    console.log("something went wrong", error)
                }).finally(() => {
                setTimeout(captureScreen, intervalPerScreenshot);
            })
        } else {
            console.log("Interval removed")
            // clearInterval(interval);
        }
    })();
}

function getImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;

    return image
}

/**
 * Takes a screenshot from the mediastream.
 * @returns {Blob} Blob from screenshot
 */
function getBlobScreenshot() {
    // Get a single frame from the mediastream
    const test = mediaStream.getVideoTracks()[0]

    // Make an imagecapture object in order to get the blob data
    const imageCapture = new ImageCapture(test);

    // Returns a promise that resolves with blob data from the captured image
    return imageCapture.takePhoto().then(blob => {
        if (!blob) throw "No blob file was created"

        const blobSizeMb = (Math.round((blob.size / 1000000) * 10) / 10)
        console.log("Blob size in MB:", blobSizeMb)

        // return blob
        return blob
    })
}

function uploadScreenshot(blob) {
    if (!blob) throw "blob is undefined"

    socket.emit('upload', blob, (response) => {
        if (response) {
            console.log("response true!")
        }
    });
}

function fetchRegistrationNumber(registrationNumber) {
    if (!registrationNumber) throw "blob is undefined"

    return socket.emit('get-medicine', registrationNumber, (response) => {
        if (response) {
            console.log("response true!")
        }
        return true;
    });
}

socket.on('search-result', function (result) {
    console.log("search result", result);

    if (!result) return;

    // Prepare the data used
    const registrationNumber = result.registrationNumber
    const name = result.name
    const activeIngredient = result.activeIngredient

    // Create html template for the medicine
    const html = ` 
<div class="medicine-item">
    <div class="medicine-registration-number-container">
        <img alt="Registration number" src="/img/icons/assignment-24px.svg">
        <p class="medicine-registration-number">${registrationNumber}</p>
    </div>
    
    <div class="medicine-name-container">
        <img alt="Medicine name" src="/img/icons/title-24px.svg">
        <p class="medicine-name">${name}</p>
    </div>
    
    <div class="medicine-active-ingredient-container">
        <img alt="Active ingrediënt" src="/img/icons/scatter_plot-24px.svg">
        <p class="medicine-active-ingredient">${activeIngredient}</p>
    </div>
</div>
`
    // Insert medicine item into the DOM
    scanResultContainer.innerHTML = html

    // Show the medicine
    scanResultContainer.classList.remove("hidden")

    // Set the registration number in the search input
    searchMedicineInput.value = registrationNumber
});


function showCameraCanvas(canvasHeight) {
    videoCanvas.style.maxHeight = `${canvasHeight}px`
    videoCanvas.style.minHeight = `${canvasHeight}px`

    videoCanvas.classList.remove("hideCameraCanvas")
    videoCanvas.classList.add("showCameraCanvas")
}

function hideCameraCanvas() {
    videoCanvas.style.maxHeight = 0
    videoCanvas.style.minHeight = 0

    videoCanvas.classList.remove("showCameraCanvas")
    videoCanvas.classList.add("hideCameraCanvas")
}

