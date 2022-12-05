
errorOutput = document.getElementById('errorMessage');
const OPENCV_URL = 'opencv.js';
var vid
var stream_
var onCameraStartedCallback

function loadOpenCv(onloadCallback) {
    let script = document.createElement('script');
    script.setAttribute('async', '');
    script.setAttribute('type', 'text/javascript');
    script.addEventListener('load', async () => {
        if (cv.getBuildInformation) {
            console.log(cv.getBuildInformation());
            onloadCallback();
        }
        else {
            // WASM
            if (cv instanceof Promise) {
                cv = await cv;
                console.log(cv.getBuildInformation());
                onloadCallback();
            } else {
                cv['onRuntimeInitialized'] = () => {
                    console.log(cv.getBuildInformation());
                    onloadCallback();
                }
            }
        }
    });
    script.addEventListener('error', () => {
        self.printError('Failed to load ' + OPENCV_URL);
    });
    script.src = OPENCV_URL;
    let node = document.getElementsByTagName('script')[0];
    node.parentNode.insertBefore(script, node);
};


function createFileFromUrl(path, url, callback) {
    let request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function (ev) {
        if (request.readyState === 4) {
            if (request.status === 200) {
                let data = new Uint8Array(request.response);
                cv.FS_createDataFile('/', path, data, true, false, false);
                callback();
            } else {
                self.printError('Failed to load ' + url + ' status: ' + request.status);
            }
        }
    };
    request.send();
};

function printError(err) {
    if (typeof err === 'undefined') {
        err = '';
    } else if (typeof err === 'number') {
        if (!isNaN(err)) {
            if (typeof cv !== 'undefined') {
                err = 'Exception: ' + cv.exceptionFromPtr(err).msg;
            }
        }
    } else if (typeof err === 'string') {
        let ptr = Number(err.split(' ')[0]);
        if (!isNaN(ptr)) {
            if (typeof cv !== 'undefined') {
                err = 'Exception: ' + cv.exceptionFromPtr(ptr).msg;
            }
        }
    } else if (err instanceof Error) {
        err = err.stack.replace(/\n/g, '<br>');
    }
    errorOutput.innerHTML = err;
};
function clearError() {
    errorOutput.innerHTML = '';
};

function onVideoCanPlay() {
    if (onCameraStartedCallback) {
        onCameraStartedCallback(stream_, vid);
    }
};

function startCamera(resolution, callback, videoId) {
    const constraints = {
        'qvga': { width: { exact: 320 }, height: { exact: 240 } },
        'vga': { width: { exact: 640 }, height: { exact: 480 } }
    };
    let video = document.getElementById(videoId);
    if (!video) {
        video = document.createElement('video');
    }

    let videoConstraint = constraints[resolution];
    if (!videoConstraint) {
        videoConstraint = true;
    }

    navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false })
        .then(function (stream) {
            video.srcObject = stream;
            video.play();
            vid = video;
            stream_ = stream;
            onCameraStartedCallback = callback;
            video.addEventListener('canplay', onVideoCanPlay, false);
        })
        .catch(function (err) {
            printError('Camera Error: ' + err.name + ' ' + err.message);
        });
};
function stopCamera() {
    if (vid) {
        vid.pause();
        vid.srcObject = null;
        vid.removeEventListener('canplay', onVideoCanPlay);
    }
    if (stream_) {
        stream_.getVideoTracks()[0].stop();
    }
};

const upload = (name, file) => {
    fetch('./api/upload/dataset', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            file: file
        })
    }).then(
        response => response.json()
    ).then(
        success => console.log(success)
    ).catch(
        error => console.log(error)
    );
};


function executeCode() {
    let video = document.getElementById('videoInput');
    let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    let gray = new cv.Mat();
    let cap = new cv.VideoCapture(video);
    let faces = new cv.RectVector();
    let classifier = new cv.CascadeClassifier();

    // load pre-trained classifiers
    classifier.load('haarcascade_frontalface_default.xml');

    const FPS = 30;
    function processVideo() {
        try {
            if (!streaming) {
                // clean and stop.
                src.delete();
                dst.delete();
                gray.delete();
                faces.delete();
                classifier.delete();
                return;
            }
            let begin = Date.now();
            // start processing.
            cap.read(src);
            src.copyTo(dst);
            cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
            // detect faces.
            classifier.detectMultiScale(gray, faces, 1.1, 3, 0);
            // draw faces.
            for (let i = 0; i < faces.size(); ++i) {
                let face = faces.get(i);
                // console.log(face)
                // let point1 = new cv.Point(face.x, face.y);
                // let point2 = new cv.Point(face.x + face.width, face.y + face.height);
                // cv.rectangle(dst, point1, point2, [255, 0, 0, 255]);

                let rect = new cv.Rect(face.x, face.y, face.width, face.height);
                gray = gray.roi(rect)
                cv.imshow('canvasOutput', gray);



                let input = document.getElementById('canvasOutput');
                let name = document.getElementById('name');
                name = name.value
                let base64 = input.toDataURL()
                upload(name, base64)





            }
            // cv.imshow('canvasOutput1', gray);
            // cv.imshow('canvasOutput', dst);

            // schedule the next one.
            let delay = 1000 / FPS - (Date.now() - begin);
            setTimeout(processVideo, delay);
        } catch (err) {
            printError(err);
        }
    };

    // schedule the first one.
    setTimeout(processVideo, 0);
}

// _______________________________________________________________________________

let streaming = false;
let videoInput = document.getElementById('videoInput');
let startAndStop = document.getElementById('startAndStop');
let canvasOutput = document.getElementById('canvasOutput');
let canvasContext = canvasOutput.getContext('2d');


startAndStop.addEventListener('click', () => {
    if (!streaming) {
        clearError();
        startCamera('qvga', onVideoStarted, 'videoInput');
    } else {
        stopCamera();
        onVideoStopped();
    }
});


function onVideoStarted() {
    streaming = true;
    startAndStop.innerText = 'Stop';
    videoInput.width = videoInput.videoWidth;
    videoInput.height = videoInput.videoHeight;
    executeCode();

}

function onVideoStopped() {
    streaming = false;
    canvasContext.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
    startAndStop.innerText = 'Start';
}

loadOpenCv(() => {
    let faceCascadeFile = 'haarcascade_frontalface_default.xml';
    createFileFromUrl(faceCascadeFile, faceCascadeFile, () => {
        startAndStop.removeAttribute('disabled');
    });
});