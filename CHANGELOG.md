# Changelog

## 1.4.0

- Add screenshotPdf, screenshotVideo, savePdf and saveVideo Promises for API 1.32.
- Require browshot ^1.32.0 for the new download methods.
- Fix screenshotCreate polling to use the underlying browshot client and pass the client to the timeout check.
- Document PDF, WebM/MP4/GIF, retina, ad blocking and country instance selection.
- Add event and Promise regression tests and opt-in live artifact tests.
