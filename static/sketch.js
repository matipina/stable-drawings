/* to dos:
1. Fix margins
2. Change video size and add slider to change vScale/add mode to show only video
3. Implement drawing
    - ideas: 
        add a setting 'duration' that determines for how long the painting stays (control with slider)
        add a sensibility setting, so a pixel is painted only after a few seconds of keeping the index there
        add a 'move pixels' option, where you can paint/select a bunch of pixels and then move the selection around

4?. Add implementation of finder threads/bungee gum (p.drawLines([4, 8]);)
5. Take photo and then allow to paint over it
6. Add interactivity mode where pixels fall?/do something
7. Add textures (watercolor)
8. Add paint bucket
9. Add mode that doesn't have margins in between pixels
*/

let canvas;
var video;
var button;
var thresholdSlider1;
var thresholdSlider2;
var shapeButton;
let colorPicker;
var paint;

var vScale = 18;
var shape = 0;
var nShapes = 1;
var nModes = 2;
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
    let predictRoute;
    if (url) {
      p.print(`url: ${url}`);
      predictRoute = url + "/predict";
    } else {
      predictRoute = "https://b123-35-227-181-39.ngrok.io/predict";
    }
    let imageData = p.c.elt.toDataURL();
    // Send this prompt as data to unpack
    let prompt = p.promptInput.value();
    let postData = imageData + " " + prompt;
    p.httpPost(predictRoute, "text", postData, function (result) {
      p.print("success on the post request! This is the result:");
      p.print("parsing...");
      var resultData = JSON.parse(result);
      p.print(`result format: ${resultData["format"]}`);

      var fileTag = document.getElementById("filetag");
      fileTag.style.display = 'block';
      fileTag.src = "data:image/png;base64," + resultData["img_data"];

    });
  };

  p.setup = function () {
    p.frameRate(60);
    p.c = p.createCanvas(768, 540);
    let canvasContainer = document.getElementById("canvas");
    let uiContainer = document.getElementById("ui");
    let uiContainer2 = document.getElementById("ui-2");

    p.c.parent(canvasContainer);

    p.pixelDensity(1);

    video = p.createCapture(p.VIDEO);
    video.size(p.width / vScale, p.height / vScale);
    video.hide();

    p.promptInput = p.createInput("Describe your creation");
    p.promptInput.size(300);
    p.promptInput.parent(uiContainer);

    p.saveButton = p.createButton("Send").mousePressed(p.saveImage);
    p.saveButton.parent(uiContainer);

    p.handsButton = p.createButton("Show hand").mousePressed(showHands);
    p.handsButton.parent(uiContainer);

    colorPicker = p.createColorPicker("#ed225d");
    colorPicker.parent(uiContainer);

    p.drawButton = p.createButton("Draw").mousePressed(p.startDrawing);
    p.drawButton.parent(uiContainer);

    p.eraseButton = p.createButton("Eraser").mousePressed(p.startErasing);
    p.eraseButton.parent(uiContainer);

    p.cleanButton = p.createButton("Clean").mousePressed(p.erasePixels);
    p.cleanButton.parent(uiContainer);

    p.button = p.createButton("Mode", 0).mousePressed(changeMode);
    p.button.parent(uiContainer2);

    thresholdSlider1 = p.createSlider(0, 255, 127, 1);
    thresholdSlider1.parent(uiContainer2);

    thresholdSlider2 = p.createSlider(0, 255, 60, 1);
    thresholdSlider2.parent(uiContainer2);

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
            x: x_ * vScale + vScale,
            y: y_ * vScale + vScale / 2,
            color: 20,
          });
        }
      }
    };
  };

  p.draw = function () {
    p.background(20);
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

          var bright = (r + g + b) / 3;
          var threshold1 = thresholdSlider1.value();
          var threshold2 = thresholdSlider2.value();

          if (mode == 1) {
            p.fill(r, g, b);
            p.drawShape(
              shape,
              x * vScale + vScale,
              y * vScale + vScale / 2,
              vScale
            );
          } else if (mode == 2) {
            if (bright > threshold1) {
              p.fill(255);
            } else if (bright > threshold2) {
              p.fill(170);
            } else {
              p.fill(0);
            }
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
              console.log("CHANGE!");
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
              console.log("ERASE!");
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
