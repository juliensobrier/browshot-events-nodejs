'use strict';

const browshot = require('browshot');
const events = require('events');


const defaults = {
	timeout: 60 * 5,
	interval: 1,
};


BrowshotEvents.prototype.info = function(/**/) {
	var args = Array.prototype.slice.call(arguments);

	if (this.debug) {
		console.log(args.join(''));
	};
}

BrowshotEvents.prototype.error = function(/**/) {
	var args = Array.prototype.slice.call(arguments);
	
	console.log('ERROR ' + args.join(''));
}

/**
 * This is an event-driven version of the browshot Node.js library. This module should make it easier to use the asynchronous API.
 * This module gives access to the underlying browshot modules through this.browshot.
 * 
 * The source code is available on github at https://github.com/juliensobrier/browshot-nodejs-events.
 * 
 * Constructor for the Nodejs BrowshotEvents this. You can find code samples at http://browshot.com/api/documentation
 * @link http://browshot.com/api/documentation
 * @param  {String}   key   Your API key. Required.
 * @param  {Boolean}  debug Turn on debugging messages. optional
 */
function BrowshotEvents(key, debug = false) {
	this.defaults = defaults;
	this.browshot = new browshot(key, debug);
}

/**
 * Change the default settings:
 * timeout: number of seconds before giving up
 * interval: number of seconds to wait before calling screenshotInfo
 * @param  {Object}   args   List of new setting values
 */
BrowshotEvents.prototype.setDefaults = function(args) {
	this.defaults = Object.assign(defaults, args);
}


/**
 * Request a screenshot. Fires the following events:
 *   in_queue: the screenshot was added to the queue
 *   in_process: the screenshot is being processed
 *   finished: the screenshot is finished
 *   failed: the screenshot failed
 *   timeout: the screenshot took too long to finish based on the default timeout
 * @link http://browshot.com/api/documentation#screenshot_create
 * @param  {Object}   args   List of screenshots details +  + original_url
 */
BrowshotEvents.prototype.screenshotCreate =  function(args = { }) {
	var eventEmitter = new events.EventEmitter();
	
	var start = new Date();
	const original_url = args.url || '';
	
	function checkStatus(id, that) {
// 	console.log(`Checking status for screenshot ${id}`);
		
	that.client.screenshotInfo(id, { details: args.details || 0 }, function(screenshot) {
			screenshot.original_url = original_url;

			if (screenshot.status == 'error')
				eventEmitter.emit('failed', screenshot);
			else
				eventEmitter.emit(screenshot.status, screenshot);
			
			if (screenshot.status == 'finished' || screenshot.status == 'error') {
				eventEmitter.removeAllListeners();
			}	
			else if (checkTimeout(screenshot, that)) {
				// nothing to do
			}
			else {
				// Keep checking
				setTimeout(checkStatus, this.defaults.interval * 1000, screenshot.id, that);
			}
		});
	}
	
	function checkTimeout(screenshot, that) {
		var now = new Date();
			
		var elapsed = now - start; //in ms
		if (elapsed >= that.defaults.timeout * 1000) {
			eventEmitter.emit('timeout', screenshot);
			eventEmitter.removeAllListeners();
			
			return true;
		}
		
		return false;
	}
	
	this.browshot.screenshotCreate(args, (screenshot) => {
		screenshot.original_url = original_url;

		if (screenshot.status == 'error')
			eventEmitter.emit('failed', screenshot);
		else
			eventEmitter.emit(screenshot.status, screenshot);
		
		if (screenshot.status == 'finished' || screenshot.status == 'error') {
			eventEmitter.removeAllListeners();
		}
		else if (checkTimeout(screenshot)) {
			// nothing to do
		}
		else {
			// Keep checking
			setTimeout(checkStatus, this.defaults.interval * 1000, screenshot.id, this);
		}
	});
	
	return eventEmitter;
}

/**
 * Request multiple screenshots. This function makes multiple call to screenshot/create and does not use screenshot/multiple. 
 * This means it is not subject to the limitations of screenshot/multiple: more than 1 URLs is possible, all screenshots can have different settings, etc.
 * Fires the following events:
 *   in_queue: a screenshot was added to the queue
 *   in_process: a screenshot is being processed
 *   finished: a screenshot is finished
 *   failed: a screenshot failed
 *   timeout: at least one screenshot took too long to finish based on the default timeout (fired once)
 *   complete: all screenshots are done (finished, failed or timeout)  (fired once)
 * @link http://browshot.com/api/documentation#screenshot_create
 * @param  {Array}    args   List of screenshots requests
 * @param  {Object}   common Common properties of all screenshot requests + original_url
 * @param  {Number}   delayScreenshot Insert a delay (in seconds) between 2 screenshot request (default: 0 second)
 * @param  {Boolean}  successive Wait for previous screenshot to be done (finished or error) before requesting the next one (default: false)
 */
BrowshotEvents.prototype.screenshotCreateMultiple =  function(args = [], common = { }, delayScreenshot = 0, successive = false) {
	var eventEmitter = new events.EventEmitter();
	var start = new Date();
	var screenshots = [];
	
	var details = common.details || 0;
	
	// Make list of screenshot requests
	args.forEach(async (request, index) => {
		request = Object.assign(Object.assign({}, common), request);
		var original_url = request.url || '';
		
		if (request.details && request.details > details) {
				details = request.details;
		}

		if (delayScreenshot > 0 & index > 0) {
			await sleep(delayScreenshot * 1000);
			start = new Date(); // reset the timer
		}

		if (index > 0 && successive) {
			var complete = checkCompleted(false, this); // completed so far?
			while(!complete || index != screenshots.length) {
				await sleep(1 * 1000); // Can do check more often, no API call done
				complete = checkCompleted(false, this);
			}

			start = new Date(); // reset the timer
		}
		
		this.browshot.screenshotCreate(request, (screenshot) => {
			screenshot.original_url = original_url;
			screenshots.push(screenshot);
			
			if (screenshot.status == 'error')
				eventEmitter.emit('failed', screenshot);
			else
				eventEmitter.emit(screenshot.status, screenshot);

			
			if (screenshot.status == 'finished' || screenshot.status == 'error') {
				checkCompleted(true, this);
			}
			else if (checkTimeout(this)) {
				// nothing to do
			}
			else {
				// Keep checking
				setTimeout(checkStatus, this.defaults.interval * 1000, screenshot, this);
			}
		});
	});
	
	function checkStatus(request, that) {		
		that.browshot.screenshotInfo(request.id, { details: details }, function(screenshot) {
			screenshot.original_url = request.original_url;

			for(var i in screenshots) {
				if (screenshots[i].id == screenshot.id) {
						screenshots[i] = Object.assign(screenshots[i], screenshot);
				}
			}
			
			if (screenshot.status == 'error')
				eventEmitter.emit('failed', screenshot);
			else
				eventEmitter.emit(screenshot.status, screenshot);
			
			if (screenshot.status == 'finished' || screenshot.status == 'error') {
				checkCompleted(true, that);
			}	
			else if (checkTimeout(that)) {
				// nothing to do
			}
			else {
				// Keep checking
				setTimeout(checkStatus, this.defaults.interval * 1000, screenshot, that);
			}
		});
	}
	
	function checkCompleted(debug = true, that) {
		var complete = true;
		
		screenshots.forEach((screenshot) => {
			if (screenshot.status != "finished" &&  screenshot.status != "error") {
					complete = false;
					if (debug)
						that.info(`Screenshot ${screenshot.id} is not finished: ${screenshot.status} `); 
			}
		});
		
		if (complete) {
			// required if all screenshots already in cache
			if (screenshots.length == args.length) {
				eventEmitter.emit('complete', screenshots);
				that.info("All screenshots are complete");
				eventEmitter.removeAllListeners();
			}
		}
		
		return complete;
	}
	
	function checkTimeout(that) {
		var now = new Date();
			
		var elapsed = now - start; //in ms
		if (elapsed >= that.defaults.timeout * 1000) {
			eventEmitter.emit('timeout', screenshots);
			eventEmitter.removeAllListeners();
			
			return true;
		}
		
		return false;
	}
	
	function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
	
	return eventEmitter;
}

/**
 * Retrieve the screenshot, or a thumbnail, and save it to a file.
 * @link http://browshot.com/api/documentation#thumbnails
 * @param  {Number}   id          Screenshot ID. Required. 
 * @param  {String}   file        Local file name to write the thumbnail to. Required. 
 * @param  {Object}   args        arguments. Optional.
 * @return {Object}   Return a Promise with the file name as argument.
 */
BrowshotEvents.prototype.saveThumbnail = function(id = 0, file = '', args = { }, resolve, reject) {
	var client = this.browshot;
	return new Promise(function(resolve, reject) {
		client.screenshotThumbnailFile(id, file, args, function(newFile) {
			if (newFile == '') {
				reject(file);
			}
			else {
					resolve(newFile);
			}
		});
	});	
}

/**
 * Retrieve the screenshot or a thumbnail
 * @link http://browshot.com/api/documentation#thumbnails
 * @param  {Number}   id          Screenshot ID. Required. 
 * @param  {Object}   args        arguments. Optional.
 * @return {Object}   Return a Promise with the image.
 */
BrowshotEvents.prototype.screenshotThumbnail = function(id = 0, args = { }, resolve, reject) {
	var client = this.browshot;
	return new Promise(function(resolve, reject) {
		client.screenshotThumbnail(id, args, function(image) {
			if (image == '') {
				reject(image);
			}
			else {
				resolve(image);
			}
		});
	});
}

/**
 * Retrieve the screenshot or a thumbnail
 * @link http://browshot.com/api/documentation#thumbnails
 * @param  {Number}   id          Screenshot ID. Required. 
 * @param  {Object}   args        arguments. Optional.
 * @return {Object}   Return a Promise with the image and shot as arguments.
 */
BrowshotEvents.prototype.shotThumbnail = function(id = 0, args = { }, resolve, reject) {
	var client = this.browshot;
	return new Promise(function(resolve, reject){
		client.screenshotThumbnail(id, args, function(image) {
			if (image == '') {
				reject([image, args.shot || 1]);
			}
			else {
				resolve([image, args.shot || 1]);
			}
		});
	});
}


module.exports = BrowshotEvents;