import '@testing-library/jest-dom'

// Ensure jsdom globals are available for integration tests
if (typeof document === 'undefined') {
  const { JSDOM } = require('jsdom')
  const jsdom = new JSDOM('<!doctype html><html><body></body></html>')
  const { window } = jsdom
  global.window = window as any
  global.document = window.document as any
  global.navigator = window.navigator as any
}
