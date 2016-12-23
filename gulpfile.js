/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

 /**
 *  PointSource BlueOak gulp build system
 */

'use strict';

var requireDir = require('require-dir');

/**
 *  This will load all js files in the gulp directory
 *  in order to load all gulp tasks.
 */
requireDir('./gulp');
