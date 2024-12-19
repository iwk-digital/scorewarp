/**
 * @file gui.js
 * @description
 * This file contains the main functions for the GUI of the warp tool.
 * 
 */

// Default variables
const dateString = 'Demo version, 19 December 2024';
const svgNS = "http://www.w3.org/2000/svg";

let meiFileName = '';
let mapsFileName = '';

// Verovio toolkit variables
let tk; // toolkit instance
let tkVersion = ''; // toolkit version string
let tkOptions = {
    svgHtml5: true,
};

let svgString; // raw SVG text string of engraved MEI file
let scoreWarper; // score warper object
let warped = false; // whether or not the score has been warped
let pieceSel; // selection element for pieces
let perfSel; // selection element for performances

/**
 * This function is called when the DOM is fully loaded.
 * It initializes the Verovio toolkit and loads the MEI file.
 * It also sets up the event listeners for the keyboard shortcuts.
 * 
 * @param {Event} event
 * @returns {void}
 * @description
 */
document.addEventListener("DOMContentLoaded", () => {
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
        let perfSel = document.getElementById("performance");
        perfSel.length = 1;
        for (let y in demoFiles[defaultPiece].performances) {
            perfSel.options[perfSel.options.length] = new Option(y, y);
        }
    }

    // add keyboardListeners and update notation panel
    document.addEventListener('keyup', keyboardListener);
    document.getElementById('date').innerHTML += dateString;

    document.getElementById("notation").innerHTML = "<b>Loading Verovio...</b>";
    Module.onRuntimeInitialized = async _ => {
        tk = new verovio.toolkit();
        tk.setOptions(tkOptions);
        tkVersion = tk.getVersion();
        console.log("Verovio " + tkVersion + ' loaded.');
        document.querySelector('#copyright').innerHTML +=
            `Gratefully using
        <a href="https://www.verovio.org/">Verovio ${tkVersion}</a>.`;
        document.getElementById("notation").innerHTML = `<b>Verovio ${tkVersion} loaded.</b>`;

        loadMEI();
    };
}); // DOMCOntentLoaded() listener

/**
* Load MEI string from meiFileName and render it to SVG using Verovio.
* Parse the SVG text to an SVG object and call loadMEIfinalizing().
*/
function loadMEI(reload = true) {
    if (!meiFileName) {
        return;
    }
    warped = false;
    clearAllLines();
    document.getElementById("performanceTime").innerHTML = "";
    document.getElementById("notation").innerHTML = '<b>Loading ' + meiFileName + '...</b>';
    console.log('Loading ' + meiFileName + '...');
    if (reload) {
        fetch(meiFileName)
            .then((response) => response.text())
            .then((meiText) => {
                console.log("MEI loaded."); // , meiText);
                tk.setOptions({
                    scale: 30,
                    breaks: "none",
                    header: "none",
                    footer: "none"
                });
                svgString = tk.renderData(meiText, {});
                console.log("SVG rendered.");

                // when SVG is loaded, finalize loading
                updateGUI();
            });
    } else {
        updateGUI();
    }
} // loadMEI()

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
    let svgDocument = new DOMParser().parseFromString(svgString, "image/svg+xml");
    if (svgDocument.childNodes && svgDocument.childNodes.length > 0) {
        scoreWarper = new ScoreWarper(svgDocument.childNodes[0]);
        // console.log("SVG inside ScoreWarper:", scoreWarper.svgObj);
    }

    // update notation panel
    let notationDiv = document.getElementById("notation");
    notationDiv.innerHTML = "<p><b>Score:</b> " + pieceSel.value + "</p>";
    notationDiv.appendChild(scoreWarper.svgObj);
    // console.log('NotationDiv: ', notationDiv);

    scoreWarper.shiftPageMargin();

    if (pieceSel && pieceSel.value && perfSel && perfSel.value &&
        demoFiles[pieceSel.value].performances[perfSel.value]) {
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
    if (e.code == "KeyC") loadMEI(false); // reload MEI file
    // download score SVG file
    if (e.code == "KeyD" && scoreWarper.svgObj) {
        downloadSVG();
    }
    // download score and performance SVG files
    if (e.code == "KeyF" && scoreWarper.svgObj) {
        downloadSVG(true);
    }
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
        document.getElementById("downloadLink").innerHTML = "";

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
function drawConnectorLines(target = 'score') { // 'chords', 'notes'
    let pt = document.querySelector('.performanceTime');
    if (pt) {
        pt.querySelectorAll('line[stroke="orange"]') // remove lines
            .forEach(item => item.remove());
    }
    let j = 0;
    // plot straight lines
    scoreWarper.maps.forEach((item, i) => {
        if (i >= scoreWarper.firstOnsetIdx(scoreWarper.maps) &&
            i <= scoreWarper.lastOnsetIdx(scoreWarper.maps)) {
            screenX = scoreWarper.time2screen(item.obs_mean_onset);

            if (target === 'score') {
                addLine(pt, screenX, scoreWarper.noteXs[j++], y1, y2, 'orange');
            } else {
                addLine(pt, screenX, screenX, y1, y2, 'orange');
            }
        }
    });
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
            scoreWarper.noteSVGXs.forEach(item => {
                addLine(lineContainer, item, item, scoreWarper.svgViewBox[3], 0, 'red', 20);
            });
        } else { // this is for warped notes, probably never called
            scoreWarper.onsetSVGXs.forEach(item => {
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
    warpFunc.forEach(item => {
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
        pt.querySelectorAll('line').forEach(item => item.remove());
    }
    let pm = document.querySelector('.page-margin');
    console.info('clearAllLines pm: ', pm);
    if (pm) {
        pm.querySelectorAll('line').forEach(item => item.remove());
    }
} // clearAllLines()

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
        if (i >= scoreWarper.firstOnsetIdx(scoreWarper.maps) &&
            i <= scoreWarper.lastOnsetIdx(scoreWarper.maps)) {
            let screenX = scoreWarper.time2screen(item.obs_mean_onset);
            addLine(ptObj, screenX, screenX, y0basis, y1, 'purple');
            // save onset time data in SVG coordinates
        }
    });

    // scoreTimeDiv.appendChild(createScoreTimeSVG(bb.width, 200));
    const serializer = new XMLSerializer();
    // console.info('stSVG: ' + stSVG);
    let scoreTimeDiv = document.getElementById("performanceTime");
    scoreTimeDiv.innerHTML = serializer.serializeToString(ptObj);
    if (pieceSel && pieceSel.value && perfSel && perfSel.value) {
        scoreTimeDiv.innerHTML += "<p><b>Performance: </b>" + perfSel.value + "</p>";
    }

    drawConnectorLines('score');
    drawTimeAxis(document.querySelector('.performanceTime'));

    // for DEBUGGING: plot warping function...
    if (true) {
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
function drawTimeAxis(node, toScreen = true, y = y0basis, color = "black") {
    const g = document.createElementNS(svgNS, 'g'); // time axis in notation
    g.setAttribute('class', 'timeAxis');
    node.appendChild(g);
    let tickIncr = 1; // seconds
    let numbIncr = 10; // seconds
    let lastTick = Math.ceil(scoreWarper.tmx / numbIncr) * numbIncr;
    let s, s2;
    // draw tick lines and horizontal axis and label
    for (let t = 0; t <= lastTick; t += tickIncr) {
        (toScreen) ? s = scoreWarper.time2screen(t) : s = scoreWarper.time2svg(t);
        if (Math.round(t / numbIncr) == t / numbIncr) {
            addLine(g, s, s, y, y + 4, color, 1); // longer tick line
        } else {
            addLine(g, s, s, y, y + 2, color, 1); // short tick line
        }
        if (t == 0) { // draw horizontal axis and axis label
            (toScreen) ? s2 = scoreWarper.time2screen(lastTick) : scoreWarper.time2svg(lastTick);
            addLine(g, s, s2, y, y, color, 1);
            addText(g, 'Time (s)', 1, y - 4, "left", color);
        }
    }
    // draw tick label numbers
    for (let t = 0; t <= lastTick; t += numbIncr) {
        (toScreen) ? s = scoreWarper.time2screen(t) : s = scoreWarper.time2svg(t);
        addText(g, t, s, y + 13, 'middle', color);
    }
} // drawTimeAxis()

function updateMeiFile(fileName = "") {
    meiFileName = fileName;
    console.info("updateMEIfile " + meiFileName);
    clearAllLines();
    loadMEI();
} // updateMeiFile()

function updateMapsFile(fileName = "") {
    mapsFileName = fileName;
    console.info("updateMapsFile " + mapsFileName);
    clearAllLines();
    if (warped) {
        loadMEI(false);
    }
    fetch(mapsFileName)
        .then(response => response.json())
        .then(json => {
            // set maps object in scoreWarper
            loadPerformanceTiming(json);
        });
    console.info('updateMapsFile maps: ', scoreWarper.maps);
} // updateMapsFile()

window.onload = function () {
    pieceSel = document.getElementById("piece");
    perfSel = document.getElementById("performance");
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
        updateMeiFile(pieceFile);
    }
    perfSel.onchange = function () {
        let performanceName = this.value;
        let mapsFile = demoFiles[pieceSel.value].performances[this.value];
        console.info("Performance: " + performanceName + ', mapsFile:' + mapsFile);
        updateMapsFile(mapsFile);
    }
} // window.onload()

// creates SVG blob and downloads it
function downloadSVG(savePerformance = false) {
    let svgName = '';
    if (scoreWarper.svgObj) {
        let svg = new XMLSerializer().serializeToString(scoreWarper.svgObj);
        let type = "image/svg+xml";
        let a = document.getElementById("downloadLink");
        var file = new Blob([svg], {
            type: type
        });
        a.href = URL.createObjectURL(file);
        if (!warped && pieceSel && pieceSel.value) {
            svgName = pieceSel.value;
            // a.innerHTML = "Download SVG";
        }
        if (warped && pieceSel && pieceSel.value && perfSel && perfSel.value) {
            svgName = pieceSel.value + '_' + perfSel.value;
            // a.innerHTML = "Download Warped SVG";
        }
        a.download = svgName;
        a.click();
    }
    let performanceSVG = document.getElementById('performanceTime').querySelector('svg');
    if (savePerformance && performanceSVG) {
        let svg = new XMLSerializer().serializeToString(performanceSVG)
        let type = "image/svg+xml";
        let a = document.getElementById("downloadLink");
        var file = new Blob([svg], {
            type: type
        });
        a.href = URL.createObjectURL(file);
        a.download = svgName + '_performance';
        a.click();
    }

} // downloadSVG()

function addLine(node, x1, x2, y1, y2, color = "black", strokeWidth = 1) {
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

function addCircle(node, cx, cy, r, color = "black", strokeWidth = 1) {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('stroke', color);
    return node.appendChild(circle);
} // addCircle()

function addText(node, text, x, y, halign = "middle", color = "black") {
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