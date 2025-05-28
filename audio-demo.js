import WaveSurfer from './deps/wavesurfer.js';

let wavesurfers = {};

function createWaveSurfer(url, pixelsPerSecond) {
  const opts = {
    container: '#' + CSS.escape(url),
    waveColor: 'violet',
    progressColor: 'purple',
    cursorColor: 'navy',
    responsive: true,
    interact: true,
    width: '100%',
    mediaControls: true,
  };

  let wavesurfer = WaveSurfer.create(opts);
  // Update the width of the WaveSurfer instance based on the audio duration
  wavesurfer.on('decode', function (duration) {
    console.log('Decoded audio for:', url, 'Duration:', duration);
    opts.width = duration * pixelsPerSecond;
    wavesurfer.setOptions(opts);
  });

  wavesurfer.on('timeupdate', function (time) {
    const score = document.getElementById('score-' + url);
    let horizontalAxis = score.querySelector('.horizontalAxis');
    let hAxisX1 = parseFloat(horizontalAxis.getAttribute('x1'));
    let elapsedOnScore = time * pixelsPerSecond + hAxisX1; //elapsed * hAxisWidth + hAxisX1;
    const playbackCursor = score.querySelector('.playbackCursor');
    if (playbackCursor) {
      // update the playback cursor position
      playbackCursor.setAttribute('x1', elapsedOnScore);
      playbackCursor.setAttribute('x2', elapsedOnScore);
    } else {
      // add playback cursor to the score if one does not exist
      const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      cursor.setAttribute('class', 'playbackCursor');
      cursor.setAttribute('x1', elapsedOnScore);
      cursor.setAttribute('y1', '0');
      cursor.setAttribute('x2', elapsedOnScore);
      cursor.setAttribute('y2', '100%');
      cursor.setAttribute('stroke', 'red');
      cursor.setAttribute('stroke-width', '2');
      // insert the playback cursor into the score
      score.querySelector('.timeAxis').appendChild(cursor);
    }
  });

  wavesurfer.load(url);
  wavesurfers[url] = wavesurfer;
  return wavesurfer;
}

async function fetchSvg(svgUri) {
  console.log('Fetching SVG from:', svgUri);
  return fetch(svgUri)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.text();
    })
    .catch((error) => console.error('Error fetching SVG:', error));
}

document.addEventListener('DOMContentLoaded', function () {
  // load the audio-demo.json file
  fetch('./audio-demo.json')
    .then((response) => response.json())
    .then(async (data) => {
      console.log('Loaded audio-demo.json:', data);
      for (const item of data) {
        const svgUri = item.svgUri;
        const audioUri = item.audioUri;

        // Create a new div for the wavesurfer container
        const container = document.createElement('div');
        container.className = 'score-audio-container';
        const score = document.createElement('div');
        score.className = 'score';
        // load the SVG
        score.innerHTML = await fetchSvg(svgUri);
        score.id = 'score-' + audioUri;
        const audio = document.createElement('div');
        audio.className = 'audio';
        audio.id = audioUri;
        container.appendChild(audio);
        container.appendChild(score);
        document.getElementById('score-audio-containers').appendChild(container);
        console.log('Score: ', score);
        const x1 = score.querySelector('.horizontalAxis').getAttribute('x1');
        const x2 = score.querySelector('.horizontalAxis').getAttribute('x2');
        const width = parseInt(x2) - parseInt(x1);
        // scale the width to fit the audio duration
        // first, obtain last 'text' (axis label) element from the timeAxis
        const lastText = score.querySelector('.timeAxis text:last-child');
        // obtain its value
        const lastSecondsMarkerValue = parseFloat(lastText.textContent);
        // use this to calculate the number of pixels per second in the SVG
        const pixelsPerSecond = width / lastSecondsMarkerValue;
        console.log(
          'SVG width:',
          width,
          'lastSecondsMarkerValue:',
          lastSecondsMarkerValue,
          'pixelsPerSecond:',
          pixelsPerSecond
        );
        // Create the WaveSurfer instance
        createWaveSurfer(audioUri, pixelsPerSecond);
        audio.style.marginLeft = x1 + 'px';
      }
    })
    .catch((error) => console.error('Error loading audio-demo.json:', error));
});
