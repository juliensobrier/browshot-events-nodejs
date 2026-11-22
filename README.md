browshot-events
================================

Browshot ( https://browshot.com/ ) is a web service to easily make screenshots of web pages in any screen size, as any device: iPhone, iPad, Android, PC, etc. Browshot has full Flash, JavaScript, CSS, & HTML5 support.

The latest API version is detailed at https://browshot.com/api/documentation. This module works on top of the browshot library (https://www.npmjs.com/package/browshot) to provide an event interface. It makes it much easier to follow the stages of a screenshot: in_queue, in_process, finished or failed:

    'use strict';
    var browshot = require('browshot-events');

    var client = new browshot('my_key');
    client.setDefaults({ timeout: 60 * 60, interval: 10 });

    client.screenshotCreate({ 'url': 'https://www.google.com/', 'instance_id': 12 })
	    .once('in_queue', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} is in queue`);
	    })
	    .once('in_process', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} is in process`);
	    })
	    .on('finished', (screenshot) => {
		     console.log(`Screenshot ${screenshot.id} is finished`);
		
 		     client.saveThumbnail(screenshot.id, 'google.png')
 			    .then((file) => { console.log(`Screenshot saved to ${file}`); })
 			    .catch((file) => { console.log(`Failed to save to ${file}`); });
	    })
	    .on('failed', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} failed`);
	    })
	    .on('timeout', (screenshot) => {
		    console.log(`Screenshot ${screenshot.id} is taking too long`);
	    });

This module implements only some of the API functions, those that fit the event model. You can access the underlying browshot module with client.browshot.


You can install the library from npm: https://www.npmjs.com/package/browshot-events

The source code can be found on github at https://github.com/juliensobrier/browshot-events-nodejs



INSTALLATION

    npm build && npm install


DEPENDENCIES

The following npm modules are required to run browshot-events

    browshot
    events


API 1.32

Version 1.4.0 requires browshot 1.32.0 or newer within version 1.x. screenshotCreate and screenshotCreateMultiple pass the new PDF, retina, video and hide_ads arguments through without changing their event interface. Use instance_id for additional countries.

    client.screenshotCreate({ url: 'https://example.com/', instance_id: 373, pdf: 1, hide_ads: 1 })
        .on('finished', function(screenshot) {
            client.savePdf(screenshot.id, 'example.pdf')
                .then(function(file) { console.log(file); })
                .catch(function(file) { console.error('Could not save ' + file); });
        })
        .on('failed', function(screenshot) { console.error(screenshot); })
        .on('timeout', function(screenshot) { console.error('Timed out: ' + screenshot.id); });

New Promise methods:

    client.screenshotPdf(id, {});              // resolves with a PDF Buffer
    client.screenshotVideo(id, {});            // resolves with a WebM, MP4 or GIF Buffer
    client.savePdf(id, 'example.pdf', {});      // resolves with the saved filename
    client.saveVideo(id, 'example.webm', {});   // resolves with the saved filename

Download Promises reject with an empty string on failure. File Promises reject with the requested filename, matching saveThumbnail. File helpers require an existing parent directory. MP4 requests can fall back to WebM; the supplied filename is not changed automatically.

Set pdf=1 or video=1 when creating the screenshot and wait for finished before downloading. Video supports video_format=webm, mp4 or gif; duration is 1-30 seconds. PDF and video require paid Chrome-based instances. PDF adds 1 credit and video adds one credit per started 5 seconds. device_scale=2 and hide_ads=1 have no extra charge; retina cannot be combined with video. The underlying callback API remains available as client.browshot.

TESTING

    npm install
    npm test

Unit tests stub capture responses. Opt-in artifact checks use BROWSHOT_LIVE_TESTS=1, BROWSHOT_API_KEY, and owned, finished captures identified by BROWSHOT_PDF_ID, BROWSHOT_WEBM_ID, BROWSHOT_MP4_ID and BROWSHOT_GIF_ID. They download existing artifacts without creating new captures.
