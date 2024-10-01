/**
 * @description: svgWarper.js
 * @version: 1.0.0
 * Warps an SVG notation file engraved by Verovio to a given time warping function. 
 * The time warping function is given as a list of time points and corresponding time warping factors.
 */


export default class SvgWarper {

    constructor(svgObject = undefined, timeWarpingFunction = undefined) {
        this.svgObj = svgObject; // store the original SVG object
        this.warpedSvgObj = { ...svgObject };
        this.timeWarpingFunction = timeWarpingFunction;
    }; // constructor()


} // class SvgWarper