# Changelog

## 2.0.0

- Use Browshot 2.0 for automatic v1 and v2 routing.
- Keep legacy captures on v1 when polling events and support mixed v1 and v2 captures in a single batch.
- Report v2 API errors through the existing failed event.

## 1.4.0

- Add screenshotPdf, screenshotVideo, savePdf and saveVideo Promises for API 1.32.
- Require browshot ^1.32.0 for the new download methods.
- Fix screenshotCreate polling to use the underlying browshot client and pass the client to the timeout check.
- Document PDF, WebM/MP4/GIF, retina, ad blocking and country instance selection.
- Add event and Promise regression tests and opt-in live artifact tests.
