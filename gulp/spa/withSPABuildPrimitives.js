/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var conf = require('../conf');
var utils = require('../utils');
var withDebugSPABuildPrimitives = require('./withDebugSPABuildPrimitives');
var withReleaseSPABuildPrimitives = require('./withReleaseSPABuildPrimitives');


var $ = require('gulp-load-plugins')({
	pattern: ['gulp-*', 'del']
});


function clean() {
	return $.del([path.join(this.distDir), path.join(conf.paths.src, 'generated')]);
}


function withSPABuildPrimitives() {
	this.clean = clean;
	if (!this.distDirs)
		this.distDirs = {};
	this.distDirs.spa = conf.paths.dist;
	this.setDistDir(this.distDirs.spa);
	this.platformType = 'spa';
	this.platformFilesToInject = [];

	if (utils.getBuildType() == 'release')
		withReleaseSPABuildPrimitives.call(this);
	else
		withDebugSPABuildPrimitives.call(this);
}

module.exports = withSPABuildPrimitives;
