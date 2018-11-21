/**
 * @mooxed/fire-data-modeler 1.3.0 ( 2018-11-21 )
 * https://github.com/marcocavanna/FireDataModeler
 * 
 */
const FireDataModeler = require('./class/fire.data.modeler');

(function moduleInit() {

  /**
   * Init WeakMap to mantain certain property
   * private and not accessible from outside
   */
  global._dataModeler = new WeakMap();
  global._firebaseAdmin = new WeakMap();
  global._pathReplacers = new WeakMap();
  global._models = new WeakMap();
  global._functions = new WeakMap();
  global._filters = new WeakMap();
  global._cache = new WeakMap();
  
  /**
   * Export the Module
   */
  module.exports = FireDataModeler;

}).call(this);
