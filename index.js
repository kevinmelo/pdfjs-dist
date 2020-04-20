'use strict';

let pdfjsLib = require('pdfjs/lib/pdf');
// eslint-disable-next-line import/no-webpack-loader-syntax
let PdfjsWorker = require('worker-loader!pdfjs/lib/pdf.worker');

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();
