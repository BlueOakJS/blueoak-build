/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var fs = require('fs');
var path = require('path');
var process = require('process');
var conf = require('./conf');
var yargs = require('yargs');
var chalk = require('chalk');
var _ = require('lodash');
var Q = require('q');
var runSequence = require('run-sequence');
var eos = require('end-of-stream');
var consume = require('stream-consume');

var selectedConfig;
var argv;

var appTypeChoices = {
	spa: 'SPA only',
	mfp: 'SPA and IBM MobileFirst Platform Foundation application',
	cordova: 'SPA and Cordova hybrid application'
};

var clientServerChoices = {
	client: 'Client-side Only',
	server: 'Server-side Only',
	both: 'Full Stack'
};

function getCommandLineOptions() {
	if (!argv) {
		argv = yargs.options({
			'd': {
				alias: 'deploymentConfig',
				default: 'local',
				requiresArg: true,
				type: 'string'
			},
			'release': {
				type: 'boolean'
			},
			'debug': {
				type: 'boolean'
			},
			'profile': {
				requiresArg: true,
				type: 'string'
			},
			'device': {
				type: 'boolean'
			},
		}).argv;
	}

	if (argv.debug && argv.release) {
		console.log(chalk.red.bold('You can\'t specify both debug and release on the command line.'));
		throw new Error('You can\'t specify both debug and release on the command line.');
	}

	return argv;
}


function getEnvConfig() {
	if (!selectedConfig) {
		var argv = getCommandLineOptions();

		var env = argv.d;

		var deploymentConfig = 	JSON.parse(
									fs.readFileSync(
										path.join(process.cwd(), conf.paths.src, 'app.config.json')
									)
								);

		if (!(env in deploymentConfig)) {
			console.log(chalk.red.bold('Cannot find environment: ' + env));
			throw new Error('Cannot find environment: ' + env);
		}

		selectedConfig = {
			appConfig: _.extend({}, deploymentConfig[env], {
				envName: env
			})
		};
	}

	return selectedConfig;
}


function getBuildType() {
	var argv = getCommandLineOptions();
	var config = getEnvConfig();

	// Default to debug.
	var buildType = 'debug';

	// If build type is specified in the config, use that.
	if (config.appConfig && config.appConfig.buildType)
		 buildType = config.appConfig.buildType;

	// Allow overriding on the CLI.
	if (argv.release)
		buildType = 'release';
	if (argv.debug)
		buildType = 'debug';

	return buildType;
}


function getGeneratorConfig() {
	var yorc = JSON.parse(
							fs.readFileSync(
								path.join('..', '.yo-rc.json')
							)
						);

	return yorc['generator-blueoak'];
}


function streamToPromise(stream) {
	var deferred = Q.defer();

	eos(stream, {
		error: true,
		readable: stream.readable,
		writable: stream.writable && !stream.readable
	}, function(err) {
		if (err)
			deferred.reject(err);
		else
			deferred.resolve();
	});

	// Ensure that the stream completes
	consume(stream);

	return deferred.promise;
}


exports.getCommandLineOptions = getCommandLineOptions;
exports.getEnvConfig = getEnvConfig;
exports.getBuildType = getBuildType;
exports.getGeneratorConfig = getGeneratorConfig;
exports.appTypeChoices = appTypeChoices;
exports.clientServerChoices = clientServerChoices;
exports.streamToPromise = streamToPromise;
