/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var SwaggerParser = require('swagger-parser');
var CodeGen = require('swagger-js-codegen').CodeGen;
var _ = require('lodash');

function gulpSwagger(opts) {
	return through.obj(objectStream);

	function objectStream(file, enc, cb) {
		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-swagger', 'Streaming not supported'));
			cb();
		}

		var fileBaseName = path.basename(path.basename(file.path, ".yaml"), ".json");
		var swaggerBaseName = _.upperFirst(_.camelCase(fileBaseName));

		SwaggerParser.validate(file.path).then(
			function(api) {
				var codegenOptions = _.extend({
					swagger: api,
					moduleName: swaggerBaseName + 'Module',
					className: swaggerBaseName
				}, opts);
				var generatedCode = CodeGen.getCustomCode(codegenOptions);

				this.push(new gutil.File({
					path: gutil.replaceExtension(file.path, '.js'),
					base: file.base,
					contents: new Buffer(generatedCode)
				}));

				cb();
			}.bind(this)
		).then(
			null,

			function(error) {
				error.fileName = file.path;
				console.log("gulp-swagger error", error, error.stack)
				this.emit('error', error);
				cb();
			}.bind(this)
		);
	}
}

module.exports = gulpSwagger;
