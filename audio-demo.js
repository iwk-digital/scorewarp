import WaveSurfer from './deps/wavesurfer.js';

const cursorOffset = 0.4; // nudge score slightly to the right to align with wavesurfer cursor

// TODO: Enable SPACE bar to start/stop playback of the current audio

let wavesurfers = {};

function createWaveSurfer(url, pixelsPerSecond) {
  const opts = {
    container: '#' + CSS.escape(url),
    waveColor: 'lightblue',
    progressColor: 'cornflowerblue',
    cursorColor: 'red',
    responsive: true,
    interact: true,
    width: '100%',
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
    // +.3 to better align with the wavesurfer cursor
    playbackCursor.setAttribute('x1', elapsedOnScore + cursorOffset);
    playbackCursor.setAttribute('x2', elapsedOnScore + cursorOffset);
    // Update horizontal scroll position to keep the playback cursor in view
    document.getElementById('score-audio-containers').scrollLeft =
      elapsedOnScore - window.innerWidth / 2 + cursorOffset;
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

function addCursorToScore(score) {
  const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  // align with the second text node in the timeAxis, i.e. the 0 label
  let x1;
  let texts = score.querySelectorAll('.timeAxis text');
  if (texts.length < 2) {
    console.error('Not enough text elements in timeAxis to align playback cursor, defaulting to 0');
    x1 = 0; // default to 0 if not enough text elements
  } else {
    x1 = parseFloat(texts[1].getAttribute('x'));
  }
  // add a small offset to the x1 value to align with the wavesurfer cursor
  cursor.setAttribute('class', 'playbackCursor');
  cursor.setAttribute('x1', x1 + cursorOffset + 'px');
  cursor.setAttribute('y1', '0');
  cursor.setAttribute('x2', x1 + cursorOffset + 'px');
  cursor.setAttribute('y2', '100%');
  cursor.setAttribute('stroke', 'red');
  cursor.setAttribute('stroke-width', '1');
  // insert the playback cursor into the score
  score.querySelector('.timeAxis').appendChild(cursor);
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
        const givenPixelsPerSecond = item.pixelsPerSecond || 25; // defaults to 25 if not provided

        // Create a new div for the wavesurfer container
        const container = document.createElement('div');
        container.className = 'score-audio-container';
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = item.audioUri.split('/').pop(); // Get the last part of the audioUri
        // remove the file extension from the label
        label.textContent = label.textContent.replace(/\.[^/.]+$/, '');
        const score = document.createElement('div');
        score.className = 'score';
        // load the SVG
        score.innerHTML = await fetchSvg(svgUri);
        score.id = 'score-' + audioUri;
        addCursorToScore(score);
        // Create a div for wavesurfer audio
        const audio = document.createElement('div');
        audio.className = 'audio';
        audio.id = audioUri;
        container.appendChild(label);
        container.appendChild(audio);
        container.appendChild(score);
        // Add playback cursor to the score
        document.getElementById('score-audio-containers').appendChild(container);
        const x1 = score.querySelector('.horizontalAxis').getAttribute('x1');
        const x2 = score.querySelector('.horizontalAxis').getAttribute('x2');
        const horizontalAxisWidth = parseInt(x2) - parseInt(x1);
        // scale the width to fit the audio duration
        // first, obtain last 'text' (axis label) element from the timeAxis
        const texts = score.querySelectorAll('.timeAxis text');
        if (texts.length === 0) {
          console.error('No timeAxis text elements found in the score.');
          continue;
        }
        const lastText = texts[texts.length - 1];
        // obtain its value
        const lastSecondsMarkerValue = parseFloat(lastText.textContent);
        // use this to calculate the number of pixels per second in the SVG
        const pixelsPerSecond = horizontalAxisWidth / lastSecondsMarkerValue;

        let scaleAudio = false;
        if (scaleAudio) {
          // calculate the width from the given pixelsPerSecond
          let calculatedHorizontalAxisWidth = lastSecondsMarkerValue * givenPixelsPerSecond;
          let scaleFactor = calculatedHorizontalAxisWidth / horizontalAxisWidth;
          console.log('Calculated horizontal axis width:', calculatedHorizontalAxisWidth, 'Scale factor:', scaleFactor);
          let svg = score.querySelector('svg');
          if (svg) {
            svg.querySelector('.timeAxis').setAttribute('transform-origin', x1 + 'px 0');
            svg.querySelector('.timeAxis').setAttribute('transform', 'scale(' + scaleFactor + ',1)');
            svg.querySelector('.definition-scale').setAttribute('transform-origin', x1 + 'px 0');
            svg.querySelector('.definition-scale').setAttribute('transform', 'scale(' + scaleFactor + ',1)');
          }
          createWaveSurfer(audioUri, givenPixelsPerSecond);
        } else {
          console.log(
            'SVG width:',
            horizontalAxisWidth,
            'lastSecondsMarkerValue:',
            lastSecondsMarkerValue,
            'pixelsPerSecond:',
            pixelsPerSecond
          );
          // Create the WaveSurfer instance
          createWaveSurfer(audioUri, pixelsPerSecond);
        }
        audio.style.marginLeft = x1 + 'px';
        container.addEventListener('click', function (event) {
          // scroll vertically to ensure the top and bottom of the container are visible
          console.log('Container clicked:', container);
          // Scroll the container into view
          container.scrollIntoView({
            block: 'start',
            inline: 'nearest',
          });
          // ensure the body is scrolled to the top of the page
          document.body.scrollTop = 0;
          //document.getElementById('score-audio-containers').scrollTop =
          //  container.getBoundingClientRect().top + window.scrollY;

          // Pause all other wavesurfers
          for (const key in wavesurfers) {
            if (key !== audioUri && wavesurfers[key].isPlaying()) {
              wavesurfers[key].pause();
            }
          }
          // Check if the click was on the audio container
          const wavesurfer = wavesurfers[audioUri];
          if (wavesurfer.isPlaying()) {
            wavesurfer.pause();
          } else {
            wavesurfer.play();
          }
        });
      }
    })
    .catch((error) => console.error('Error loading audio-demo.json:', error));
});
