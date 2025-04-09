// a wrapper file for scoreWarper.js to be used with Node.js from the MacOSX terminal.
// It loads several maps files and saves the SVG output of scoreWarper.js to the same folder

const fs = require('node:fs');
const https = require('https');
const path = require('node:path');
const { DOMParser } = require('xmldom');

// load demo.js
const demo = require('./demo.js');
console.log(demo.demoFiles);

// load scoreWarper.js
const ScoreWarper = require('./scoreWarper.js');
console.log(ScoreWarper);

const meiFiles = Object.keys(demo.demoFiles).map((key) => demo.demoFiles[key].meiFile);
console.log(meiFiles);

if (false) {
  // go through the demo object and load each .mei file

  let tkOptions = {
    svgHtml5: true,
    scale: 30,
    breaks: 'none',
    header: 'none',
    footer: 'none',
  };
  // load the Verovio toolkit and convert the MEI files to SVG
  const Verovio = require('verovio');
  Verovio.module.onRuntimeInitialized = function () {
    // create the toolkit instance
    const vrvToolkit = new Verovio.toolkit();
    console.log('Verovio toolkit loaded, Version ' + vrvToolkit.getVersion());
    vrvToolkit.setOptions(tkOptions);

    meiFiles.forEach((meiFile) => {
      // read the MEI file from online resource
      https.get(meiFile, (response) => {
        console.log('Response: ' + response.statusCode);
        let data = '';
        // collect the data chunks
        response.on('data', (chunk) => {
          data += chunk;
        });
        // when the response is complete, save the data to a file
        response.on('end', () => {
          vrvToolkit.loadData(data);
          // render the first page as SVG
          const svg = vrvToolkit.renderToSVG(1, {});
          // save the SVG into a file
          const svgFile = 'svg/' + path.basename(meiFile) + '.svg';
          console.log('SVG file: ' + svgFile);
          // create the directory if it does not exist
          const dir = path.dirname(svgFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // write the SVG file
          fs.writeFileSync(svgFile, svg);
        });
      });
    });
  };
}

Object.keys(demo.demoFiles).forEach((piece, i) => {
  if (i === 0) {
    const pieceData = demo.demoFiles[piece];
    console.log(pieceData);
    // load the SVG file
    const svgFile = 'svg/' + path.basename(pieceData.meiFile) + '.svg';
    console.log(svgFile);

    // load the SVG file
    const svgData = fs.readFileSync(svgFile, 'utf8');
    const svgDoc = new DOMParser().parseFromString(svgData, 'image/svg+xml');
    console.log(svgDoc);

    svgDoc.querySelectorAll('.notehead use').forEach((notehead) => {
      console.log(notehead);
    });
  }

  if (false) {
    // load the maps files
    Object.keys(pieceData.performances).forEach((performance) => {
      const mapsFile = pieceData.performances[performance];
      console.log(mapsFile);

      // load maps file as JSON
      const mapsData = fs.readFileSync(mapsFile, 'utf8');
      // parse the JSON data
      const mapsJson = JSON.parse(mapsData);
      console.log(mapsJson);

      // convert the maps file to SVG
      let sW = new ScoreWarper(svgDoc, mapsJson);
      sW.init();

      const warpedSvgFile = 'warpedSvg/' + path.basename(mapsFile) + '.svg';
      console.log(warpedSvgFile);
      // create the directory if it does not exist
      const dir = path.dirname(warpedSvgFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // write the SVG file
      fs.writeFileSync(warpedSvgFile, sW.svgObj);
    });
  }
});
