const assert = require('assert');
const http = require('http');
const BrowshotEvents = require('../index');

describe('API 2.0 events', function () {
	let client;
	beforeEach(function () {
		client = new BrowshotEvents('test-key');
		client.defaults = { timeout: 1, interval: 0.001 };
	});

	it('polls shared screenshot info without sending details by default', function (done) {
		client.browshot.screenshotCreate = (args, callback) => {
			assert.strictEqual(args.country, 'fr');
			setImmediate(() => callback({ id: 123, status: 'in_queue' }));
		};
		client.browshot.screenshotInfo = (id, args, callback) => {
			assert.strictEqual(id, 123);
			assert.deepStrictEqual(args, {});
			callback({ id, status: 'finished' });
		};
		client.screenshotCreate({ url: 'https://example.com', country: 'fr' }).on('finished', () => done());
	});

	it('polls mixed versions with each request’s own options', function (done) {
		let nextId = 123;
		const polls = {};
		client.browshot.screenshotCreate = (args, callback) => {
			const id = nextId++;
			setImmediate(() => callback({ id, status: 'in_queue' }));
		};
		client.browshot.screenshotInfo = (id, args, callback) => {
			polls[id] = args;
			callback({ id, status: 'finished' });
		};
		client.screenshotCreateMultiple([
			{ url: 'https://example.com', instance_id: 373, details: 2, api_version: 1 },
			{ url: 'https://example.net', country: 'fr' }
		]).on('complete', screenshots => {
			assert.deepStrictEqual(polls, { 123: { details: 2, api_version: 1 }, 124: {} });
			assert.deepStrictEqual(screenshots.map(screenshot => screenshot.original_url), ['https://example.com', 'https://example.net']);
			done();
		});
	});

	it('keeps legacy event metadata and uses v2 for modern captures in the same batch', async function () {
		const paths = [];
		const server = http.createServer((request, response) => {
			const query = new URL(request.url, 'http://localhost');
			const legacy = query.pathname.startsWith('/api/v1/');
			const create = query.pathname.endsWith('/create');
			paths.push(query.pathname);
			const shot = { id: legacy ? 123 : 124, status: create ? 'in_process' : 'finished' };
			if (legacy) shot.instance_id = 373;
			response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(shot));
		});
		await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			client.browshot.base = 'http://127.0.0.1:' + server.address().port + '/api/v2';
			const screenshots = await new Promise((resolve, reject) => client.screenshotCreateMultiple([
				{ url: 'https://example.com', instance_id: 373 },
				{ url: 'https://example.net', browser: 'brave' }
			]).once('complete', resolve).once('failed', reject).once('timeout', reject));
			assert.deepStrictEqual(paths.sort(), ['/api/v1/screenshot/create', '/api/v1/screenshot/info',
				'/api/v2/screenshot/create', '/api/v2/screenshot/info']);
			assert.strictEqual(screenshots.find(screenshot => screenshot.id === 123).instance_id, 373);
			assert.strictEqual(screenshots.find(screenshot => screenshot.id === 124).original_url, 'https://example.net');
		} finally {
			await new Promise(resolve => server.close(resolve));
		}
	});

	it('completes when a v2 poll fails without a status or screenshot ID', function (done) {
		client.browshot.screenshotCreate = (args, callback) => {
			setImmediate(() => callback({ id: 123, status: 'in_queue' }));
		};
		client.browshot.screenshotInfo = (id, args, callback) => callback({ success: false, error: 'NOT_FOUND' });
		let failures = 0;
		client.screenshotCreateMultiple([{ url: 'https://example.com', country: 'fr' }])
			.on('failed', error => {
				assert.strictEqual(error.error, 'NOT_FOUND');
				failures++;
			})
			.on('complete', screenshots => {
				assert.strictEqual(failures, 1);
				assert.strictEqual(screenshots[0].id, 123);
				assert.strictEqual(screenshots[0].status, 'error');
				done();
			});
	});
});
