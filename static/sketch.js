let canvas;
var video;
var button;
var shapeButton;
let colorPicker;
var paint;

var vScale = 6;
var shape = 0;
var nShapes = 1;
var nModes = 1;
var mode = 1;
var handStatus = true;
var drawing = false;
var justChangedDraw = false;
var justChangedErase = false;
var erasing = false;

var history;

function changeMode() {
  if (mode < nModes) {
    mode++;
  } else {
    mode = 0;
  }
}

function changeShape() {
  if (shape < nShapes) {
    shape++;
  } else {
    shape = 0;
  }
}

function showHands() {
  handStatus = !handStatus;
}

let sketch = function (p) {
  p.drawShape = function (shape, x, y, size) {
    // Rectangle
    if (shape == 0) {
      p.noStroke();
      p.rectMode(p.CENTER);
      p.rect(x, y, size, size);
    }
    // Circle
    else if (shape == 1) {
      p.ellipseMode(p.CENTER);
      p.circle(x, y, size);
    }
  };

  p.erasePixels = function () {
    p.painted_pixels = [];
  };

  p.startDrawing = function () {
    drawing = !drawing;
    erasing = false;
  };

  p.startErasing = function () {
    erasing = !erasing;
    drawing = false;
  };

  p.saveImage = function () {
    p.resultDiv = document.getElementsByClassName("result")[0];
    p.spinnerDiv = p.createDiv("");
    p.spinnerDiv.addClass("loading");
    p.spinnerDiv.parent(p.resultDiv);

    const predictRoute = "/predict";

    let imageData = p.c.elt.toDataURL(); // Get base64 data URI
    let prompt = p.promptInput.value();

    // Create a JSON object payload
    let payload = {
      image: imageData,
      prompt: prompt,
    };

    // Send the payload as JSON
    p.httpPost(
      predictRoute,
      "json",
      payload,
      function (result) {
        // Sending as 'json'
        p.spinnerDiv.remove();
        p.print("success on the post request! This is the result:");
        p.print(`result format: ${result["format"]}`); // Access result as an object

        var fileTag = document.getElementById("filetag");
        fileTag.style.display = "block";
        fileTag.src = result["img_data"]; // Access img_data directly
      },
      function (error) {
        // Handle network errors or non-2xx responses from the server
        console.error("Error during httpPost:", error);
        if (p.spinnerDiv) {
          // Make sure spinnerDiv exists before removing
          p.spinnerDiv.remove();
        }
        alert(
          "Failed to generate image. Please check the console for details."
        );
      }
    );
  };

  p.setup = function () {
    p.frameRate(60);
    p.c = p.createCanvas(600, 440);
    let canvasContainer = document.getElementById("canvas");
    let uiContainer = document.getElementById("ui");
    let submitButtonContainer = document.getElementById("submit-button");
    let uiContainer2 = document.getElementById("ui-2");

    p.c.parent(canvasContainer);

    p.pixelDensity(1);

    video = p.createCapture(p.VIDEO);
    video.size(p.width / vScale, p.height / vScale);
    video.hide();

    p.promptInput = p.createInput("Describe your creation");
    p.promptInput.addClass("prompt");
    p.promptInput.parent(uiContainer);

    p.saveButton = p.createButton("Submit").mousePressed(p.saveImage);
    p.saveButton.parent(submitButtonContainer);
    p.saveButton.addClass("home2-send-button");

    p.handsButton = p.createButton("Show hands").mousePressed(showHands);
    p.handsButton.parent(uiContainer2);

    p.cleanButton = p.createButton("Erase").mousePressed(p.erasePixels);
    p.cleanButton.parent(uiContainer2);

    p.button = p.createButton("Camera").mousePressed(changeMode);
    p.button.parent(uiContainer2);

    colorPicker = p.createColorPicker("#F27B50");
    colorPicker.parent(uiContainer2);

    p.painted_pixels = [];
    p.history = [];

    p.drawFinger = function (indexArray, color) {
      p.noStroke();
      for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
        let j = indexArray[1] - 1;
        let x = detections.multiHandLandmarks[i][j].x * p.width;
        let y = detections.multiHandLandmarks[i][j].y * p.height;

        var x_ = Math.floor(x / vScale);
        var y_ = Math.floor(y / vScale);

        var selectedX = x_ * vScale + vScale;
        var selectedY = y_ * vScale + vScale / 2;

        if (drawing == true) {
          p.fill(color);
          // if pixel is not already painted, paint it
          let alreadyPainted = p.painted_pixels.filter(function (obj) {
            return obj.x === selectedX || obj.y === selectedY;
          });
          p.drawShape(shape, selectedX, selectedY, vScale);
          p.painted_pixels.push({ x: selectedX, y: selectedY, color: color });
          p.history.push({
            action: "paint",
            x: selectedX,
            y: selectedY,
            color: color,
          });
        } else if (erasing == true) {
          p.painted_pixels = p.painted_pixels.filter(function (obj) {
            return obj.x !== selectedX || obj.y !== selectedY;
          });
          p.history.push({
            action: "erase",
            x: selectedX,
            y: selectedY,
            color: 255,
          });
        }
      }
    };
  };

  p.draw = function () {
    p.background(255);
    paint = colorPicker.color();

    p.push();
    p.translate(p.width, 0);
    p.scale(-1, 1);

    video.loadPixels();
    p.loadPixels();

    if (mode > 0) {
      for (var y = 0; y < video.height; y++) {
        for (var x = 0; x < video.width; x++) {
          var index = (x + y * video.width) * 4;
          var r = video.pixels[index + 0];
          var g = video.pixels[index + 1];
          var b = video.pixels[index + 2];

          if (mode == 1) {
            p.fill(r, g, b);
            p.drawShape(
              shape,
              x * vScale + vScale,
              y * vScale + vScale / 2,
              vScale
            );
          }
        }
      }
    } else {
      // Blackboard
    }

    // Get every painted pixel and paint it
    for (var pix = 0; pix < p.painted_pixels.length; pix++) {
      p.fill(p.painted_pixels[pix].color);
      p.drawShape(
        shape,
        p.painted_pixels[pix].x,
        p.painted_pixels[pix].y,
        vScale
      );
    }

    if (detections != undefined) {
      if (detections.multiHandLandmarks != undefined) {
        if (handStatus == true) {
          p.drawLines([0, 5, 9, 13, 17, 0]); //palm
          p.drawLines([0, 1, 2, 3, 4]); //thumb
          p.drawLines([5, 6, 7, 8]); //index finger
          p.drawLines([9, 10, 11, 12]); //middle finger
          p.drawLines([13, 14, 15, 16]); //ring finger
          p.drawLines([17, 18, 19, 20]); //pinky

          p.drawLandmarks([0, 1], 0); //palm base
          p.drawLandmarks([1, 5], 60); //thumb
          p.drawLandmarks([5, 9], 120); //index finger

          p.drawLandmarks([9, 13], 180); //middle finger
          p.drawLandmarks([13, 17], 240); //ring finger
          p.drawLandmarks([17, 21], 300); //pinky
        }
        p.drawFinger([5, 9], paint);
        p.checkDistance(); //pinching distance
      }
    }

    p.drawHands = function () {
      for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
        for (let j = 0; j < detections.multiHandLandmarks[i].length; j++) {
          let x = detections.multiHandLandmarks[i][j].x * p.width;
          let y = detections.multiHandLandmarks[i][j].y * p.height;
          p.stroke(255);
          p.strokeWeight(10);
          p.point(x, y);
        }
      }
    };

    p.drawLandmarks = function (indexArray, hue) {
      p.noFill();
      p.strokeWeight(8);
      for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
        for (let j = indexArray[0]; j < indexArray[1]; j++) {
          let x = detections.multiHandLandmarks[i][j].x * p.width;
          let y = detections.multiHandLandmarks[i][j].y * p.height;
          p.stroke(hue, 40, 255);
          p.point(x, y);
        }
      }
    };

    p.drawLines = function (index) {
      p.stroke(0, 0, 255);
      p.strokeWeight(3);
      for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
        for (let j = 0; j < index.length - 1; j++) {
          let x = detections.multiHandLandmarks[i][index[j]].x * p.width;
          let y = detections.multiHandLandmarks[i][index[j]].y * p.height;
          let _x = detections.multiHandLandmarks[i][index[j + 1]].x * p.width;
          let _y = detections.multiHandLandmarks[i][index[j + 1]].y * p.height;
          p.line(x, y, _x, _y);
        }
      }
    };

    p.checkDistance = function () {
      const index = [4, 8];
      const middle = [4, 12];

      for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
        var palmBaseX = detections.multiHandLandmarks[i][0].x * p.width;
        var palmBaseY = detections.multiHandLandmarks[i][0].y * p.height;

        var palmTopX = detections.multiHandLandmarks[i][5].x * p.width;
        var palmTopY = detections.multiHandLandmarks[i][5].y * p.height;

        var palmSize = Math.hypot(palmBaseX - palmTopX, palmBaseY - palmTopY);
        var drawMinDistance = palmSize / 5;

        for (let j = 0; j < index.length - 1; j++) {
          let thumbX = detections.multiHandLandmarks[i][index[j]].x * p.width;
          let thumbY = detections.multiHandLandmarks[i][index[j]].y * p.height;
          let indexX =
            detections.multiHandLandmarks[i][index[j + 1]].x * p.width;
          let indexY =
            detections.multiHandLandmarks[i][index[j + 1]].y * p.height;
          let middleX =
            detections.multiHandLandmarks[i][middle[j + 1]].x * p.width;
          let middleY =
            detections.multiHandLandmarks[i][middle[j + 1]].y * p.height;

          var pinchDistance = Math.hypot(thumbX - indexX, thumbY - indexY);
          var middleDistance = Math.hypot(thumbX - middleX, thumbY - middleY);

          if (justChangedDraw == false) {
            if (pinchDistance < drawMinDistance) {
              p.startDrawing();
              justChangedDraw = true;
            }
          } else {
            if (pinchDistance > drawMinDistance) {
              justChangedDraw = false;
            }
          }

          if (justChangedErase == false) {
            if (middleDistance < drawMinDistance) {
              p.startErasing();
              justChangedErase = true;
            }
          } else {
            if (middleDistance > drawMinDistance) {
              justChangedErase = false;
            }
          }
        }
      }
    };
    p.pop();
  };
};

let myp5 = new p5(sketch);
