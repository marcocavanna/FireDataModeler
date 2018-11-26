const acornGlobals = require('acorn-globals');
const vm = require('vm');
const Firebase = require('firebase-admin');

const FireDataError = require('../../utils/fire.data.error');
const escapeRegExp = require('../../utils/escape.regexp');

Firebase.initializeApp({ databaseURL: 'https://afakedatabase.firebaseio.com' }, 'FakeForKey');

/**
 * Constant
 */
const CONST = {
  ID_REGEX: /(?:(?!\/)|^)(\$id)(?=\/|$)/
};

module.exports = {
  _normalizeFirebaseArray,
  _castVariable,
  _variableIs,
  _normalizeExchangeField,
  _loadModel,
  _getID,
  _executeHook,
  _parsePath,
  _safeEval,
  _parseVariablesArrayPaths,
  isPromise,
  isObject,
  ID_REGEX: CONST.ID_REGEX
};

function _normalizeFirebaseArray($data) {
  /**
   * Create a Collection
   */
  const _normalized = new FireDataModelerArray();

  /**
   * If $data is an Array
   * copy each value
   */
  if (Array.isArray($data)) {
    $data.forEach(($value) => {
      /**
       * If there isn't a placeholder ID
       * then get it in Firebase Style
       */
      if (isObject($value) && !$value.__fdmID) {
        $value.__fdmID = Firebase.database().ref().push().key;
      }

      /**
       * Save value
       */
      _normalized.push($value);
    });

    return _normalized;
  }

  /**
   * If is an Object
   * then copy each child object
   * and set the __fdmID
   */
  if (isObject($data)) {
    /**
     * Loop Each Object key
     * and push the object into the array
     * saving it's __fdmID
     */
    Object.getOwnPropertyNames($data).forEach((__fdmID) => {
      const _dataID = isNumber(__fdmID) ? Firebase.database().ref().push().key : __fdmID;
      _normalized.push({ ...$data[__fdmID], __fdmID: _dataID });
    });

    return _normalized;

  }

  /**
   * If data is not an object or
   * an array, return null
   */
  return null;

}

/**
 * @function _variableIs
 * 
 * @param {*} $variable Variable to Check
 * @param {String} $type Type to Check
 * 
 * @description
 * Check if a variable is of the desidered type.
 * It differentiate object between Array,
 * and return false if checking
 * NaN or +Infinity -Infinity as Numnber
 * 
 * @return {Boolean}
 */
function _variableIs($variable, $type = '') {
  switch ($type.toLowerCase()) {
    case 'string':
      return typeof $variable === 'string';
    case 'number':
      return isNumber($variable);
    case 'boolean':
      return typeof $variable === 'boolean';
    case 'object':
      return isObject($variable);
    case 'array':
      return Array.isArray($variable);
    default:
      return false;
  }
}


/**
 * @function _castVariable
 * 
 * @param {*} $variable Variable to Case
 * @param {String} $castTo Type to cast
 * 
 * @description
 * Try to transform variable type.
 * If transform will fail, then return null
 * 
 * @return {*}
 * 
 */
function _castVariable($variable, $castTo = '') {
  switch ($castTo.toLowerCase()) {
    case 'string':
      /**
       * If variable is the right type,
       * then return it as is
       */
      if (typeof $variable === 'string') {
        return $variable;
      }

      /**
       * Try to Cast
       */
      if ($variable.toString) {
        return $variable.toString();
      }

      return '';

    case 'number':
      /**
       * If variable is the right type,
       * then return it as is
       */
      if (isNumber($variable)) {
        return $variable;
      }

      /**
       * Try to Cast
       */
      if (isNumber(+$variable)) {
        return +$variable;
      }

      return 0;

    case 'boolean':
      /**
       * If variable is the right type,
       * then return it as is
       */
      if (typeof $variable === 'boolean') {
        return $variable;
      }

      /**
       * Try to Cast
       */
      if (_castVariable($variable, 'string') === 'false') {
        return false;
      }

      if (_castVariable($variable, 'string') === 'true' || _castVariable($variable, 'number') !== 0) {
        return true;
      }

      if (_castVariable($variable, 'number') !== 0) {
        return true;
      }

      return !!$variable;

    case 'object':
      /**
       * If variable is the right type,
       * then return it as is
       */
      if (isObject($variable)) {
        return $variable;
      }

      return { value: $variable };

    case 'array':
      /**
       * If variable is the right type,
       * then return it as is
       */
      if (Array.isArray($variable)) {
        return $variable;
      }

      return [$variable];

    default:
      return null;
  }
}


/**
 * @function _normalizeExchangeField
 * 
 * @param {String} _exchangeField Exchange Field String
 * 
 * @description
 * Return a string reordered separated by space
 * to let check if is the same
 * 
 * @return {String}
 */
function _normalizeExchangeField(_exchangeField) {
  if (typeof _exchangeField === 'string') {
    return _exchangeField.split(' ').sort().join(' ');
  }

  if (typeof _exchangeField === 'object' && _exchangeField !== null && !Array.isArray(_exchangeField)) {
    return Object.getOwnPropertyNames(_exchangeField).filter($key => _exchangeField[$key]).sort().join(' ');
  }

  if (Array.isArray(_exchangeField) && _exchangeField.length) {
    return _exchangeField.sort().join(' ');
  }

  return '';
}


/**
 * @function getID
 * 
 * @param {Boolean} $hasID if False, ID won't be valuated
 * @param {String|String[]} $id ID to Check
 * @param {Object} $configuration
 * @param {String} $configuration.$modelName Name of the Model
 * @param {String} $configuration.fn Executing Function
 * @param {Boolean} [$configuration.couldBeArray] True if ID Could be an Array
 * 
 * @return {String[]}
 * 
 */
function _getID($hasID, $id, { $modelName = '', couldBeArray = false } = {}) {

  if (!$hasID) return couldBeArray ? ['__tmpFireDataModelerID__'] : '__tmpFireDataModelerID__';

  let _valid;

  if (!couldBeArray) {
    _valid = typeof $id === 'string';
  }

  else {
    const $IDs = typeof $id === 'string' ? [$id] : $id;

    if (Array.isArray($IDs)) {
      _valid = $IDs.reduce((p, c) => p && typeof c === 'string', true);
    }
  }

  if (!_valid) {
    throw new FireDataError({
      $modelName,
      error         : 'invalid-id',
      functionName  : '$get',
      message       : `Read path for Model '${$modelName}' requires an ID {String}${couldBeArray ? ', or more ID {String[]}' : ''}`
    });
  }

  return couldBeArray ? (typeof $id === 'string' ? [$id] : $id) : $id;
}


/**
 * @function loadModel
 * 
 * @param {Object} $this The Firebase Talker Instance
 * @param {String} $name Model Nmae to Load
 * 
 * @description
 * Load a model by name
 */
function _loadModel($this, $modelName, { fn = '', isModel = true, isParser = false, isExtractor = false } = {}) {
  /**
   * Get the Model
   */
  const $model = _models.get(_dataModeler.get($this))[$modelName];
  let $error;

  /**
   * Check first model exists
   */
  if (!$model) {
    $error = new FireDataError({
      $modelName,
      error         : 'model-dont-exists',
      functionName  : fn,
      message       : `Model ${$modelName} doesn't Exists`
    });
  }

  /**
   * Check if model could be a model
   */
  if (!$error && !isModel && !$model._parser && !$model._extractor) {
    $error = new FireDataError({
      $modelName,
      error         : 'invalid-model-type',
      functionName  : fn,
      message       : `Model ${$modelName} is a Model, but couldn't be a Model in this Function`
    });
  }

  /**
   * Check if model could be an extractor
   */
  if (!$error && !isExtractor && $model._extractor) {
    $error = new FireDataError({
      $modelName,
      error         : 'invalid-model-type',
      functionName  : fn,
      message       : `Model ${$modelName} is an Extractor, but couldn't be an Extractor in this Function`
    });
  }

  /**
   * Check if model could be a parser
   */
  if (!$error && !isParser && $model._parser) {
    $error = new FireDataError({
      $modelName,
      error         : 'invalid-model-type',
      functionName  : fn,
      message       : `Model ${$modelName} is a Parser, but couldn't be a Parser in this Function`
    });
  }

  /**
   * Return the Result
   */
  if ($error) {
    throw $error;
  }

  else {
    return $model;
  }

}


/**
 * @function executeHookFunctions
 * 
 * @param {Object} $configuration
 * @param {Object} $configuration.$model The Model to read
 * @param {String} $configuration.hook The hook to Execute
 * @param {*[]} $configuration.params The Array params to pass to function
 * @param {*} $configuration.context The function context to use
 * 
 * @return {Promise}
 * 
 */
function _executeHook({ $model, hook, params = [], context }) {
  /**
   * Build promise array to return
   */
  const $promises = [];

  /**
   * Loop for each hook in $model
   */
  ($model.hooks[hook] || []).forEach(($function) => {
    /**
     * Check is a correct function
     */
    if (typeof $function !== 'function') return;

    /**
     * Build the Async Function
     */
    const $exec = async function waitHookResult() {
      return $function.apply(context, params);
    };

    /**
     * Push into Promise
     */
    $promises.push($exec());

  });

  /**
   * Return a Promise containing
   * all subpromise
   */
  return Promise.all($promises)
    .then(() => Promise.resolve(params))
    .catch(() => Promise.reject());

}


/**
 * @function parseFirebaseReference
 * 
 * @param {Object} $this The Firebase Talker Instance
 * @param {String} $path The Path to Parse
 * 
 * @description
 * Use the setted replacer to parse and build the path
 * 
 */
function _parsePath($this, $path, { $hasID = false, $id } = {}) {
  /**
   * Get Replacers
   */
  const _replacers = _pathReplacers.get($this);

  /**
   * Replace the Path
   */
  _replacers.forEach(($replacer) => {
    $path = $path.replace(new RegExp(escapeRegExp($replacer.find), $replacer.caseSensitive ? 'g' : 'gi'), $replacer.replace);
  });

  /**
   * Replace starting or ending slash
   */
  $path = $path.replace(/^\/|\/$/g, '');

  /**
   * If path has ID, replace the ID
   * or search for id placeholder
   */
  if ($hasID && typeof $id === 'string') {
    if (CONST.ID_REGEX.test($path)) {
      $path = $path.replace(CONST.ID_REGEX, $id);
    }
    else {
      $path = `${$path}/${$id}`;
    }
  }

  /**
   * Search if there is some undefined
   * path placeholders
   */
  const $undefinedPlaceholders = $path.match(/(\$[a-z]+)/gi);

  /**
   * Throw an Error if there is an undefined path
   * placeholder without the replacers
   */
  if ($undefinedPlaceholders && $undefinedPlaceholders.length) {
    throw new FireDataError({
      $modelName    : 'root',
      functionName  : '$parseReferences',
      error         : 'undefined-placeholder',
      message       : `Undefined path placeholders '${$undefinedPlaceholders.join('\' - \'')}' for path '${$path}'`
    });
  }

  /**
   * Remove first and last slash if exists
   */
  return $path;

}


/**
 * @function isNumber
 * 
 * @param {*} $num Variable
 * 
 * @description
 * Check if a Variable is a Number
 * 
 * @return {Boolean}
 */
function isNumber($num) {
  return typeof +$num === 'number' && !Number.isNaN(+$num) && Number.isFinite(+$num);
}


/**
 * @function isObject
 * 
 * @param {*} $obj Variable
 * 
 * @description
 * Check if a Variable is an Object
 * 
 * @return {Boolean}
 */
function isObject($obj) {
  return typeof $obj === 'object' && $obj !== null && !Array.isArray($obj);
}


/**
 * @function FireDataModelerArray
 * 
 * @description
 * Create a simil-array containing the
 * property to found it
 * 
 * @return {*[]}
 */
function FireDataModelerArray(...arg) {
  function CollectionConstructor(...args) {
    /**
     * Create a Copy of Array Prototype Function
     */
    let collection = Object.create(Array.prototype);
    /**
     * Set as Array
     */
    collection = (Array.apply(collection, args) || collection);
    /**
     * Define custom Property
     */
    Object.defineProperty(
      collection,
      '__isFirebaseDataModelerArray',
      { value: true, enumerable: false, writable: false }
    );
    
    /**
     * Return the Collection
     */
    return collection;
  }

  /**
   * Return Constructor
   */
  return CollectionConstructor(...arg);
}


/**
 * @function cloneObjectProperty
 * 
 * @param {Object} $object The object to Clone
 * @param {String} $key The Key to Clone
 * @param {Object} $configuration
 * @param {Boolean} [$configuration.avoidFunctions=true] If must avoid the functions
 * 
 * @description
 * This function will create a very deep clone of an Object, containing all property
 * with the exact key property
 * 
 * @return {Object}
 * 
 */
function cloneObjectProperty($object, $key, { avoidFunctions = true } = {}) {

  /**
   * If value is an object
   * return nested key
   */
  if (isObject($object[$key]) || Array.isArray($object[$key])) {

    const $start = Array.isArray($object[$key]) ? [] : {};

    /**
     * Recurse the Function
     */
    Object.getOwnPropertyNames($object[$key]).forEach(($eachKey) => {
      /**
       * Skip length key
       */
      if (Array.isArray($object[$key]) && $eachKey === 'length') return;

      /**
       * Get the Property Descriptor
       */
      const {
        writable,
        enumerable,
        configurable } = Object.getOwnPropertyDescriptor($object[$key], $eachKey);

      /**
       * Add the Object Property
       */
      Object.defineProperty(
        $start,
        $eachKey,
        { value: cloneObjectProperty($object[$key], $eachKey), writable, enumerable, configurable }
      );

    });

    /**
     * Return the Cloned Object
     */
    return $start;

  }

  /**
   * Else, return the value
   */
  const { value } = Object.getOwnPropertyDescriptor($object, $key);

  return typeof value === 'function' && avoidFunctions ? () => {} : value;

}


/**
 * @function _safeEval
 * 
 * @param {String} code The Code to Execute
 * @param {String} context The context to use during execution it will be deep copied
 * @param {String|String[]} functionsToKeep Function to keep from context
 * 
 * @description
 * Evaluate Javasccript Code in Context using VM and a protected context
 * all the function of the context will be skipped, to keep some function
 * must declare it in the thirds parameter
 * 
 * @return {Promise}
 */

function _safeEval({
  code = '',
  context = {},
  keep = [],
  safe = {}
} = {}) {
  /**
   * Create a SandBox
   */
  const $sandbox = {};

  /**
   * Check Context is valid object
   */
  if (isObject(context)) {
    /**
     * If is a valid object
     * loop each key to create an exact copy
     * of the object
     */
    Object.getOwnPropertyNames(context).forEach(($key) => {
      /**
       * Get Property and Value
       */
      const { enumerable, writable, configurable } = Object.getOwnPropertyDescriptor(context, $key);

      /**
       * Define the new Property
       */
      Object.defineProperty(
        $sandbox,
        $key, 
        { value: cloneObjectProperty(context, $key), enumerable, writable, configurable }
      );

    });

    /**
     * Restore original function
     */
  
    if (typeof keep === 'string') {
      keep = [keep];
    }
  
    if (Array.isArray(keep)) {
      keep.forEach(($functionName) => {
        if (typeof context[$functionName] === 'function') {
          Object.defineProperty(
            $sandbox,
            $functionName,
            { value: context[$functionName], writable: false, configurable: false }
          );
        }
      });
    }
  }

  if (isObject(safe)) {
    Object.getOwnPropertyNames(safe).forEach(($concat) => {
      $sandbox[$concat] = safe[$concat];
    });
  }

  /**
   * Add a Key to Store the Value
   */
  const $resultKey = `__MXSAFEEVALRESULT__${Math.floor(Math.random() * 100000)}`;

  /**
   * Create the Scripts
   */
  const $code = `
  /**
   * Clear the Context
   */
  (function() {
    Function = undefined;
    Promise = undefined;
  })();

  try {
    ${$resultKey} = ${code};
  }
  catch (E) {
    ${$resultKey} = null;
  }

  `;

  /**
   * Create the new Scripts
   */
  const $script = new vm.Script($code);

  /**
   * Create a new Context
   * and run the script
   */
  const $result = $script.runInNewContext($sandbox);

  return $result;

}

function _parseVariablesArrayPaths($code = '') {
  if (typeof $code !== 'string') return [];

  const $must = [];
  const $parsed = acornGlobals($code);

  $parsed.forEach(($var) => {
    $must.push($var.name);
  
    if (!Array.isArray($var.nodes)) return;
  
    let $root = $var.name;
  
    $var.nodes.forEach(($node) => {
      if (!Array.isArray($node.parents)) return;
  
      $node.parents
        .sort(({ end: endA }, { end: endB }) => endA - endB)
        .forEach(($parent) => {
          if ($parent.type !== 'MemberExpression' || typeof $parent.property !== 'object') return;
          $root = `${$root}/${$parent.property.name}`;
          $must.push($root);
        });
    });
  
  });

  return $must;
}

function isPromise($object) {
  return $object instanceof Promise
    || (typeof $object === 'object' 
      && $object !== null 
      && typeof $object.then === 'function' 
      && typeof $object.catch === 'function');
}
