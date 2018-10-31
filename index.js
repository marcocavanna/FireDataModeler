/**
 * Init WeakMap to mantain certain property
 * private and not accessible from outside
 */
global._dataModeler = new WeakMap();
global._firebaseAdmin = new WeakMap();
global._pathReplacers = new WeakMap();
global._bindings = new WeakMap();
global._models = new WeakMap();
global._functions = new WeakMap();
global._filters = new WeakMap();

/**
 * Export the Module
 */
module.exports = require('./class/fire.data.modeler');
