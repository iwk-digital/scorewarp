/**
 * @description: scoreWarper.js
 * @version: 1.0.0
 * 
 * Warps a score SVG notation file engraved by Verovio to a given time warping function.
 * The time warping function is given as a list of time points and corresponding time warping factors.
 *
 * TODO: .tupletNum 'g use' not handled
 */
class ScoreWarper {
    constructor(svgObject = undefined, maps = undefined) {
        this._svgObj = svgObject; // the SVG element
        this._maps = maps; // store the maps file content
        if (maps !== undefined) {
            this.loadMaps(maps);
        }
        if (this._svgObj !== undefined) {
            this.init();
        }
    } // constructor()

    //#region Control Methods

    /**
     * Calculates the SVG coordinates of the score. Called only once when the object is created.
     */
    init() {
        this._noteXs = []; // x values of notes on screen
        this._noteSVGXs = []; // x values of notes in SVG
        this._onsetSVGXs = []; // SVG x values of onset times
        this._elementList; // a nodeList of elements that need to be warped
        this._timeWarpingFunction; // store the time warping function

        this._fstX = 0; // first note screen x
        this._lstX = 0; // last note screen x
        this._tmn = 0; // global min onset time
        this._tmx = 0; // global max onset time

        if (this._svgObj) {
            // SVG object properties
            this._svgWidth = parseFloat(this._svgObj.getAttribute('width'));
            this._svgHeight = parseFloat(this._svgObj.getAttribute('height'));
            this._svgViewBox = this._svgObj.querySelector('svg[viewBox]').getAttribute('viewBox');
            this._svgViewBox = this._svgViewBox.split(' ').map(Number);
            let pageMarginElement = this._svgObj.querySelector('.page-margin');
            let transformations = pageMarginElement.transform.baseVal;
            this._pageMarginX = transformations.getItem(0).matrix.e;

            console.debug('svgObj: ', this._svgObj);
            console.debug('svgObj width: ', this._svgWidth);
            console.debug('svgObj viewBox: ', this._svgViewBox);
            console.debug('svgObj transform: ', pageMarginElement.transform);
            console.debug('svgObj transform bsVl: ', transformations.getItem(0));
        }
    } // init()

    /**
     * Scans maps file content and calculates the coordinates for
     * time, screen, and SVG. To be called, when new maps file content is loaded.
     * @param {Object} maps
     */
    loadMaps(maps) {
        console.debug('ScoreWarper loadMaps() maps: ', maps);

        // determine global min and max onset times from maps object
        this._tmn = maps[this.firstOnsetIdx(maps)].obs_mean_onset;
        this._tmx = maps[this.lastOnsetIdx(maps)].obs_mean_onset;
        console.debug('ScoreWarper tmn/tmx: ' + this._tmn + '/' + this._tmx);

        // determine global min and max screen x values of notes
        let id1 = maps[this.firstOnsetIdx(maps)].xml_id[0];
        let el1 = this.getElementForId(id1).querySelector('.notehead use');
        this._fstX = this.svg2screen(parseFloat(el1.getAttribute('x')));

        let id2 = maps[this.lastOnsetIdx(maps)].xml_id[0];
        let el2 = this.getElementForId(id2).querySelector('.notehead use');
        this._lstX = this.svg2screen(parseFloat(el2.getAttribute('x')));
        console.debug('ScoreWarper first/lastNotehead x: ' + this._fstX + '/' + this._lstX);

        // calculate score note coordinates
        this._noteXs = []; // x values of notes on screen
        this._noteSVGXs = []; // x values of notes in SVG
        maps.forEach((item, i) => {
            if (i >= this.firstOnsetIdx(maps) && i <= this.lastOnsetIdx(maps)) {
                let note = this.getElementForId(item.xml_id[0]);
                // console.debug(i + '; note: ', note);
                if (note) {
                    // take center of note heads as x value
                    let bbox = note.querySelector('.notehead use')?.getBBox();
                    // console.debug('Note BBox: ', bbox);
                    let noteX = bbox.x; // + bbox.width / 2;
                    if (!noteX) {
                        console.warn('Note without notehead: ', note);
                    }
                    this._noteSVGXs.push(noteX); // pure SVG x values (without page-margin)
                    this._noteXs.push(this.svg2screen(noteX));
                } else {
                    console.debug(i + '; note: NOT FOUND');
                }
            }
        });

        // calculate onsetSVGs with mean onset times per event (as in maps object)
        this._onsetSVGXs = []; // SVG x values of onset times
        maps.forEach((item, i) => {
            if (i >= this.firstOnsetIdx(maps) && i <= this.lastOnsetIdx(maps)) {
                let t = item.obs_mean_onset;
                // save onset time data in SVG coordinates
                this._onsetSVGXs.push(this.time2svg(t));
            }
        });
    } // loadMaps()

    /**
     * Shift the page-margin group by half a notehead width to the left 
     * (quick hack to center the lines on noteheads)
     */
    shiftPageMargin() {
        let pageMarginElement = this._svgObj.querySelector('.page-margin');
        let transformations = pageMarginElement.transform.baseVal;

        // get notehead width
        let noteheadWidths =
            Array.from(this._svgObj.querySelectorAll('.notehead'))
                .map(
                    (notehead) => notehead.getBBox().width
                );
        this._noteheadWidth = this.median(noteheadWidths);

        // shift page margin by half a notehead width to the left
        transformations.getItem(0).matrix.e = this._pageMarginX - this._noteheadWidth / 2;
    } // shiftPageMargin()    

    /**
     * Warps the score SVG object to the given time warping function
     * @param {Object} maps (optional) maps file content, if empty,
     * the current maps file content is used
     */
    warp(maps = null) {
        if (maps !== null) {
            this.loadMaps(maps);
        }

        // selector for SVG elements that need to be warped
        let listOfSelectors = [
            'g.note,g.rest', // for notes/chords and rests
            'g.arpeg', // for arpeggios
            'g.beam', // for beams
            'g.hairpin', // for hairpins
            'g.lineDash', // for ledger lines (svgHtml5 option for Verovio toolkit)
            'line', // for red lines
            'path', // for slur, barline, (stem handled by note, staff lines ignored)
            'use[x]', // for many elements
            'text[x]',
            'rect[x]',
            // 'ellipse', // not for dots, for what?
            // 'circle', // for what?
        ];

        // calculate warping function
        let warpFunc = this.computeWarpingArray();

        // shift elements in elementList
        this.#shiftElements(listOfSelectors, warpFunc);
    } // warp()

    /**
     * Adjusts individual notes in a chord. To be run after calling warp().
     */
    warpIndividualNotes() {
        // iterate over all notes in the maps file
        this._maps.forEach((item, i) => {
            if (i >= this.firstOnsetIdx(this._maps) && i <= this.lastOnsetIdx(this._maps)) {
                let onsetSVGx = this.time2svg(item.obs_mean_onset);
                item.xml_id.forEach((id) => {
                    let note = this.getElementForId(id);
                    if (note) {
                        let xTranslate = note.transform.baseVal;
                        let xShift = 0;
                        if (xTranslate.length > 0) {
                            xShift = xTranslate.getItem(0).matrix.e;
                        } else {
                            xShift = note.closest('.chord')?.transform.baseVal.getItem(0).matrix.e;
                        }
                        let notehead = note.querySelector('g.notehead');
                        let noteheadBB = notehead?.getBBox();
                        let noteX = noteheadBB.x + xShift; // + noteHeadBB.width / 2;
                        this.#translate(note, onsetSVGx - noteX);
                    } else {
                        console.debug('No note element found: ', id);
                    }
                });
            }
        });
    } // adjustIndividualNotes()

    //#endregion Control Methods



    //#region Getters

    /**
     * Get fstX (first note screen x) in the maps file
     */
    get fstX() {
        return this._fstX;
    } // get fstX()

    /**
     * Get lstX (last note screen x) in the maps file
     */
    get lstX() {
        return this._lstX;
    } // get lstX()

    /**
     * Get the maps file content
     */
    get maps() {
        return this._maps;
    } // get maps()

    /**
     * Get noteheadWidth
     */
    get noteheadWidth() {
        return this._noteheadWidth;
    } // get noteheadWidth()

    /**
     * Get noteXs (x values of notes on screen)
     */
    get noteXs() {
        return this._noteXs;
    } // get noteXs()

    /**
     * Get noteSVGXs (x values of notes in SVG)
     */
    get noteSVGXs() {
        return this._noteSVGXs;
    } // get noteSVGXs()

    /**
     * Get onsetSVGXs (SVG x values of onset times)
     */
    get onsetSVGXs() {
        return this._onsetSVGXs;
    } // get onsetSVGXs()

    /**
     * Get page margin X coordinate
     */
    get pageMarginX() {
        return this._pageMarginX;
    } // get pageMarginX()

    /**
     * Get the SVG height
     */
    get svgHeight() {
        return this._svgHeight;
    } // get svgHeight()

    /**
     * Get the original SVG object
     */
    get svgObj() {
        return this._svgObj;
    } // get svgObj()

    /**
     * Get the SVG viewBox
     */
    get svgViewBox() {
        return this._svgViewBox;
    } // get svgViewBox()

    /**
     * Get the SVG width
     */
    get svgWidth() {
        return this._svgWidth;
    } // get svgWidth()

    /**
     * Get the time warping function
     */
    get timeWarpingFunction() {
        return this._timeWarpingFunction;
    } // get timeWarpingFunction()

    /**
     * Get tmn (global min onset time) in the maps file
     */
    get tmn() {
        return this._tmn;
    } // get tmn()

    /**
     * Get tmx (global max onset time) in the maps file
     */
    get tmx() {
        return this._tmx;
    } // get tmx()

    //#endregion Getters



    //#region Setters

    /**
     * Set the maps file content and compute coordinates for time, screen, and SVG
     */
    set maps(maps) {
        this.loadMaps(maps);
        this._maps = maps;
    } // set maps()

    /**
     * Set svgObj (the SVG element)
     */
    set svgObj(svgObj) {
        this._svgObj = svgObj;
        this.init();
    } // set svgObj()

    /**
     * Set the time warping function
     */
    set timeWarpingFunction(timeWarpingFunction) {
        this._timeWarpingFunction = timeWarpingFunction;
    } // set timeWarpingFunction()

    //#endregion Setters



    //#region Helper Methods

    /**
     * Computes the warping function for the note SVG x coordinates,
     * based on the onset SVG x coordinates and the note SVG x coordinates,
     * stored in the object, and returns an array of warping function values.
     *
     * @returns {Array} of warping function values
     */
    computeWarpingArray() {
        let svgWidth = this._svgViewBox[2] - this._svgViewBox[0];
        // console.debug('onsetSVGXs, ', onsetSVGXs);
        // console.debug('noteSVGXs, ', noteSVGXs);
        // console.debug('noteXs, ', noteXs);
        // console.debug('svgViewBox, ', svgViewBox);
        // console.debug('warpFunc width: ', width);
        let warpArr = [];
        let [j, lastX, lastDiff, currDiff, ip, lastIp] = [0, 0, 0, 0, 0, 0];
        // go through all x values of the SVG and compute an interpolation value ip for each x
        for (let currX = 0; currX < svgWidth; currX++) {
            if (this._noteSVGXs[j] <= currX) {
                lastX = currX;
                j++; // increment j, index into noteSVGXs
            }
            if (j <= 0 || j >= svgWidth) {
                ip = lastIp;
            } else {
                lastDiff = this._onsetSVGXs[j - 1] - this._noteSVGXs[j - 1]; // last Diff (onset minus note x)
                currDiff =
                    this._onsetSVGXs[Math.min(j, this._onsetSVGXs.length - 1)] -
                    this._noteSVGXs[Math.min(j, this._noteSVGXs.length - 1)]; // current Diff (onset minus note x)
                ip = lerp(lastDiff, currDiff, (currX - lastX) / (this._noteSVGXs[j] - this._noteSVGXs[j - 1]));
                if (!ip) ip = lastIp;
            }
            warpArr.push(ip); // - noteheadWidthHalf); // store the warping function value
            lastIp = ip;
            // console.debug('x: ', x + ', j:' + j + ', ' + v1 + '/' + v2 + ', ip:' + ip);
        }
        return warpArr;

        // linear interpolation; t from v0 to v1 - 1
        function lerp(v0, v1, t) {
            return (1 - t) * v0 + t * v1;
        }
    } // computeWarpingArray()

    /**
     * Returns first onset index in the maps file
     * @param {Object} maps
     * @returns
     */
    firstOnsetIdx(maps) {
        let i = 0;
        while (maps[i].obs_mean_onset < 0) i++;
        // console.debug('getFirstOnsetIdx i: ' + i);
        return i;
    } // firstOnsetIdx()

    /**
     * Returns the SVG element for a given id, based either on the id or the data-id attribute
     * @param {string} id
     * @returns
     */
    getElementForId(id) {
        let el = this._svgObj.querySelector(`[*|id="${id}"]`);
        if (!el) {
            el = this._svgObj.querySelector(`[data-id="${id}"]`);
        }
        return el;
    } // getElementForId()

    /**
     * Returns last onset index in the maps file
     * @param {Object} maps
     * @returns
     */
    lastOnsetIdx(maps) {
        let i = maps.length - 1;
        while (maps[i].xml_id[0].includes('trompa')) i--;
        // console.debug('getLastOnsetIdx i: ' + i);
        return i;
    } // lastOnsetIdx()

    /**
     * Computes the median of an array of numbers
     * @param {Array[Number]} numbers
     * @returns {Number} median
     */
    median(numbers) {
        const sorted = Array.from(numbers).sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }

        return sorted[middle];
    } // median()

    /**
     * Removes leading hash from string if present
     * @param {string} hashedString
     * @returns {string} without leading hash
     */
    rmHash(hashedString) {
        if (hashedString.startsWith('#')) {
            return hashedString.split('#')[1];
        } else {
            return hashedString;
        }
    } // rmHash()

    /**
     * Converts SVG x coordinates into screen x coordinates
     * @param {number} x
     * @returns
     */
    svg2screen(x) {
        let newX = (x + this._pageMarginX) * this._svgWidth;
        let viewBoxWidth = this._svgViewBox[2] - this._svgViewBox[0];
        return newX / viewBoxWidth;
    } // svg2screen()

    /**
     * Converts time in seconds to screen coordinate x values
     * @param {number} t time in secods
     */
    time2screen(t) {
        // return (t - this._tmn) / (this._tmx - this._tmn) * (this._lstX - this._fstX) + this._fstX;
        let timeRatio = (t - this._tmn) / (this._tmx - this._tmn);
        let xRatio = this._lstX - this._fstX;
        return timeRatio * xRatio + this._fstX;
    } // time2screen()

    /**
     * Converts time in seconds to svg x coordinates inside pageMargin
     * @param {number} t
     * @returns
     */
    time2svg(t) {
        // return (t - this._tmn) / (this._tmx - this._tmn) *
        //     (this._noteSVGXs[this._noteSVGXs.length - 1] - this._noteSVGXs[0]) + this._noteSVGXs[0];
        let timeRatio = (t - this._tmn) / (this._tmx - this._tmn);
        let svgWidth = this._noteSVGXs[this._noteSVGXs.length - 1] - this._noteSVGXs[0];
        return timeRatio * svgWidth + this._noteSVGXs[0];
    } // time2svg()

    //#endregion Helper Methods



    //#region Shifting Methods

    /**
     * Add a translation to an element node
     * @param {Element} element
     * @param {number} delta
     * @param {Boolean} clearTransforms
     */
    #addTranslation(element, delta, clearTransforms = false) {
        if (clearTransforms) element.transform.baseVal.clear();
        let newTranslate = this._svgObj.createSVGTransform();
        newTranslate.setTranslate(delta, 0);
        element.transform.baseVal.insertItemBefore(newTranslate, 0);
    } // addTranslation()

    /**
     * Shifts element across the x-axis by adding a translation and a scale transformation to it.
     * @param {Element} element
     * @param {number} x1 first x coordinate
     * @param {number} x2 last x coordinate
     * @param {number} xShift1 x shift for x1
     * @param {number} xShift2 x shift for x2
     */
    #shiftElement(element, x1, x2, xShift1, xShift2, verbose = false) {
        let xScale = (x2 + xShift2 - (x1 + xShift1)) / (x2 - x1);
        if (verbose) {
            console.log(
                '#shiftElement x1/x2: ' +
                x1 +
                '/' +
                x2 +
                ', xShift1/xShift2: ' +
                xShift1 +
                '/' +
                xShift2 +
                ', xScale: ' +
                xScale
            );
        }

        // add a transformation, if none exists
        let transformList = element.transform.baseVal; // SVGTransformList
        if (transformList.length === 0) {
            if (xShift1 && xShift1 < Infinity) {
                const translate = this._svgObj.createSVGTransform();
                translate.setTranslate(xShift1, 0);
                transformList.appendItem(translate);
            }
            element.setAttribute('transform-origin', x1);
            if (xScale && xScale < Infinity && xScale > 0) {
                const scale = this._svgObj.createSVGTransform();
                scale.setScale(xScale, 1);
                transformList.appendItem(scale);
            }
        }
    } // shiftElement()

    /**
     * Shifts elements in selector list horizontally by modifying all x coordinates using
     * the warpingFunction delta
     * @param {Array[String]} selectorList
     * @param {Array} warpingFunction
     */
    #shiftElements(selectorList, warpingFunction) {
        for (let selector of selectorList) {
            let list = this._svgObj.querySelectorAll(selector);
            console.debug('Shshshshshshshifting ' + list.length + ' ' + selector + ' elements.');

            list.forEach((item) => {
                // g.arpeg
                if (item.nodeName == 'g' && item.classList.contains('arpeg')) {
                    let x = item.getBBox().x;
                    let xShift = warpingFunction[Math.round(x)];
                    console.debug('shiftElements ARPEG: ', item);
                    this.#addTranslation(item, xShift);
                }
                // g.beam
                else if (item.nodeName == 'g' && item.classList.contains('beam')) {
                    let polygons = item.querySelectorAll('polygon');
                    let stems = item.querySelectorAll('.stem');

                    // find first and last notehead/stem in beam for each polygon
                    polygons.forEach((polygon) => {
                        let leftStem, rightStem;
                        let boundingBox = polygon.getBBox();
                        let leftNote, rightNote;

                        // console.debug('SSSSSSSSS Beam part ', polygon);
                        // console.debug('SSSSSSSSS Stems within beam ', stems);
                        // console.debug('SSSSSSSSS Noteheads within beam ', noteheads);

                        // look for all stems within the beam and find closest left and right stem
                        stems.forEach((stem) => {
                            let stemX = stem.getBBox().x;
                            let threshold = 12; // SVG px
                            if (Math.abs(stemX - boundingBox.x) < threshold) leftStem = stem;
                            else if (Math.abs(stemX - boundingBox.x - boundingBox.width) < threshold) {
                                rightStem = stem;
                            }
                        });

                        // if no left or right stem found, take first and last stem respectively
                        if (!leftStem) leftStem = stems.item(0);
                        if (!rightStem) rightStem = stems.item(stems.length - 1);

                        // for leftStem and rightStem, find a notehead; if in a chord, find closest notehead
                        let leftParent = leftStem.closest('.chord');
                        if (!leftParent) {
                            leftParent = leftStem.closest('.note');
                        }
                        leftNote = leftParent.querySelector('.notehead');
                        let rightParent = rightStem.closest('.chord');
                        if (!rightParent) {
                            rightParent = rightStem.closest('.note');
                        }
                        rightNote = rightParent.querySelector('.notehead');

                        // console.debug('BEAM ShiftPolygon left/right stem: ', leftStem, rightStem);
                        // console.debug('BEAM ShiftPolygon left/right notehead: ', leftNote, rightNote);

                        // shift polygon, x by stems, shift by noteheads
                        if (leftStem && rightStem) {
                            let x1 = leftStem.getBBox().x;
                            let x2 = rightStem.getBBox().x;
                            let xShift1 = warpingFunction[Math.round(x1)];
                            let xShift2 = warpingFunction[Math.round(x2)];
                            if (leftNote) {
                                xShift1 = warpingFunction[Math.round(leftNote.getBBox().x)];
                            }
                            if (rightNote) {
                                xShift2 = warpingFunction[Math.round(rightNote.getBBox().x)];
                            }

                            // console.debug('BEAM ShiftPolygon x1/x2: ' + x1 + '/' + x2 +
                            //     ', xShift1/xShift2: ' + xShift1 + '/' + xShift2);
                            this.#shiftElement(polygon, x1, x2, xShift1, xShift2, false);
                        }
                    });
                }
                // g.note (g.chord) / g.rest
                else if (item.nodeName == 'g' && (item.classList.contains('note') || item.classList.contains('rest'))) {
                    // determine x value of notehead
                    let x = item.getBBox().x;
                    if (item.classList.contains('note')) {
                        // for notes, use notehead x value (to avoid incorrect shifting with accidentals)
                        x = item.querySelector('.notehead use').getBBox().x;
                    }
                    let xShift = warpingFunction[Math.round(x)];

                    let chord = item.closest('.chord');
                    if (chord) {
                        let noteheads = Array.from(chord.querySelectorAll('.notehead'));
                        let chordXs = [];
                        noteheads.map((notehead) => chordXs.push(notehead.getBBox().x));
                        x = this.median(chordXs);
                        xShift = warpingFunction[Math.round(x)];
                        if (chord.transform.baseVal.length === 0) {
                            this.#translate(chord, xShift);
                        }
                    } else {
                        this.#translate(item, xShift); // translate note in combination w\ existing translate
                    }
                }

                // hairpin
                else if (item.nodeName == 'g' && item.classList.contains('hairpin')) {
                    let bbox = item.getBBox();
                    let x1 = bbox.x;
                    let x2 = bbox.x + bbox.width;
                    let xShift1 = warpingFunction[Math.round(x1)];
                    let xShift2 = warpingFunction[Math.round(x2)];
                    this.#shiftElement(item, x1, x2, xShift1, xShift2);
                }

                // shift ledger lines
                else if (
                    item.classList.contains('lineDash') && // is a lineDash class
                    item.closest('.ledgerLines') // within a ledgerLines group
                ) {
                    // find notes referenced in ledger line element, determine their shift, and apply it to ledger line
                    let referencedNoteIds = item.getAttribute('data-related')?.split(' ');
                    referencedNoteIds.forEach((id) => {
                        let note = this.getElementForId(this.rmHash(id));
                        if (note && !item.hasAttribute('transform')) {
                            let notehead = note.querySelector('.notehead');
                            if (notehead) {
                                let x = notehead.getBBox().x;
                                let xShift = warpingFunction[Math.round(x)];
                                this.#translate(item, xShift);
                            }
                        }
                    });
                }

                // slur, barline, staff lines
                else if (item.nodeName == 'path') {
                    if (!item.closest('.note, .chord, .ledgerLines')) {
                        let bbox = item.getBBox();
                        // retrieve parent element's class
                        let parentClass = item.parentElement.className.baseVal;

                        let staff = item.closest('.staff');
                        if (parentClass && !staff) {
                            // console.log('Shift ', parentClass, ': Path BBox(): ', bbox);
                            let x1 = bbox.x;
                            let x2 = bbox.x + bbox.width;

                            // compute transform values
                            let xShift1 = warpingFunction[Math.round(x1)]; // delta pixels to shift element
                            let xShift2 = warpingFunction[Math.round(x2)];

                            this.#shiftElement(item, x1, x2, xShift1, xShift2);
                        }
                    }
                } else if (item.nodeName == 'line') {
                    let x1 = parseFloat(item.getAttribute('x1'));
                    let x2 = parseFloat(item.getAttribute('x2'));
                    let xShift1 = warpingFunction[Math.round(x1)];
                    let xShift2 = warpingFunction[Math.round(x2)];
                    this.#shiftElement(item, x1, x2, xShift1, xShift2);
                }

                // rect, use, text, ellipse, circle
                else {
                    // if not within these elements, shift element
                    if (
                        !item.closest('.chord') &&
                        !item.closest('.note') &&
                        !item.closest('.arpeg') &&
                        !item.closest('.rest') &&
                        !item.closest('.hairpin')
                    ) {
                        console.debug('Shift ', item, 'inside ', item.parentElement);
                        let attribute = 'x';
                        if (item.nodeName == 'ellipse' || item.nodeName == 'circle') {
                            attribute = 'cx';
                        }
                        let x = parseFloat(item.getAttribute(attribute));
                        let xShift = warpingFunction[Math.round(x)];
                        this.#translate(item, xShift);
                    }
                }
            });
        }
    } // shiftElements()

    /**
     * Translates item object, checking if a translate is already there.
     * @param {Element} item
     * @param {number} delta
     * @param {Boolean} useExisting
     */
    #translate(item, delta) {
        let existingX = 0;
        let transformList = item.transform.baseVal; // SVGTransformList

        if (transformList && transformList.length > 0) {
            // if transform exists
            // console.debug('SVGTransformList EXISTING: ', transformList);
            let index = -1;
            for (let currTrans of transformList) {
                index++;
                // trList.forEach((currTrans, i) => {
                if (currTrans.type === SVGTransform.SVG_TRANSFORM_TRANSLATE) {
                    // console.debug('TRANSLATION FOUND: ', item);
                    existingX = currTrans.matrix.e;
                    break;
                }
            }
            transformList.getItem(index).setTranslate(existingX + delta, 0);
        } else {
            // create new transform
            // console.debug('SVGTransformList EMPTY: ', transformList);
            let translate = this._svgObj.createSVGTransform();
            translate.setTranslate(existingX + delta, 0);
            transformList.appendItem(translate);
        }
    } // translate()

} // ScoreWarper class
