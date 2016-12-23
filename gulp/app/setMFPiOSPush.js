/*
 * Copyright (c) 2015-2017 PointSource, LLC.
 * MIT Licensed
 */

'use strict';

var path = require('path');
var fs = require('fs');
var et = require('elementtree');
var del = require('del');
var utils = require('../utils');


function setMFPiOSPush() {
	var envConfig = utils.getEnvConfig();
	var cliOptions = utils.getCommandLineOptions();
	var generatorConfig = utils.getGeneratorConfig();

	var pushPassword;
	if ("pushPassword" in envConfig.appConfig)
		pushPassword = envConfig.appConfig.pushPassword;
	if ("PUSH_PASSWORD" in process.env)
		pushPassword = process.env.PUSH_PASSWORD;
	if ("pushpass" in cliOptions)
		pushPassword = cliOptions.pushpass;

	var pushCertFile = envConfig.appConfig.pushCertFile;

	if (!pushPassword || !pushCertFile)
		return;

	// Add the password to application-descriptor.xml
	var applicationDescriptorFilename = path.join(generatorConfig.cordovaDirectory, 'application-descriptor.xml');
	var appDescriptorXml = new et.ElementTree(et.XML(fs.readFileSync(applicationDescriptorFilename, "utf-8").replace(/^\uFEFF/, "")));

	var pushSenderTag = appDescriptorXml.find('iphone/pushSender');
	if (!pushSenderTag)
		pushSenderTag = et.SubElement(appDescriptorXml.find('iphone'), 'pushSender');

	pushSenderTag.set('password', pushPassword);

	fs.writeFileSync(applicationDescriptorFilename, appDescriptorXml.write({
		indent: 4
	}), "utf-8");

	// Copy the certificate to the correct place.
	del.sync(path.join(generatorConfig.cordovaDirectory, 'apns-certificate-production.p12'));
	del.sync(path.join(generatorConfig.cordovaDirectory, 'apns-certificate-sandbox.p12'));

	var outputFilename;
	if (utils.getBuildType() == 'release')
		outputFilename = path.join(generatorConfig.cordovaDirectory, 'apns-certificate-production.p12');
	else
		outputFilename = path.join(generatorConfig.cordovaDirectory, 'apns-certificate-sandbox.p12');
	var data = fs.readFileSync(pushCertFile);
	fs.writeFileSync(outputFilename, data);
}


module.exports = setMFPiOSPush;
