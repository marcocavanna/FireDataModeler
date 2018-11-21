/**
 * Require External Modules
 */
const NodeCache = require('node-cache');
const firebaseAdmin = require('firebase-admin');

/**
 * Load Utils
 */
const parseDataType = require('../utils/parse.data.type');
const FirebaseTalker = require('./firebase.talker');
const FireDataObject = require('./fire.data.object');

class FireDataModeler {

  /**
   * @constructor
   */
  constructor({ cacheable = true, ttl = 300 } = {}) {

    /**
     * Initialize the Bindings and
     * the Model Objects
     */
    _models.set(this, {});
    _functions.set(this, {});
    _filters.set(this, {});

    /**
     * If Modeler is Cacheable
     * build the Cache
     */
    if (cacheable) {
      _cache.set(this, new NodeCache({ stdTTL: ttl, checkperiod: 300 }));
    }

  }


  /**
   * @function $model
   * 
   * @param {String} $name Name of Firebase Model
   * 
   * @param {Object} [$constructor] Model Constructor
   * 
   * @param {Object} $constructor.model Model to use
   * 
   * @param {Object[]} [$constructor.validators] Array of Model Validators
   * @param {String} $constructor.validators[].error Error to throw
   * @param {Function} $constructor.validators[].checker Function to Execute to Validate Model
   * 
   * @param {Function[]} [$constructor.onAdd] A series of function to execute before Add Process
   * @param {Function[]} [$constructor.onSet] A series of function to execute before Set Process
   * @param {Function[]} [$constructor.onGet] A series of function to execute before Get Process
   * @param {Function[]} [$constructor.onUpdate] A series of function to execute before Update Process
   * @param {Function[]} [$constructor.onDelete] A series of function to execute before Delete Process
   * 
   * @param {Function[]} [$constructor.afterAdd] A series of function to execute before Add Process
   * @param {Function[]} [$constructor.afterSet] A series of function to execute before Set Process
   * @param {Function[]} [$constructor.afterUpdate] A series of function to execute before Update Process
   * @param {Function[]} [$constructor.afterDelete] A series of function to execute before Delete Process
   * 
   * @param {Object} [$constructor.paths] Firebase Path Builder
   * @param {Boolean} [$constructor.paths.hasID=true] If the Model is an Array of Object into Firebase
   * @param {String} $constructor.paths.read The Main Read Reference for the Model
   * @param {Object[]} $constructor.paths.writes References to use
   * @param {String} $constructor.paths.writes[].ref The reference into write the model on update
   * @param {String} [$constructor.paths.writes[].queryOn] If Child must be queryed than add the child key to use with query
   * @param {String} [$constructor.paths.writes[].writeChild] On queryed child, must set the writeChild to save the result
   * @param {Function} [$constructor.paths.writes[].snapFilter] Function to filter snapshot, if filter return false, saving will be skipped
   * @param {String} [$constructor.paths.writes[].model] The model to use to parse the object before write
   * 
   * @param {Function[]} [$constructor.formatters] Array of Function to Apply to Model before save it
   * 
   */
  $model($name, $constructor) {

    /**
     * If Constructor Parameters Exists, then
     * load and parse the Constructor
     */
    if ($constructor) {

      /**
       * Build the Model
       */
      const $model = buildModel({
        $name,
        $constructor
      }, this);

      /**
       * Update all Models
       */
      const $models = _models.get(this);
      $models[$name] = $model;

      /**
       * Save the Models
       */
      _models.set(this, $models);
      
      /**
       * Return the Models
       */
      return this;

    }

    return _models.get(this)[$name];

  }


  /**
   * @function $extractor
   * 
   * @param {String} $name Name of Firebase Extractor
   * 
   * @param {Object} [$constructor] Model Constructor
   * 
   * @param {String} $constructor.model The father Model Name
   * @param {Object} $constructor.extract What field must Extract
   * 
   * @param {Object[]} [$constructor.validators] Array of Model Validators
   * @param {String} $constructor.validators[].error Error to throw
   * @param {Function} $constructor.validators[].checker Function to Execute to Validate Model
   * 
   * @param {Object} [$constructor.paths] Firebase Path Builder
   * @param {Boolean} [$constructor.paths.hasID=true] If the Model is an Array of Object into Firebase
   * @param {Object} $constructor.paths.read The Main Read Reference for the Model
   * 
   * @param {Function[]} [$constructor.formatters] Array of Function to Apply to Model before save it
   * 
   */
  $extractor($name, $constructor) {

    /**
     * If Constructor Parameters Exists, then
     * load and parse the Constructor
     */
    if ($constructor) {

      /**
       * Build the Model
       */
      const $model = buildModel({
        $name,
        $constructor,
        $isExtractor: true
      }, this);

      /**
       * Update all Models
       */
      const $models = _models.get(this);
      $models[$name] = $model;

      /**
       * Save the Models
       */
      _models.set(this, $models);
      
      /**
       * Return the Models
       */
      return this;

    }

    return _models.get(this)[$name];

  }


  $parser($name, $constructor) {

    /**
     * If Constructor Parameters Exists, then
     * load and parse the Constructor
     */
    if ($constructor) {

      /**
       * Build the Model
       */
      const $model = buildModel({
        $name,
        $constructor,
        $isParser: true
      }, this);

      /**
       * Update all Models
       */
      const $models = _models.get(this);
      $models[$name] = $model;

      /**
       * Save the Models
       */
      _models.set(this, $models);
      
      /**
       * Return the Models
       */
      return this;

    }

    return _models.get(this)[$name];

  }


  /**
   * @function $function
   * 
   * @param {String} $name Function Name
   * @param {Function} $callbackFunction Function to Execute
   * 
   */
  $function($name, $callbackFunction, $priority = 1000) {
    /**
     * Check a Function with the same name doesn't exists
     */
    const $functions = _functions.get(this);

    if (typeof $functions[$name] === 'function') {
      throw new Error(`[ FireDataModeler ] - Function '${$name}' already exists`);
    }

    if (typeof $callbackFunction !== 'function') {
      throw new Error(`[ FireDataModeler ] - Callback function for '${$name}' must be a valid Function`);
    }

    if (typeof $priority !== 'number' || $priority === Infinity || Number.isNaN($priority)) {
      throw new Error(`[ FireDataModeler ] - Priority for function '${$name}' must be a valid Number`);
    }

    /**
     * Add the function
     */
    $functions[$name] = { callback: $callbackFunction, priority: $priority };

    _functions.set(this, $functions);

    return this;

  }


  /**
   * @function $filter
   * 
   * @param {String} $name Filter Name
   * @param {Function} $callbackFunction Function to Execute
   * 
   */
  $filter($name, $callbackFunction) {
    /**
     * Check a Function with the same name doesn't exists
     */
    const $filters = _filters.get(this);

    if (typeof $filters[$name] === 'function') {
      throw new Error(`[ FireDataModeler ] - Filter '${$name}' already exists`);
    }

    if (typeof $callbackFunction !== 'function') {
      throw new Error(`[ FireDataModeler ] - Callback function for '${$name}' must be a valid Function`);
    }

    /**
     * Add the function
     */
    $filters[$name] = $callbackFunction;

    _filters.set(this, $filters);

    return this;

  }


  /**
   * @function Talker
   * 
   * @param {Object} $configuration
   * @param {Object} [$configuration.credential] Firebase Admin Credential
   * @param {Object} [$configuration.adminInstance] An already loaded Firebase Admin Instance
   * @param {String} [$configuration.databaseURL] URL Database for Firebase
   * @param {Array} [$configuration.pathReplacers=[]] An array of Path Replacers functions
   * 
   */
  Talker({ 
    credential,
    databaseURL,
    adminInstance,
    options: { pathReplacers = [], cacheable, ttl, forceRepars } = {}
  } = {}) {

    /**
     * Check Credential is an Object
     */
    if (typeof credential !== 'object' && !adminInstance) {
      throw new Error('[ FireDataModeler ] - Invalid \'credential\' parameters: must be an Object');
    }

    /**
     * Check databaseURL is a String
     */
    if (typeof databaseURL !== 'string' && !adminInstance) {
      throw new Error('[ FireDataModeler ] - Invalid \'databaseURL\' parameters: must be String');
    }

    /**
     * Build Options
     */
    const options = { pathReplacers, cacheable, ttl, forceRepars };

    /**
     * If there is an admin Instance
     * then save it
     */
    if (adminInstance) {
      return new FirebaseTalker(this, adminInstance.database(), options);
    }

    return new FirebaseTalker(this, firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(credential),
      databaseURL
    }).database(), options);

  }

}


/**
 * @function buildModel
 * 
 * @param {Object} $options
 * @param {String} $options.$name Model / Extractor Name
 * @param {Object} $options.$constructor A valid Constructor Objects
 * @param {Boolean} [$options.$isExtractor=false] Set if the new model is an Extractor
 * @param {Object} $context The context
 * 
 * @return {Object}
 * 
 */
function buildModel({ $name, $constructor, $isExtractor = false, $isParser = false }, $context) {

  const $type = $isExtractor ? 'Extractor' : $isParser ? 'Parser' : 'Model';

  /**
   * Check Extractor Name isn't a JS Variable Type
   */
  if (/^(string|number|boolean|object|array|this)$/i.test($name)) {
    throw new Error(`[ FireDataModeler ] - ${$type} name '${$name}' can't be a Javascript Variably Type.`);
  }

  /**
   * Get Models List
   */
  const $models = _models.get($context);

  /**
   * Deconstruct $constructor variables
   */
  const { model, extract, validators = [], paths = {}, formatters = [] } = $constructor;

  /**
   * Check a Model with same name doens't exists
   */
  if ($models[$name]) {
    if (!$isExtractor) {
      throw new Error(`[ FireDataModeler ] - Model '${$name}' already exists`);
    }
    else {
      throw new Error(`[ FireDataModeler ] - Model '${$name}' already exists, can't build an ${$type} with the same name`);
    }
  }

  /**
   * If new Model is a Model then
   * check model variable is a valid Object
   */
  if (!$isExtractor && (typeof model !== 'object' || !Object.keys(model).length)) {
    throw new Error('[ FireDataModeler ] - Invalid \'model\' parameters: must be an Object with at least one valid key.');
  }

  /**
   * If new Model is an Extractor, check model is a valid Model
   */
  if ($isExtractor && (typeof model !== 'string' || typeof $models[model] !== 'object')) {
    throw new Error(`[ FireDataModeler ] - Invalid Extractor '${$name}' for Model '${model}'. '${model}' doesn't exists.`);
  }

  /**
   * If new Model is an Extractor, check the extract key
   */
  if ($isExtractor && (typeof extract !== 'object' || !Object.keys(extract).length)) {
    throw new Error('[ FireDataModeler ] - Invalid \'extract\' parameters: must be an Object with at least one valid key.');
  }

  /**
   * Get father models if is an extractors
   */
  const $father = $isExtractor ? $models[model] : false;

  /**
   * Build the Object Map
   */
  const $keysMapping = new FireDataObject(!$isExtractor ? model : extract);

  /**
   * If Model is not an extractor
   * then must map the model value
   */
  if (!$isExtractor) {
    $keysMapping.$map(({ path, value }) => ({ path, value: parseDataType(value) }));
  }

  /**
   * Check Paths exists
   */
  if (typeof paths !== 'object' || Array.isArray(paths)) {
    throw new Error(`[ FireDataModeler ] - Invalid Paths Object for '${$name}' ${$type}`);
  }

  /**
   * If Model is not an extractor
   * then must check the paths object
   */
  if (!$isExtractor && !$isParser) {
    /**
     * Check read Path exists
     */
    if (typeof paths.read !== 'string') {
      throw new Error(`[ FireDataModeler ] - Path for '${$name}' Model must contain 'read' key`);
    }

    /**
     * Check paths writes array
     */
    if (!paths.writes) {
      paths.writes = [];
    }

    if (!Array.isArray(paths.writes)) {
      throw new Error(`[ FireDataModeler ] - Path for '${$name}' Model must contain 'writes' key Array`);
    }

    /**
     * Check read path exists in writes path
     */
    if (!paths.writes.filter($path => $path.ref === paths.read).length) {
      paths.writes.push({ ref: paths.read });
    }
  }

  /**
   * If Model is an Extractor,
   * then must validate and/or create
   * the paths field
   */
  if ($isExtractor) {
    /**
     * Replace has ID
     */
    paths.hasID = !!$father.paths.hasID;

    /**
     * Replace read path if is undefined
     * or not a String
     */
    if (typeof paths.read !== 'string') {
      paths.read = $father.paths.read;
    }

    /**
     * An Extractor could not write data
     * then remove the writes array if exists
     */
    paths.writes = [];
  }

  /**
   * Save the Constructor
   */
  const $newModel = {
    paths,
    _extractor  : $isExtractor ? model                            : false,
    _parser     : !!$isParser,
    _keys       : $keysMapping,
    model       : $isExtractor ? extract                          : model,
    validators  : Array.isArray(validators) ? validators.slice()  : [],
    formatters  : Array.isArray(formatters) ? formatters.slice()  : [],
    hooks       : {}
  };

  /**
   * Add Hook Functions
   */
  ['onAdd', 'onSet', 'onGet', 'onUpdate', 'onDelete', 'afterAdd', 'afterSet', 'afterUpdate', 'afterDelete'].forEach(($field) => {
    $newModel.hooks[$field] = getHookFunction($field);
  });

  return $newModel;

  function getHookFunction($field) {
    return !$isExtractor && !$isParser && Array.isArray($constructor[$field])
      ? $constructor[$field].slice()
      : [];
  }

}

module.exports = FireDataModeler;
