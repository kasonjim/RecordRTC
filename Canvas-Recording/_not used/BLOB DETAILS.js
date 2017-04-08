importScripts("' + workerPath + '");

var now = Date.now;

function print(text) {
  postMessage({
    "type" : "ffmpeg_run",
    "data" : text
  });
};

onmessage = function(event) {
  var message = event.data;
  if (message.type === "command") {
    var Module = {
      print: print,
      printErr: print,
      files: message.files || [],
      arguments: message.arguments || [],
      TOTAL_MEMORY: 268435456
    };
    postMessage({
      "type" : "start",
      "data" : Module.arguments.join(" ")
    });
    postMessage({
      "type" : "stdout",
      "data" : "Received command: " +Module.arguments.join(" ") +((Module.TOTAL_MEMORY) ? ".  Processing with " + Module.TOTAL_MEMORY + " bits." : "")
    });
    var time = now();
    var result = ffmpeg_run(Module);
    var totalTime = (now() - time) / 1000;
    postMessage({
      "type" : "stdout",
      "data" : "Finished processing (took " + totalTime + "s)"
    });
    postMessage({
      "type" : "done",
      "data" : result,
      "time" : totalTime
    });
  }
};

postMessage({
  "type" : "ready"
});