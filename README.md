# Browshot Events for Node.js

Browshot captures web pages as screenshots, PDFs, and videos. This module wraps the `browshot` client with capture events and download Promises. A capture can emit `in_queue`, `in_process`, `finished`, `failed`, or `timeout`.

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

    npm install browshot-events


DEPENDENCIES

The following npm modules are required to run browshot-events

    browshot
    events


## API 2.0

Version 2.0.0 uses `browshot` 2.x. Captures with `instance_id` or other legacy options use v1 and keep the v1 metadata when polled. Use `browser`, `country`, and viewport or `device` settings to create v2 captures. A call to `screenshotCreateMultiple` can mix both kinds of request.

    client.screenshotCreate({ url: 'https://example.com/', browser: 'brave', country: 'fr' })
        .on('finished', function(screenshot) { console.log(screenshot.id); });

Use `client.browshot` for v2 device discovery, tag listing, batch ZIP downloads, and app management. See the [API v1 reference](https://browshot.com/api/documentation/) and the [API v2 reference](https://browshot.com/api/documentation-v2/).

### PDF and video downloads

    client.screenshotCreate({ url: 'https://example.com/', instance_id: 373, pdf: 1, hide_ads: 1 })
        .on('finished', function(screenshot) {
            client.savePdf(screenshot.id, 'example.pdf')
                .then(function(file) { console.log(file); })
                .catch(function(file) { console.error('Could not save ' + file); });
        })
        .on('failed', function(screenshot) { console.error(screenshot); })
        .on('timeout', function(screenshot) { console.error('Timed out: ' + screenshot.id); });

Download and file helpers.

    client.screenshotPdf(id, {});              // resolves with a PDF Buffer
    client.screenshotVideo(id, {});            // resolves with a WebM, MP4 or GIF Buffer
    client.savePdf(id, 'example.pdf', {});      // resolves with the saved filename
    client.saveVideo(id, 'example.webm', {});   // resolves with the saved filename

Download Promises reject with an empty string on failure. File Promises reject with the requested filename, matching saveThumbnail. File helpers require an existing parent directory. MP4 requests can fall back to WebM; the supplied filename is not changed automatically.

Set `pdf: 1` or `video: 1` when creating the screenshot and wait for `finished` before downloading. Video supports WebM, MP4, or GIF and requires `device_scale: 1`. Use Chrome or Brave for PDF and video in v2, or a paid Chrome-based instance in v1.

## Tests

Run `npm test` after installing the dependencies. Live artifact tests use `BROWSHOT_LIVE_TESTS=1`, `BROWSHOT_API_KEY`, and finished captures identified by `BROWSHOT_PDF_ID`, `BROWSHOT_WEBM_ID`, `BROWSHOT_MP4_ID`, and `BROWSHOT_GIF_ID`.
