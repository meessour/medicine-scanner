const videoCanvas = document.getElementById('user-camera');

const enableCameraButton = document.getElementById("enable-camera-button");
const disableCameraButton = document.getElementById("disable-camera-button");

// Initiate socket for user
let socket = io();

let isCameraEnabled = false

// All types of media devices the app needs permission of
const userMediaDevices = {video: true};

const worker = Tesseract.createWorker({
    // logger: m => console.log(m)
});

// Initizalize worker
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

    disableCameraButton.addEventListener("click", callback => {
        showEnableCameraButton();
        hideCameraCanvas();

        setTimeout(function () {
            disableCamera();
        }, 1000);
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

function printCameraDevices() {
    navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {
            devices.forEach(function (device) {
                // returns all the user's video inputs
                if (device.kind === 'videoinput' &&
                    device.deviceId &&
                    device.deviceId.length) {
                    // console.log("Camera permission was granted")
                    console.log("Device:", device.label)
                }
            });
        })
}

// Show the camera content as soon as metadata is laoded
videoCanvas.addEventListener("loadedmetadata", callback => {
    showCameraCanvas()
});

let mediaStream;

function enableCamera() {
    navigator.mediaDevices.getUserMedia(userMediaDevices).then((stream) => {
            console.log("Camera permission was granted")

            mediaStream = stream
            videoCanvas.srcObject = stream
            videoCanvas.play();

            showHideCameraButton();

            takeSnapshots(stream)
        }
    ).catch(function (error) {
        console.log("Camera permission was rejected or is not available")
    }).finally(function () {
        isCameraEnabled = true
    })

    printCameraDevices()
}

function disableCamera() {
    mediaStream.getTracks().forEach(function (track) {
        console.log("disable stream")

        track.stop();
        videoCanvas.srcObject = undefined
        isCameraEnabled = false
    });
}

function takeSnapshots() {
    // interval in millisecconds per screencapture
    const intervalPerScreenshot = 2000;

    (function captureScreen() {
        console.log("go!")
        if (mediaStream && mediaStream.active) {
            getBlobScreenshot().then(blob => {
                const image = getImageFromBlob(blob)
                return getTextFromImage(image)
            })
                .then(text => {
                    return getRegistrationNumberFromText(text)
                }).then(registrationNumber => {
                if (registrationNumber && registrationNumber.length > 0) {
                    return fetchRegistrationNumber(registrationNumber)
                } else {
                    return;
                }
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

    // let interval = setInterval(function captureScreen() {
    //     console.log("go!")
    //     if (mediaStream && mediaStream.active) {
    //         getBlobScreenshot().then(blob => {
    //             uploadScreenshot(blob)
    //         }).catch(error => {
    //             console.log("something went wrong", error)
    //         }).finally(() => {
    //
    //         })
    //     } else {
    //         console.log("Interval removed")
    //         clearInterval(interval);
    //     }
    //
    // }, intervalPerScreenshot);
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

    const registrationNumber = result.registrationNumber
    const name = result.name
    const activeIngredient = result.activeIngredient

    const html = ` 
<div class="medicine-item">
    <div class="medicine-name-container">
        <img alt="Medicine name" src="/img/icons/title-24px.svg">
        <p class="medicine-name">${name}</p>
    </div>
    
    <div class="medicine-registration-number-container">
        <img alt="Registration number" src="/img/icons/assignment-24px.svg">
        <p class="medicine-registration-number">${registrationNumber}</p>
    </div>
    
    <div class="medicine-active-ingredient-container">
        <img alt="Active ingrediënt" src="/img/icons/scatter_plot-24px.svg">
        <p class="medicine-active-ingredient">${activeIngredient}</p>
    </div>
</div>
`
    document.getElementById("scan-result-container").innerHTML = html
});


function showCameraCanvas() {
    videoCanvas.classList.remove("hideCameraCanvas")
    videoCanvas.classList.add("showCameraCanvas")
}

function hideCameraCanvas() {
    videoCanvas.classList.remove("showCameraCanvas")
    videoCanvas.classList.add("hideCameraCanvas")
}

