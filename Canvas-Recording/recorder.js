/* References:
    https://www.webrtc-experiment.com/RecordRTC/
    http://recordrtc.org/RecordRTC.html
    https://github.com/muaz-khan/WebRTC-Experiment/tree/master/ffmpeg
    https://github.com/muaz-khan/Ffmpeg.js/blob/master/audio-plus-canvas-recording.html
*/
// Initial setup
window.onbeforeunload = function() {
  document.getElementById('start').disabled = false;
  document.getElementById('stop').disabled = true;
  document.getElementById('save').disabled = true;
};

webrtcUtils.enableLogs = false;

// Get main recording element
var elementToShare = document.getElementById('elementToShare');
// Create canvas
var canvas2d = document.createElement('canvas');
var context = canvas2d.getContext('2d');
canvas2d.width = elementToShare.clientWidth;
canvas2d.height = elementToShare.clientHeight;
canvas2d.style.top = 0;
canvas2d.style.left = 0;
canvas2d.style.zIndex = -1;
(document.body || document.documentElement).appendChild(canvas2d);

// State variables
var isRecordingStarted = false;
var isStoppedRecording = false;

// Defining the videoRecorder instance and data storage variable
var currentVideoBlob;
var currentAudioBlob;
var videoRecorder = new RecordRTC(canvas2d, {
  type: 'canvas'
});
var audioRecorder;

// Constantly checks state of recording/not-recording
var looper = function() {
  if (!isRecordingStarted) {
    return setTimeout(looper, 500);
  }
  html2canvas(elementToShare, {
    grabMouse: true,
    onrendered: function(canvas) {
      context.clearRect(0, 0, canvas2d.width, canvas2d.height);
      context.drawImage(canvas, 0, 0, canvas2d.width, canvas2d.height);

      if (isStoppedRecording) {
        return;
      }

      setTimeout(looper, 1);
    }
  });
};
looper();

// Button action for "START"
document.getElementById('start').onclick = function() {
  this.disabled = true;
  document.getElementById('save').disabled = true;

  // Set states
  isStoppedRecording = false;
  isRecordingStarted = true;
  // Reset data
  videoRecorder.clearRecordedData();
  videoRecorder.reset();

  playbackMediaSources(function() {
    // Start recording
    videoRecorder.startRecording();
    audioRecorder.startRecording();

    setTimeout(function() {
        document.getElementById('stop').disabled = false;
    }, 1000);
  });
};

// Button action "STOP"
document.getElementById('stop').onclick = function() {
  this.disabled = true;
  document.getElementById('start').disabled = false;

  isStoppedRecording = true;
  isRecordingStarted = false;

  audioRecorder.stopRecording(function() {
    currentAudioBlob = audioRecorder.getBlob();
    videoRecorder.stopRecording(function() {
      currentVideoBlob = videoRecorder.getBlob();
      document.getElementById('save').disabled = false;
      looper();
    });
  });
};

// Button action for "SAVE"
document.getElementById('save').onclick = function() {
  console.log('VIDEO BLOB', currentVideoBlob);
  console.log('AUDIO BLOB', currentAudioBlob);
  convertStreams();
};


/////////////////////////////////////////////////////////
///////// ORIGINAL WEBCAM/AUDIO RECORDING STUFF /////////
/////////////////////////////////////////////////////////
var videoElement = document.querySelector('.webcam-video');
var playbackMediaSources = function(callback) {
  var successVideoCallback = function(stream) {
    // Create audio source
    var createAudioStream = function() {
      var audio = document.createElement('audio');
      audio.muted = true;
      audio.volume = 0;
      audio.src = URL.createObjectURL(stream);

      if (audioRecorder !== undefined) {
        audioRecorder.clearRecordedData();
        audioRecorder.reset();
      }
      audioRecorder = new RecordRTC(stream, {
        type: 'audio',
        recorderType: StereoAudioRecorder
      });
    };

    console.log('STREAM: ', stream);
    console.log(stream.getAudioTracks()[0]);
    console.log(stream.getVideoTracks()[0]);
    videoElement.onloadedmetadata = function() {
      createAudioStream();
      callback();
    };
    videoElement.src = URL.createObjectURL(stream);
    videoElement.play();
  };

  var errorCallback = function(error) {
    console.error('get-user-media error', error);
    alert('Make sure your audio/video devices are not being used by other processes!');
    isStoppedRecording = true;
    isRecordingStarted = false;
    window.onbeforeunload();
    looper();
    // This overrides stopping the recording if a media source is in use
    // callback();
  };

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(successVideoCallback)
    .catch(errorCallback);
};

/////////////////////////////////////////////////////////////////
////////// HEAVY GUN STUFF WITH REGARDS TO MP4 MUXING  //////////
/////////////////////////////////////////////////////////////////
var workerPath = 'https://archive.org/download/ffmpeg_asm/ffmpeg_asm.js';
if (document.domain === 'localhost' || document.domain === '127.0.0.1') {
  workerPath = location.href.replace(location.href.split('/').pop(), '') + 'lib/ffmpeg_asm.js';
}

var processInWebWorker = function() {
  var blob = URL.createObjectURL(new Blob(['importScripts("' + workerPath + '");var now = Date.now;function print(text) {postMessage({"type" : "ffmpeg_run","data" : text});};onmessage = function(event) {var message = event.data;if (message.type === "command") {var Module = {print: print,printErr: print,files: message.files || [],arguments: message.arguments || [],TOTAL_MEMORY: 268435456};postMessage({"type" : "start","data" : Module.arguments.join(" ")});postMessage({"type" : "stdout","data" : "Received command: " +Module.arguments.join(" ") +((Module.TOTAL_MEMORY) ? ".  Processing with " + Module.TOTAL_MEMORY + " bits." : "")});var time = now();var result = ffmpeg_run(Module);var totalTime = (now() - time) / 1000;postMessage({"type" : "stdout","data" : "Finished processing (took " + totalTime + "s)"});postMessage({"type" : "done","data" : result,"time" : totalTime});}};postMessage({"type" : "ready"});'], {
    type: 'application/javascript'
  }));
  var worker = new Worker(blob);
  URL.revokeObjectURL(blob);
  return worker;
};

var convertStreams = function() {
  var date = new Date();
  var formatted = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} (${date.getTime()})`;
  invokeSaveAsDialog(currentVideoBlob, 'DC ' + formatted + '.webm');
  invokeSaveAsDialog(currentAudioBlob, 'DC ' + formatted + '.wav');

  var worker;
  var vab;
  var aab;
  var buffersReady = false;
  var workerReady = false;
  var posted = false;

  var fileReader1 = new FileReader();
  fileReader1.onload = function() {
    vab = this.result;
    if (aab) {
      buffersReady = true;
    }
    if (buffersReady && workerReady && !posted) {
      postMessage();
    }
  };
  var fileReader2 = new FileReader();
  fileReader2.onload = function() {
    aab = this.result;
    if (vab) {
      buffersReady = true;
    }
    if (buffersReady && workerReady && !posted) {
      postMessage();
    }
  };

  fileReader1.readAsArrayBuffer(currentVideoBlob);
  fileReader2.readAsArrayBuffer(currentAudioBlob);

  if (!worker) {
    worker = processInWebWorker();
  }

  worker.onmessage = function(event) {
    var message = event.data;
    if (message.type === 'ready') {
      console.log('ready', 'ffmpeg-asm.js file has been loaded.');
      workerReady = true;
      if (buffersReady) {
        postMessage();
      }
    } else if (message.type === 'start') {
      console.log('start:', 'ffmpeg-asm.js file received ffmpeg command.');
    } else if (message.type === 'stdout') {
      console.log('stdout:', message.data);
    } else if (message.type === 'ffmpeg_run') {
      console.log('ffmpeg_run:', message.data);
    } else if (message.type === 'done') {
      console.log('done:', JSON.stringify(message));

      var result = message.data[0];
      console.log('result:', JSON.stringify(result));

      var blob = new Blob([result.data], {
        type: 'video/mp4'
      });
      console.log('blob:', JSON.stringify(blob));

      invokeSaveAsDialog(blob, 'DC ' + formatted + '.mp4');
    }
  };

  var postMessage = function() {
    posted = true;
    /*
        [
            '-i', 'video.webm',
            '-i', 'audio.wav',
            '-s', '1280x720',
            '-c:v', 'mpeg4',
            '-c:a', 'aac',
            '-b:v', '1450k',
            '-b:a', '96k',
            '-bf', '2',
            '-g', '90',
            '-sc_threshold', '0',
            '-ar', '32000',
            '-strict', 'experimental', 'output.mp4'
        ]
    */

    worker.postMessage({
      type: 'command',
      arguments: [
        '-i', 'video.webm',
        '-i', 'audio.wav',
        '-c:v', 'mpeg4',
        '-c:a', 'vorbis', // or aac / vorbis
        '-b:v', '1450k',  // or 1450k / 6400k
        '-b:a', '4800k',  // or 96k / 4800k
        '-strict', 'experimental', 'output.mp4'
      ],
      files: [
        {
          data: new Uint8Array(vab),
          name: 'video.webm'
        },
        {
          data: new Uint8Array(aab),
          name: "audio.wav"
        }
      ]
    });
  };
};