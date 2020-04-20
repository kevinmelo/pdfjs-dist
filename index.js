'use strict';

let pdfjsLib = require('./lib/pdf');
// eslint-disable-next-line import/no-webpack-loader-syntax
let PdfjsWorker = require('worker-loader!./lib/pdf.worker');

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

module.exports = pdfjsLib;
