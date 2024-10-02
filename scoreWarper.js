/**
 * @description: scoreWarper.js
 * @version: 1.0.0
 * Warps an score SVG notation file engraved by Verovio to a given time warping function. 
 * The time warping function is given as a list of time points and corresponding time warping factors.
 */

// TODO: next: move loadPerformanceTiming() to this file


class ScoreWarper {

    constructor(svgObject = undefined, maps = undefined) {
        this._svgObj = svgObject; // store the original SVG object
        this._warpedSvgObj = { ...svgObject };
        this._timeWarpingFunction = undefined; // store the time warping function
        this._maps = maps; // store the maps file content
        this.calculateScoreCoordinates();
    }; // constructor()


    /**
     * Calculates the SVG coordinates of the score. Called only once when the object is created.
     */
    calculateScoreCoordinates() {
        this._svgWidth = parseFloat(this._svgObj.getAttribute('width'));
        this._svgHeight = parseFloat(this._svgObj.getAttribute('height'));
        this._svgViewBox = this._svgObj.querySelector('svg[viewBox]').getAttribute('viewBox');
        this._svgViewBox = this._svgViewBox.split(' ').map(Number);
        let pageMarginElement = this._svgObj.querySelector('.page-margin');
        let transformations = pageMarginElement.transform.baseVal;
        console.info('svgObj: ', this._svgObj);
        console.info('svgObj width: ', this._svgWidth);
        console.info('svgObj viewBox: ', this._svgViewBox);
        console.info('svgObj transform: ', pageMarginElement.transform);
        console.info('svgObj transform bsVl: ', transformations.getItem(0));
        this._pageMarginX = transformations.getItem(0).matrix.e;
    } // calculateScoreCoordinates()


    //#region Getters

    /**
     * Get the maps file content
     */
    get maps() {
        return this._maps;
    }

    /**
     * Get page margin X coordinate
     */
    get pageMarginX() {
        return this._pageMarginX;
    }

    /**
     * Get the SVG width
     */
    get svgWidth() {
        return this._svgWidth;
    }

    /**
     * Get the SVG height
     */
    get svgHeight() {
        return this._svgHeight;
    }

    /**
     * Get the original SVG object
     */
    get svgObj() {
        return this._svgObj;
    }

    /**
     * Get the SVG viewBox
     */
    get svgViewBox() {
        return this._svgViewBox;
    }

    /**
     * Get the time warping function
     */
    get timeWarpingFunction() {
        return this._timeWarpingFunction;
    }

    /**
    * Get the warped SVG object
    */
    get warpedSvgObj() {
        return this._warpedSvgObj;
    }

    //#region Setters

    /**
     * Set the maps file content
     */
    set maps(maps) {
        this._maps = maps;
    }

    /**
     * Set the time warping function
     */
    set timeWarpingFunction(timeWarpingFunction) {
        this._timeWarpingFunction = timeWarpingFunction;
    }
} // ScoreWarper class