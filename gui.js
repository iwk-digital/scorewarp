/**
 * @file gui.js
 * @description
 * This file contains the main functions for the GUI of the warp tool.
 *
 */

// Default variables
const version = '0.1.0';
const dateString = '23 April 2025';
const repoUrl = 'https://github.com/iwk-digital/scorewarp';
const svgNS = 'http://www.w3.org/2000/svg';

let meiFileName = '';
let mapsFileName = '';

// Verovio toolkit variables
let tk; // toolkit instance
let tkVersion = ''; // toolkit version string
let tkOptions = {
  svgHtml5: true,
  scale: 30,
  breaks: 'none',
  header: 'none',
  footer: 'none',
};

let svgString; // raw SVG text string of engraved MEI file
let scoreWarper; // score warper object
let warped = false; // whether or not the score has been warped
let pieceSel; // selection element for pieces
let perfSel; // selection element for performances
let showRedLines = true; // whether or not to show red lines in the score

/**
 * This function is called when the DOM is fully loaded.
 * It initializes the Verovio toolkit and loads the MEI file.
 * It also sets up the event listeners for the keyboard shortcuts.
 *
 * @param {Event} event
 * @returns {void}
 * @description
 */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fileInput').addEventListener('change', handleLocalFiles, false);
  // drag and drop
  const dropArea = document.getElementById('dropArea');
  dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.add('dragover');
  });
  dropArea.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.remove('dragover');
  });
  dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.remove('dragover');
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleLocalFiles({ target: { files } });
    }
  });

  clearInputs();

  // read default files from demo.js
  if (defaultMeiFileName) {
    meiFileName = defaultMeiFileName;
    console.log('defaultMeiFileName: ', defaultMeiFileName);
  }
  if (defaultMapsFileName) {
    mapsFileName = defaultMapsFileName;
    console.log('defaultMapsFileName: ', defaultMapsFileName);
  }

  // update dropdown menues
  if (defaultPiece) {
    document.getElementById('piece').value = defaultPiece;
    console.log('defaultPiece: ', defaultPiece);
    let perfSel = document.getElementById('performance');
    perfSel.length = 1;
    for (let y in demoFiles[defaultPiece].performances) {
      perfSel.options[perfSel.options.length] = new Option(y, y);
    }
  }

  // add keyboardListeners and update notation panel
  document.addEventListener('keyup', keyboardListener);

  // show version and date
  document.getElementById('date').innerHTML =
    '<a href="' + repoUrl + '" target="_blank">ScoreWarp ' + version + ', ' + dateString + '</a>';

  document.getElementById('notation').innerHTML = '<b>Loading Verovio...</b>';
  Module.onRuntimeInitialized = async (_) => {
    tk = new verovio.toolkit();
    tk.setOptions(tkOptions);
    tkVersion = tk.getVersion();
    console.log('Verovio ' + tkVersion + ' loaded.');
    document.querySelector('#copyright').innerHTML += `<span>Gratefully using
        <a href="https://www.verovio.org/">Verovio ${tkVersion}</a>.</span>`;
    document.getElementById('notation').innerHTML = `<b>Verovio ${tkVersion} loaded.</b>`;

    loadMEI();
  };
}); // DOMCOntentLoaded() listener

/**
 * Load MEI string from global variable meiFileName and render it to SVG using Verovio.
 * Parse the SVG text to an SVG object and call loadMEIfinalizing().
 */
function loadMEI(reload = true) {
  if (!meiFileName) {
    return;
  }
  warped = false;
  clearAllLines();
  document.getElementById('performanceTime').innerHTML = '';
  document.getElementById('notation').innerHTML = '<b>Loading ' + meiFileName + '...</b>';
  console.log('Loading ' + meiFileName + '...');
  if (reload) {
    fetch(meiFileName)
      .then((response) => response.text())
      .then((meiText) => {
        console.log('MEI loaded.'); // , meiText);
        tk.setOptions(tkOptions);
        // save to global variable svgString
        svgString = tk.renderData(meiText, {});
        console.log('SVG rendered.');

        // when SVG is loaded, finalize loading
        updateGUI();
      });
  } else {
    updateGUI();
  }
} // loadMEI()

/**
 * Load MEI from local file and render it to SVG using Verovio.
 */
async function loadMEIfromLocalFile(file) {
  if (!file) {
    return;
  }
  warped = false;
  clearAllLines();
  document.getElementById('performanceTime').innerHTML = '';
  document.getElementById('notation').innerHTML = '<b>Loading ' + file.name + '...</b>';
  console.log('Loading ' + file.name + '...');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const meiText = event.target.result;
      console.log('MEI loaded.'); // , meiText);
      tk.setOptions(tkOptions);
      // save to global variable svgString
      svgString = tk.renderData(meiText, {});
      console.log('SVG rendered.');

      // when SVG is loaded, finalize loading
      updateGUI();
      resolve();
    };
    reader.onerror = function (event) {
      console.error('Error reading file: ', event);
      reject(event);
    };
    reader.readAsText(file);
  });
} // loadMEIfromLocalFile()

/**
 * Load maps file locally
 */
async function loadLocalMapsFile(mapsFile) {
  return new Promise((resolve, reject) => {
    if (mapsFile) {
      mapsFileName = mapsFile.name;
      console.info('loadLocalMapsFile() ' + mapsFileName);
      const reader = new FileReader();
      reader.onload = function (event) {
        const jsonText = event.target.result;
        console.log('Maps loaded.'); // , meiText);
        let msg = scoreWarper.setMaps(JSON.parse(jsonText));
        console.log('Maps set for ' + mapsFileName + ', msg:' + msg);
        if (msg === 'ok') {
          loadPerformanceTiming(scoreWarper.maps);
        }
        resolve(msg);
      };
      reader.onerror = function (event) {
        console.error('Error reading file: ', event);
        reject(event);
      };
      reader.readAsText(mapsFile);
    }
  });
} // loadLocalMapsFile()

/**
 * Finalize loading of MEI file.
 * Update the GUI with the SVG object and the notation panel.
 * Calculate the coordinates of the score elements.
 * Update the GUI with the performance timing.
 * List all warpable elements of the score.
 */
function updateGUI() {
  if (!svgString) {
    return;
  }

  // parse SVG text to SVG object
  let svgDocument = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (svgDocument.childNodes && svgDocument.childNodes.length > 0) {
    scoreWarper = new ScoreWarper(svgDocument.childNodes[0]);
    // console.log("SVG inside ScoreWarper:", scoreWarper.svgObj);
  }

  // update notation panel
  let notationDiv = document.getElementById('notation');
  notationDiv.innerHTML = '<p><b>Score:</b> ' + pieceSel.value + '</p>';
  notationDiv.appendChild(scoreWarper.svgObj);
  // console.log('NotationDiv: ', notationDiv);

  scoreWarper.shiftPageMargin();

  if (pieceSel && pieceSel.value && perfSel && perfSel.value && demoFiles[pieceSel.value].performances[perfSel.value]) {
    updateMapsFile(demoFiles[pieceSel.value].performances[perfSel.value]);
  }
} // updateGUI()

/**
 * Keyboard listener for shortcuts:
 * - 'W' warps the score to match the performed events
 * - 'A' warps the score to match the performed notes
 * - 'C' reloads the MEI file
 * - 'D' downloads score SVG file
 * - 'F' downloads score and performance SVG file (only keyboard shortcut, no button)
 */
function keyboardListener(e) {
  if (e.code == 'KeyW') warp(); // warp score to match performed events
  if (e.code == 'KeyA') warpIndividualNotes(); // warp score to match performed notes
  if (e.code == 'KeyC') loadMEI(false); // reload MEI file
  // download score SVG file
  if (e.code == 'KeyD' && scoreWarper.svgObj) {
    downloadSVG();
  }
  // // download score and performance SVG files
  // if (e.code == 'KeyF' && scoreWarper.svgObj) {
  //   downloadSVG(true);
  // }
} // keyboardListener()

/**
 * Warps the score to match the performed events.
 */
function warp() {
  if (!scoreWarper.noteSVGXs) {
    return;
  }
  if (!warped) {
    // clear download link element
    document.getElementById('downloadLink').innerHTML = '';

    scoreWarper.warp();
    warped = true;

    drawConnectorLines('chords');
    drawTimeAxis(scoreWarper.svgObj, true, scoreWarper.svgHeight - 20, 'cornflowerblue');
    // downloadSVG(new XMLSerializer().serializeToString(svgObj));
  }
} // warp()

/**
 * Warps the notes inside chords to match the performed notes.
 */
function warpIndividualNotes() {
  if (warped) {
    scoreWarper.warpIndividualNotes();
    drawConnectorLines('notes');
  } else {
    console.info('Please warp the score first.');
  }
} // warpIndividualNotes()

// basic drawing coordinates
let y0basis = 110; // y of time axis
let y1 = 70; // y of straigth lines
let y2 = 0; // y of orange connector lines
let yMx = 140; // mx y of performance panel

/**
 * Draw orange lines, to connect to 'score' or to performed 'notes'
 * @param {string} target - 'score' or 'notes'
 */
function drawConnectorLines(target = 'score') {
  // 'chords', 'notes'
  let pt = document.querySelector('.performanceTime');
  if (pt) {
    pt.querySelectorAll('line[stroke="orange"]') // remove lines
      .forEach((item) => item.remove());
  }
  if (scoreWarper.maps) {
    let j = 0;
    // plot straight lines
    scoreWarper.maps.forEach((item, i) => {
      if (i >= scoreWarper.firstOnsetIdx(scoreWarper.maps) && i <= scoreWarper.lastOnsetIdx(scoreWarper.maps)) {
        screenX = scoreWarper.time2screen(item.obs_mean_onset);

        if (target === 'score') {
          addLine(pt, screenX, scoreWarper.noteXs[j++], y1, y2, 'orange');
        } else {
          addLine(pt, screenX, screenX, y1, y2, 'orange');
        }
      }
    });
  }
} // drawConnectorLines()

/**
 * Draws red lines inside SVG (for debugging) into a separate line container group
 */
function drawLinesInScore() {
  let definitionScaleElement = scoreWarper.svgObj.querySelector('.definition-scale');
  if (definitionScaleElement) {
    let transforms = definitionScaleElement.querySelector('.page-margin')?.transform;
    //definitionScaleElement.querySelector('.page-margin')?.getAttribute('transform');
    let lineContainer = definitionScaleElement.querySelector('.lineContainer');
    if (!lineContainer) {
      lineContainer = document.createElementNS(svgNS, 'g');
      lineContainer.classList.add('lineContainer');

      let matrix = transforms.baseVal.getItem(0).matrix;
      let newTranslate = scoreWarper._svgObj.createSVGTransform();
      newTranslate.setTranslate(matrix.e + scoreWarper.noteheadWidth / 2, 0);
      lineContainer.transform.baseVal.appendItem(newTranslate);

      definitionScaleElement.appendChild(lineContainer);
    }
    if (!warped) {
      scoreWarper.noteSVGXs.forEach((item) => {
        addLine(lineContainer, item, item, scoreWarper.svgViewBox[3], 0, 'red', 20);
      });
    } else {
      // this is for warped notes, probably never called
      scoreWarper.onsetSVGXs.forEach((item) => {
        addLine(lineContainer, item, item, scoreWarper.svgViewBox[3], 0, 'red', 20);
      });
    }
  }
} // drawLinesInScore()

/**
 * Draws warp function in notation panel
 * @param {Element} node - the parent node to which the warp function will be added
 * @param {Array} warpFunc - the warping function
 */
function drawWarpFunction(node, warpFunc) {
  const g = document.createElementNS(svgNS, 'g'); // warp function in notation
  g.setAttribute('class', 'warpFunction');
  node.appendChild(g);
  let mn = Number.MAX_VALUE;
  let mx = 0;
  warpFunc.forEach((item) => {
    if (item < mn) mn = item;
    if (item > mx) mx = item;
  });
  console.info('drawWarpFunction: mn/mx: ' + mn + '/' + mx + ', svgH: ' + scoreWarper.svgViewBox[3]);
  let scale = scoreWarper.svgViewBox[3] / (mx - mn);
  let translate = 1000; // svgViewBox[3] / 2;
  console.info('drawWarpFunction: scale/trnsl: ' + scale + '/' + translate);
  warpFunc.forEach((item, i) => {
    addCircle(g, i, item * scale + translate, 3, 'red');
  });
} // drawWarpFunction()

/**
 * Clears all lines from the performanceTime panel
 */
function clearAllLines() {
  let pt = document.querySelector('.performanceTime');
  if (pt) {
    pt.querySelectorAll('line').forEach((item) => item.remove());
  }
  let pm = document.querySelector('.page-margin');
  console.info('clearAllLines pm: ', pm);
  if (pm) {
    pm.querySelectorAll('line').forEach((item) => item.remove());
  }
  clearLinesInScore();
} // clearAllLines()

/**
 * Clears all lines from the score
 */
function clearLinesInScore() {
  let lineContainer = document.querySelector('.lineContainer');
  if (lineContainer) {
    lineContainer.querySelectorAll('line').forEach((item) => item.remove());
  }
} // clearLinesInScore()

/**
 *
 * @param {Object} maps
 */
function loadPerformanceTiming(maps) {
  scoreWarper.maps = maps;

  // performanceTime Panel to demonstrate
  let ptObj = createScoreTimeSVG(scoreWarper.svgWidth, yMx);
  ptObj.setAttribute('class', 'performanceTime');

  // addLine(ptObj, scoreWarper.fstX, scoreWarper.fstX, y0basis, yMx, 'blue'); // first line
  // addLine(ptObj, scoreWarper.lstX, scoreWarper.lstX, y0basis, yMx, 'blue'); // last line

  // plot onset info to ptObj
  scoreWarper.maps.forEach((item, i) => {
    if (i >= scoreWarper.firstOnsetIdx(scoreWarper.maps) && i <= scoreWarper.lastOnsetIdx(scoreWarper.maps)) {
      let screenX = scoreWarper.time2screen(item.obs_mean_onset);
      addLine(ptObj, screenX, screenX, y0basis, y1, 'purple');
      // save onset time data in SVG coordinates
    }
  });

  // scoreTimeDiv.appendChild(createScoreTimeSVG(bb.width, 200));
  const serializer = new XMLSerializer();
  // console.info('stSVG: ' + stSVG);
  let scoreTimeDiv = document.getElementById('performanceTime');
  scoreTimeDiv.innerHTML = serializer.serializeToString(ptObj);
  if (pieceSel && pieceSel.value && perfSel && perfSel.value) {
    scoreTimeDiv.innerHTML += '<p><b>Performance: </b>' + perfSel.value + '</p>';
  }

  drawConnectorLines('score');
  drawTimeAxis(document.querySelector('.performanceTime'));

  // for DEBUGGING: plot warping function...
  if (showRedLines) {
    // let pageMarginElement = document.querySelector('.page-margin');
    // drawWarpFunction(pageMarginElement, scoreWarper.computeWarpingArray());

    // downloadSVG(serializer.serializeToString(scoreWarper.svgObj));
    drawLinesInScore();
  }
} // loadPerformanceTiming()

// Create SVG for score time plotting
function createScoreTimeSVG(width, height) {
  const stSVG = document.createElementNS(svgNS, 'svg');
  stSVG.setAttribute('width', width);
  stSVG.setAttribute('height', height);
  return stSVG;
} // createScoreTimeSVG()

/**
 * Draws time axis to a given node
 * @param {Element} node - the parent node to which the time axis will be added
 * @param {boolean} toScreen - if true, the time axis will be drawn in screen coordinates
 * @param {number} y - the y-coordinate of the time axis
 * @param {string} color - the color of the time axis
 */
function drawTimeAxis(node, toScreen = true, y = y0basis, color = 'black') {
  const g = document.createElementNS(svgNS, 'g'); // time axis in notation
  g.setAttribute('class', 'timeAxis');
  node.appendChild(g);
  let tickIncr = 1; // seconds
  let numbIncr = 10; // seconds
  let lastTick = Math.ceil(scoreWarper.tmx / numbIncr) * numbIncr;
  let s, s2;
  // draw tick lines and horizontal axis and label
  for (let t = 0; t <= lastTick; t += tickIncr) {
    toScreen ? (s = scoreWarper.time2screen(t)) : (s = scoreWarper.time2svg(t));
    if (Math.round(t / numbIncr) == t / numbIncr) {
      addLine(g, s, s, y, y + 4, color, 1); // longer tick line
    } else {
      addLine(g, s, s, y, y + 2, color, 1); // short tick line
    }
    if (t == 0) {
      // draw horizontal axis and axis label
      toScreen ? (s2 = scoreWarper.time2screen(lastTick)) : scoreWarper.time2svg(lastTick);
      addLine(g, s, s2, y, y, color, 1);
      addText(g, 'Time (s)', 1, y - 4, 'left', color);
    }
  }
  // draw tick label numbers
  for (let t = 0; t <= lastTick; t += numbIncr) {
    toScreen ? (s = scoreWarper.time2screen(t)) : (s = scoreWarper.time2svg(t));
    addText(g, t, s, y + 13, 'middle', color);
  }
} // drawTimeAxis()

function updateMeiFile(fileName = '') {
  meiFileName = fileName;
  console.info('updateMEIfile ' + meiFileName);
  clearAllLines();
  loadMEI();
} // updateMeiFile()

function updateMapsFile(fileName = '') {
  mapsFileName = fileName;
  console.info('updateMapsFile ' + mapsFileName);
  clearAllLines();
  if (warped) {
    loadMEI(false);
  }
  fetch(mapsFileName)
    .then((response) => response.json())
    .then((json) => {
      // set maps object in scoreWarper
      loadPerformanceTiming(json);
    });
  console.info('updateMapsFile maps: ', scoreWarper.maps);
} // updateMapsFile()

window.onload = function () {
  pieceSel = document.getElementById('piece');
  perfSel = document.getElementById('performance');
  let pieceName;
  let pieceFile;
  for (var x in demoFiles) {
    pieceSel.options[pieceSel.options.length] = new Option(x, x);
  }
  pieceSel.onchange = function () {
    perfSel.length = 1; // to clear existing menu entries
    pieceName = this.value;
    pieceFile = demoFiles[this.value].meiFile;
    console.info('this.value: ' + this.value + ', pieceName: ' + pieceName);
    for (var y in demoFiles[this.value].performances) {
      perfSel.options[perfSel.options.length] = new Option(y, y);
    }
    clearInputs();
    updateMeiFile(pieceFile);
  };
  perfSel.onchange = function () {
    let performanceName = this.value;
    let mapsFile = demoFiles[pieceSel.value].performances[this.value];
    console.info('Performance: ' + performanceName + ', mapsFile:' + mapsFile);
    clearInputs();
    updateMapsFile(mapsFile);
  };
}; // window.onload()

// creates SVG blob and downloads it
async function downloadSVG(svgName = '') {
  return new Promise((resolve) => {
    if (scoreWarper.svgObj) {
      let svg = new XMLSerializer().serializeToString(scoreWarper.svgObj);
      let type = 'image/svg+xml';
      let a = document.getElementById('downloadLink');
      var file = new Blob([svg], {
        type: type,
      });
      a.href = URL.createObjectURL(file);
      if (!svgName && !warped && pieceSel && pieceSel.value) {
        svgName = pieceSel.value;
        // a.innerHTML = "Download SVG";
      }
      if (!svgName && warped && pieceSel && pieceSel.value && perfSel && perfSel.value) {
        svgName = pieceSel.value + '_' + perfSel.value;
        // a.innerHTML = "Download Warped SVG";
      }
      a.download = svgName;
      a.click();
    }
  });
  // let performanceSVG = document.getElementById('performanceTime').querySelector('svg');
  // if (savePerformance && performanceSVG) {
  //   let svg = new XMLSerializer().serializeToString(performanceSVG);
  //   let type = 'image/svg+xml';
  //   let a = document.getElementById('downloadLink');
  //   var file = new Blob([svg], {
  //     type: type,
  //   });
  //   a.href = URL.createObjectURL(file);
  //   a.download = svgName + '_performance';
  //   a.click();
  // }
} // downloadSVG()

/**
 * Toggle red lines in the score
 */
function toggleRedLines() {
  showRedLines = !showRedLines;
  if (showRedLines) {
    drawLinesInScore();
  } else {
    clearLinesInScore();
  }
} // toggleRedLines()

/**
 * Handle the files of the input #fileInput or #dropArea,
 * check whether there is one MEI file and at least one maps file,
 * load them, warp them, and download the warped SVGs in one
 * zip file.
 * @param {Event} event - the event triggered by the file input
 * @returns {void}
 * @description
 * This function is called when the user selects files from the file input,
 * or drags and drops files into the input area.
 * It checks if there is one MEI file and at least one maps file,
 * and loads them into the score warper.
 * It also updates the maps file and downloads the warped SVG.
 * If there are no MEI files or no maps files, it shows an alert.
 */
async function handleLocalFiles(event) {
  const files = event.target.files;
  let meiFile = null;
  let mapsFiles = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log('Loading file: ', file);
    if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.endsWith('.mei')) {
      meiFile = file;
    } else if (file.type === 'application/json' || file.name.endsWith('.json') || file.name.endsWith('.maps')) {
      mapsFiles.push(file);
    }
  }
  if (!meiFile) {
    alert('Please select an MEI file.');
    return;
  }
  if (mapsFiles.length === 0) {
    alert('Please select at least one maps file.');
    return;
  }

  createTaskList(meiFile, mapsFiles);

  // read MEI file
  meiFileName = meiFile.name;
  await loadMEIfromLocalFile(meiFile);

  // https://stuk.github.io/jszip/
  let zip = new JSZip();
  let zipFileName = meiFileName.replace('.mei', '-ScoreWarped.zip');
  console.log('Creating ZIP file: ', zipFileName);

  // Add maps files to ZIP
  for (let j = 0; j < mapsFiles.length; j++) {
    let mapsFile = mapsFiles[j];
    setTaskStatus(j + 1, 'in-progress');
    loadMEI(false); // reload MEI file and clear lines
    let msg = await loadLocalMapsFile(mapsFile);
    if (msg === 'ok') {
      warp();
      let svgName = `${meiFile.name}-${mapsFile.name}.svg`;
      zip.file(svgName, new XMLSerializer().serializeToString(scoreWarper.svgObj));
      console.log('Added to zip: ', svgName);
      setTaskStatus(j + 1, 'completed');
    } else {
      setTaskStatus(j + 1, 'failed');
      console.error('Error loading maps file: ', msg);
    }
  }

  // Generate and save ZIP file
  zip.generateAsync({ type: 'blob' }).then(function (content) {
    console.log('Saving ZIP file with fileSaver.js: ', zipFileName);
    saveAs(content, zipFileName);
  });
} // handleLocalFiles()

function addLine(node, x1, x2, y1, y2, color = 'black', strokeWidth = 1) {
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('x2', x2);
  line.setAttribute('y1', y1);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke-width', strokeWidth);
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke', color);
  return node.appendChild(line);
} // addLine()

function addCircle(node, cx, cy, r, color = 'black', strokeWidth = 1) {
  const circle = document.createElementNS(svgNS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', r);
  circle.setAttribute('stroke-width', strokeWidth);
  circle.setAttribute('stroke', color);
  return node.appendChild(circle);
} // addCircle()

function addText(node, text, x, y, halign = 'middle', color = 'black') {
  let txt = document.createElementNS(svgNS, 'text');
  txt.setAttribute('text-anchor', halign);
  txt.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
  txt.setAttribute('font-size', 10.5);
  txt.setAttribute('fill', color);
  txt.setAttribute('x', x);
  txt.setAttribute('y', y);
  txt.appendChild(document.createTextNode(text));
  return node.appendChild(txt);
} // addText()

function createTaskList(meiFile, mapsFiles) {
  let taskList = document.getElementById('taskList');
  taskList.innerHTML = ''; // clear task list
  let taskItem = createTaskItem(0, '<b>' + meiFile.name + '</b>', 'none');
  taskList.appendChild(taskItem);
  mapsFiles.forEach((item, i) => {
    let taskItem = createTaskItem(i + 1, item.name);
    taskList.appendChild(taskItem);
  });
} // createTaskList()

function createTaskItem(taskNumber, taskName, status = 'planned') {
  let taskItem = document.createElement('span');
  if (taskNumber > 0) taskItem.innerHTML = `${taskNumber} `;
  taskItem.innerHTML += `${taskName}`;
  taskItem.id = `task${taskNumber}`;
  taskItem.value = status;

  switch (status) {
    case 'planned':
      taskItem.classList = 'taskItem task-planned';
      break;
    case 'in-progress':
      taskItem.classList = 'taskItem task-in-progress';
      break;
    case 'completed':
      taskItem.classList = 'taskItem task-completed';
      break;
    case 'failed':
      taskItem.classList = 'taskItem task-failed';
      break;
    case 'none':
      taskItem.classList = 'taskItem task-title';
      break;
  }

  return taskItem;
} // createTaskItem()

function setTaskStatus(taskNumber, status) {
  let taskItem = document.getElementById(`task${taskNumber}`);
  if (taskItem) {
    taskItem.value = status;
    taskItem.classList = `taskItem task-${status}`;
  }
} // setTaskStatus()

function clearInputs() {
  let fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.value = ''; // clear file input
  }
  let taskList = document.getElementById('taskList');
  if (taskList) {
    taskList.innerHTML = ''; // clear task list
  }
} // clearInputs()

/**
 * Show info text about the tool
 * @param {string} text - the text to show
 * @param {string} title - the title of the info box
 */
function showInfo(text, title = 'Info') {
  let infoBox = document.getElementById('infoBox');
  if (infoBox) {
    infoBox.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
    infoBox.style.display = 'block';
  }
} // showInfo()
