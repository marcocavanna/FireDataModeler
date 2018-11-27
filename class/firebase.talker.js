
/**
 * Require External Modules
 */
const _options = new WeakMap();

/**
 * Load Utils
 */
const FireDataObject = require('../class/fire.data.object');
const FireDataError = require('../utils/fire.data.error');

/**
 * Load Talker Utils
 */
const {
  _castVariable,
  _variableIs,
  _normalizeExchangeField,
  _loadModel,
  _getID,
  _executeHook,
  _parsePath,
  _normalizeFirebaseArray,
  _safeEval,
  isPromise,
  isObject
} = require('./utils');

class FirebaseTalker {

  /**
   * 
   * @param {FireDataModeler} DataModeler The FireData Modeler Object
   * @param {Object} admin Firebase Admin Object
   * @param {Object} $configuration
   * @param {Object[]} [$configuration.pathReplacers] Replacers for Firebase Reference Path
   */
  constructor(
    DataModeler,
    admin,
    { forceReparse = false, cacheable, ttl } = {}
  ) {

    /**
     * Save the Data Modeler
     * and the Admin Instance
     */
    _dataModeler.set(this, DataModeler);
    _firebaseAdmin.set(this, admin);
    _pathReplacers.set(this, []);

    /**
     * Get Cacheable
     */
    const modelerCache = _cache.get(DataModeler);
    let talkerCacheable;
    let talkerTTL;

    /**
     * If modeler cache is undefined,
     * it means that cache is disabled
     * from Modeler instance
     */
    if (modelerCache === undefined) {
      talkerCacheable = false;
      talkerTTL = false;
    }

    /**
     * Else, copy the cache options
     * or set the local value
     */
    else {
      talkerCacheable = cacheable === undefined ? true : !!cacheable;
      talkerTTL = typeof ttl !== 'number' ? modelerCache.options.stdTTL : ttl;
    }

    /**
     * Save options
     */
    _options.set(this, {
      forceReparse,
      cacheable  : talkerCacheable,
      ttl        : talkerTTL
    });

  }

  /**
   * @function $path
   * 
   * @param {String} find Placeholder to find
   * 
   * @description
   * Manage path placeholder.
   * Placeholder must contain only A-z character.
   * The $ starting char will be prepended automatically
   * 
   */
  $path(find) {

    const self = this;

    /**
     * Check find is a string containing only
     * A-z character
     */
    if (!/^([A-Za-z])+$/.test(find)) {
      throw new FireDataError({
        $modelName    : 'root',
        functionName  : '$path',
        error         : 'invalid-placeholder',
        message       : `Placeholder string must contain only Characters. Found ${find}`
      }).message;
    }

    /**
     * $id placeholder cannot be used
     * as is a system placeholder
     */
    if (find === 'id') {
      throw new FireDataError({
        $modelName    : 'root',
        functionName  : '$path',
        error         : 'invalid-placeholder',
        message       : 'System protected placeholder found : \'id\' placholder cannot be changed.'
      }).message;
    }

    /**
     * Prepend $ char
     */
    find = `$${find}`;

    /**
     * Get the Replace
     */
    const $replacers = _pathReplacers.get(this);

    /**
     * Search if replacer exists
     */
    let $idx = -1;
    $replacers.forEach(($replacer, $index) => {
      if ($replacer.find === find) $idx = $index;
    });
    const $exists = $idx !== -1;

    return {
      /**
       * @function replace
       * 
       * @param {String} replace Replace string for placeholder
       * @param {Object} $options
       * @param {Boolean} [$options.caseSensitive=true] If replacing is case sensitive
       */
      replace(replace, { caseSensitive = true } = {}) {
        /**
         * If Replacer exists, update it
         */
        if ($exists) {
          $replacers[$idx] = { find, replace, caseSensitive };
        }

        /**
         * Else push the new replacers
         */
        else {
          $replacers.push({ find, replace, caseSensitive });
        }

        /**
         * Save replacers
         */
        _pathReplacers.set($replacers, self);

        return self;
      },

      delete() {
        /**
         * Remove the Replacer
         */
        if ($exists) {
          $replacers.splice($idx, 1);
        }

        /**
         * Save replacers
         */
        _pathReplacers.set($replacers, self);

        return self;
      },

      get() {
        return $exists ? $replacers[$idx].replace : null;
      }
    };

  }


  /**
   * @function $parsePath
   * 
   * @param {String} path Path to Parse
   * 
   * @description
   * Return a parsed Path using current placeholders
   * 
   * @returns {String} Path Parsed
   * 
   */
  $parsePath(path) {
    return _parsePath(this, path);
  }


  /**
   * @function $destroy
   * 
   * @description
   * Unload FireData Talker, removing all properties
   * associated to the WeakMap during construction
   * 
   */
  $destroy() {

    /**
     * Remove WeakMap
     */
    _dataModeler.delete(this);
    _firebaseAdmin.delete(this);
    _pathReplacers.delete(this);
    _options.delete(this);

  }


  /**
   * @function $parse
   * 
   * @param {String} $modelName Model Name to Use
   * 
   * @description
   * Build a new Parser for the requested Model
   * returning a Promise function that could be used
   * to parse Object
   * 
   */
  $parse($modelName) {
    /**
     * Save Context
     */
    const self = this;

    /**
     * Return an Async Function
     */
    return async function parseData(
      $data = {},
      { omitNull = true, isGetter = false, rawData = false, oldData, newData, fatherData } = {}
    ) {

      /**
       * Load the Model
       */
      const $model = _loadModel(self, $modelName, {
        fn           : '$parse',
        isExtractor  : true,
        isParser     : true
      });

      /**
       * Get Source as FireDataObject
       */
      const $dataSource = $data instanceof FireDataObject
        ? $data
        : new FireDataObject($data);

      const $oldDataSource = oldData instanceof FireDataObject
        ? oldData
        : new FireDataObject(oldData);

      const $newDataSource = newData instanceof FireDataObject
        ? newData
        : new FireDataObject(newData);

      /**
       * If no Data, return null
       */
      if ($dataSource.$isEmpty()) {
        return null;
      }

      /**
       * Build Globals for Evaluating
       * Functions and Filters
       */
      const _talkerName = `___fdmTalkerInstance${Math.floor(Math.random() * 100000)}`;
      const _parsedName = `___fdmParsedData${Math.floor(Math.random() * 100000)}`;


      /**
       * Check first if the model is an extractor
       * if it is, then parse fathers data if doesn't exists
       * and extract data using the Model
       */
      if ($model._extractor) {
        /**
         * Get the father data if doesn't exists
         */
        const _fatherData = fatherData || await self.$parse($model._extractor)(
          $data, { omitNull, rawData, isGetter, oldData, newData }
        );

        /**
         * Build the father data
         */
        const $fatherData = _fatherData instanceof FireDataObject
          ? _fatherData.$build()
          : _fatherData;

        /**
         * Return the extracted data
         */
        const $extractedData = await self.$extract($modelName)($fatherData);

        return $extractedData;

      }

      /**
       * If model is not an extractor, then
       * build the parsed model
       */
      const $parsed = new FireDataObject();

      /**
       * Get Keys
       */
      const { 
        _primitiveKey   = [],
        _modelKey       = [],
        _requiredKey    = [],
        _filteredKey    = [],
        _functionKey    = [] }  = $model;


      /**
       * Phase 1
       * 
       * -- Primitive Key
       * 
       * Parse first the primitive Key
       * Autocasting value if are required
       * and autocast is setted
       */
      _primitiveKey.forEach(({
        path,
        value: { variable, autoCast, required }
      }) => {
        /**
         * Get the Source
         */
        const $source = $dataSource.$get(path);

        /**
         * Check source is correct type
         */
        const $parsedSource = _variableIs($source, variable)
          ? $source
          : (required && autoCast) 
            ? _castVariable($source, variable)
            : null;

        /**
         * Set the Parsed String,
         * omitting null value if omitNull
         * is active
         */
        if ($parsedSource !== null || !omitNull) {
          $parsed.$set(path, $parsedSource);
        }
      });


      /**
       * Phase 2
       * 
       * -- Model Key
       * 
       * Parse the Model key
       */
      const _modelKeyPromises = [];
      _modelKey.forEach(({
        path,
        value: { variable, bind, reference, params, required, isModelArray }
      }) => {
        /**
         * Split process from bind/reference to parsing
         */
        if (bind || reference) {
          /**
           * Get Exchange Field
           * and the source
           */
          const _exchangeField = params[0];
          const _source = $dataSource.$get(_exchangeField);

          /**
           * Check exchange field consistency
           */
          const _isValid = (isModelArray 
            && _variableIs(_source, 'array')
            && _source.length)
          || _variableIs(_source, 'string');

          /**
           * If field is required,
           * check the exchange field
           */
          if (required && !_isValid) {
            throw new FireDataError({
              $modelName,
              error         : `${path}-invalid-exchange-field`,
              functionName  : '$parse subParse',
              message       : `Value for '${path}' require field '${_exchangeField}' to be a ${isModelArray ? 'Array' : 'String'} but got ${typeof _source}`
            });
          }

          /**
           * Exit function if field is not valid
           */
          if (!_isValid) {
            /**
             * Set null if must not omit
             */
            if (!omitNull) {
              $parsed.$set(path, null);
              $parsed.$set(_exchangeField, null);
            }
            return false;
          }

          /**
           * Transform source and
           * old source
           */
          const $source = _normalizeExchangeField(_source);
          const $oldSource = _normalizeExchangeField($oldDataSource.$get(_exchangeField));

          const _dataHasChanged = $source !== $oldSource;
          const _existingData = $dataSource.$get(path);

          const _mustUpdate = (bind || (reference && (!_existingData || _dataHasChanged)))
            && !rawData;

          /**
           * If don't have to update data
           * can exit from function
           */
          if (!_mustUpdate) {
            /**
             * If old data exists
             * save it
             */
            if (_existingData) {
              $parsed.$set(path, _existingData);
              $parsed.$set(_exchangeField, $source);
            }

            return false;
          }

          /**
           * Build the Getter
           */
          const $getter = self.$get(variable);

          /**
           * Get data for each source
           */
          $source
            .split(isModelArray ? ' ' : null)
            .forEach(($sourceID) => {
              _modelKeyPromises.push(new Promise(async (resolveGetData) => {
                /**
                 * Get the Data
                 */
                const $sourceData = await $getter($sourceID);

                /**
                 * If Model Exists
                 * save into parsed data
                 */
                $parsed.$set(isModelArray ? `${path}/${$sourceID}` : path, $sourceData);

                /**
                 * Save the ID Fields if Exists
                 * or null if it doesn't
                 */
                if (isModelArray) {
                  $parsed.$set(`${_exchangeField}/${$sourceID}`, $sourceData !== null ? true : null);
                }
                else {
                  $parsed.$set(_exchangeField, $sourceData !== null ? $source : null);
                }

                /**
                 * Resolve getting Data
                 */
                return resolveGetData();

              }));
            });

          /**
           * Exit Function
           */
          return true;

        }

        /**
         * If Model is not referenced/binded
         * than is a sub model parser
         */
        const $source = $dataSource.$get(path);

        /**
         * Exit function if source
         * doens't exists
         */
        if ($source === null) {
          if (!omitNull) {
            $parsed.$set(path, null);
          }
          return false;
        }

        /**
         * If Model is not an Array
         * of Model, then parse the source
         */
        if (!isModelArray) {
          /**
           * Declare a Parser
           */
          const $parser = self.$parse(variable);

          /**
           * Append a Promise
           */
          _modelKeyPromises.push(new Promise(async (resolveSubParsing) => {
            /**
             * Get Parsed
             */
            const $parsedSource = await $parser($source);
            const _isEmpty = !Object.keys($parsedSource).length;

            /**
             * Set null if object is empty
             * and must not omit null value
             */
            if (_isEmpty && !omitNull) {
              $parsed.$set(path, null);
            }

            /**
             * If object is not empty
             * set value
             */
            else if (!_isEmpty) {
              $parsed.$concat(path, $parsedSource);
            }

            return resolveSubParsing();
          }));

          return true;
        }

        const _newSource = $newDataSource.$get(path);

        /**
         * If Model is an Array of Model
         * and doesn't has new data, then
         * try to normalize it.
         * Normalizing is a way to decode
         * array of object in firebase style { id1: {}, id2: {} ... }
         * and build an array
         */
        const _normalizedArray = !isGetter && Array.isArray(_newSource)
          ? _normalizeFirebaseArray(_newSource)
          : _normalizeFirebaseArray($source);

        /**
         * If normalized array fails
         * must return and set null
         * if mustn't omit
         */
        if (_normalizedArray === null) {
          if (!omitNull) {
            $parsed.$set(path, null);
          }
          return false;
        }

        /**
         * For each data into normalized array
         * parse data and resolve the result
         */
        _normalizedArray.forEach((_normalizedSourceData) => {
          _modelKeyPromises.push(new Promise(async (resolveNormalizingParse) => {
            /**
             * Get the ID and extract the data
             */
            const { __fdmID, ..._normalizedSource } = _normalizedSourceData;

            /**
             * Wait for Parse
             */
            const $normalizedParsed = await self.$parse(variable)(_normalizedSource);
            const _parsedSuccess = _variableIs($normalizedParsed, 'object')
              && Object.keys($normalizedParsed).length;

            /**
             * If parsed exists
             * save it
             */
            if (_parsedSuccess) {
              $parsed.$set(`${path}/${__fdmID}`, $normalizedParsed);
            }

            /**
             * If parsed is null and must not
             * omit null value, save id
             */
            else if (!omitNull) {
              $parsed.$set(`${path}/${__fdmID}`, null);
            }

            /**
             * Resolve parsed
             */
            return resolveNormalizingParse($normalizedParsed);

          }));
        });

        /**
         * Return the End of the Functions
         */
        return true;

      });

      /**
       * Await the resolutions of all promises
       * before continue
       */
      await Promise.all(_modelKeyPromises);

      /**
       * Phase 3
       * 
       * -- Function Field
       * 
       * Get and Parse Function field
       * 
       */
      const _functionKeyPromises = [];

      /**
       * Build the safe context
       */
      const _safeContext = {
        [_talkerName]: self,
      };
      
      /**
       * Build the Functions execution
       * stack to reorder using priority
       */
      const _functionsStack = [];
      
      /**
       * Build Stack Array
       */
      _functionKey.forEach(({
        path,
        value
      }) => {

        /**
         * Load the Function
         */
        const { callback, priority = 1000 } = loadFunction(self, value.variable) || {};

        /**
         * Check the function exists
         */
        if (!value.directEval && typeof callback !== 'function') {
          throw new FireDataError({
            $modelName,
            error         : 'invalid-function-name',
            functionName  : '$parse compileFunctions',
            message       : `Value for '${path}' require function '${value.variable}' but doens't exists`,
            data          : { name: value._original }
          });
        }

        /**
         * Modify Function Name to
         * avoid key replacing
         */
        const _functionName = `___fdmFunction${Math.floor(Math.random() * 100000)}_${value.variable}`;
        const _functionParams = value.functionExpr.replace(/\)$/, `, ${_talkerName})`).replace(/\(,\s+/, '(');

        /**
         * Push the function into stack
         */
        _functionsStack.push({
          _invoke      : `${_functionName}.bind(${_parsedName})${_functionParams}`,
          _directEval  : !!value.directEval,
          _evalExpr    : value.functionExpr,
          _functionName,
          callback,
          priority,
          path,
          value
        });

      });

      _functionsStack
        /**
         * Reorder the Stack
         */
        .sort(({ priority: pA }, { priority: pB }) => pB - pA)

        /**
         * Execute Functions
         */
        .forEach(({
          value: { bind },
          path,
          callback,
          _functionName,
          _invoke,
          _directEval,
          _evalExpr
        }) => {

          /**
           * Get the Source and check if is
           * binded or undefined
           */
          const $source = $dataSource.$get(path);
          const _undefinedSource = $source === null || $source === undefined;

          /**
           * If this steps is in get mode
           * do not invoke the function
           */
          if (isGetter) {
            if (!_undefinedSource) {
              $parsed.$set(path, $source);
            }
            else if (!omitNull) {
              $parsed.$set(path, null);
            }

            return true;
          }

          /**
           * If source is not undefined and the
           * key is not binded must not invoke the function
           */
          if (!_undefinedSource && !bind) {
            $parsed.$set(path, $source);
            return true;
          }

          /**
           * Else, if key is binded or is undefined
           * then must invoke the function and set the result.
           * Before do this compile function context
           */
          const _parsedBuilt = $parsed.$build();

          const _functionContext = {
            [_parsedName]: _parsedBuilt,
            ..._parsedBuilt
          };

          let _executionCode = null;
          
          /**
           * If function is not direct evaluating
           * function but has a declared function
           * extend the context with the function
           * name
           */
          if (!_directEval) {
            /**
             * Extend the Context
             */
            _functionContext[_functionName] = callback;

            /**
             * Set execution Code
             */
            _executionCode = _invoke;
          }

          /**
           * Else, build a private function
           * returning the code
           */
          else {
            /**
             * Set the Execution Code
             */
            _executionCode = `(() => {
              return ${_evalExpr};
            }).bind(${_talkerName})()`;
          }

          /**
           * Execute the Code
           */
          const _functionResult = _safeEval({
            code     : _executionCode,
            context  : _functionContext,
            keep     : _functionName,
            safe     : _safeContext
          });

          /**
           * If result is not a Promise
           * set the value and continue
           */
          if (!isPromise(_functionResult)) {
            _checkAndSetResult(path, _functionResult);
            return true;
          }

          /**
           * Else, wait for promise
           * resolutions
           */
          _functionKeyPromises.push(new Promise(async (resolveFnResult) => {
            /**
             * Wait for the result
             * and set it into parsed object
             */
            _checkAndSetResult(path, await _functionResult);

            /**
             * Resolve the SubPromise
             */
            return resolveFnResult();

          }));

          /**
           * Exit Function
           */
          return true;

        });

      /**
       * Await the resolutions of all promises
       * before continue
       */
      await Promise.all(_functionKeyPromises);


      /**
       * Phase 4
       * 
       * -- Apply Filter
       * 
       * Apply Filters
       * 
       */
      _filteredKey.forEach(({
        value: { filters = [] },
        path
      }) => {
        
        const _parsedBuilt = $parsed.$build();

        /**
         * Get the Source at Path
         */
        let _filterSource = $parsed.$get(path);

        /**
         * Filters are executed
         * in orders
         */
        filters.forEach((_filterDescriptor = '') => {
          /**
           * Get filter names and Params
           */
          const [_filter, _filterParams] = _filterDescriptor.split(':');

          /**
           * Get the Filter
           */
          const callback = loadFilter(self, _filter);

          /**
           * If no Filter, reject
           */
          if (!callback) {
            return new FireDataError({
              $modelName,
              error         : 'invalid-filter-name',
              functionName  : '$parse compileFilter',
              message       : `Value for '${path}' require filter '${_filter}' but doens't exists`
            });
          }

          /**
           * Build Invoke Params
           */
          const _filterFunctionName = `___fdmFilterFunction_${_filter}${Math.floor(Math.random() * 10000)}`;
          const _valueName = `___fdmFilterValue${Math.floor(Math.random() * 10000)}`;
          const _filterInvokeParams = `(${_valueName}, ${_filterParams})`;

          /**
           * Build the Context
           */
          const _filterContext = {
            [_filterFunctionName]  : callback,
            [_valueName]           : _filterSource,
            ..._parsedBuilt
          };

          /**
           * Execute the Code
           * and Return the new Value
           * directly into Source
           */
          _filterSource = _safeEval({
            code     : `${_filterFunctionName}${_filterInvokeParams}`,
            context  : _filterContext,
            keep     : [_filterFunctionName, _valueName]
          });

          return true;

        });

        /**
         * Set and Check the Result
         */
        _checkAndSetResult(path, _filterSource);

      });


      /**
       * Phase 5
       * 
       * -- Check Required
       * 
       * Check the Required Key!
       */
      _requiredKey.forEach(({
        value: { _original },
        path
      }) => {

        /**
         * Check Value is defined
         */
        const $source = $parsed.$get(path);

        /**
         * Check if is defined
         */
        const _undefinedSource = $source === undefined || $source === null;

        /**
         * If source is not undefined
         * than could skip
         */
        if (!_undefinedSource) {
          return true;
        }

        /**
         * Throw the error for the missing field
         */
        throw new FireDataError({
          $modelName,
          error         : `${path.replace(/\//g, '-')}-missing`,
          functionName  : '$parse checkRequiredFields',
          message       : `Value for path '${path}' at Model '${$modelName}' is Required, but got Undefined/Null`,
          original      : _original
        });

      });


      /**
       * Build the Parsed Object
       * to continue applying validators
       * and formatters
       */
      let $parsedBuilt = $parsed.$build();


      /**
       * Phase 6
       * 
       * -- Check Validators
       * 
       * Check models validators before
       * continue, doing this only
       * if parsing is not in getter mode
       */
      if (!isGetter) {
        let _validatorErrors;

        $model.validators.every(({ checker, error }) => {
          _validatorErrors = !checker.bind(self)($parsedBuilt) ? error : false;
          return !_validatorErrors;
        });

        if (_validatorErrors) {
          throw new FireDataError({
            $modelName,
            error         : `${$modelName.toLowerCase()}/${_validatorErrors.toLowerCase().replace(/[^A-Za-z0-9]/g, '-')}`,
            functionName  : '$parse validateModel',
            message       : `A custom validation error occured for Model '${$modelName}'`
          });
        }
      }


      /**
       * Phase 7
       * 
       * -- Apply Formatters
       * 
       * Apply Models formatters
       * to parsed model
       */
      $model.formatters.forEach(($formatter) => {
        /**
         * The formatters will change
         * the model only if the result is an object
         * not undefined
         */
        const _formattedResult = $formatter.bind(self)($parsedBuilt);

        /**
         * Check result type
         */
        const _validResult = isObject(_formattedResult);

        /**
         * If result is valid
         * then replace the parsed build
         */
        if (_validResult) {
          $parsedBuilt = _formattedResult;
        }

      });


      /**
       * Return the Parsed Object
       */
      return $parsedBuilt;


      /**
       * @function _checkAndSetResult
       * @private
       * 
       * @param {*} _value The Value to Set
       * @param {*} _path The Value Path
       * 
       */
      function _checkAndSetResult(_path, _result) {
        /**
         * Check if result is undefined
         */
        const _resultUndefined = _result === undefined || _result === null;

        /**
         * If result is not undefined, set
         * it to requested path
         */
        if (!_resultUndefined) {
          $parsed.$set(_path, _result);
          return true;
        }

        /**
         * If is in non omit null
         * set null value
         */
        if (!omitNull) {
          $parsed.$set(_path, null);
        }
        
        return true;
      }

    };
  }


  /**
   * @function $extract
   * 
   * @param {String} $extractorName The Name of the Extractor
   * 
   * @description
   * Build an Extractor function using request Extractor
   * keeping data from a parsed model
   * 
   */
  $extract($extractorName) {
    /**
     * Save the Context
     */
    const self = this;

    /**
     * Return the extractor function
     */
    return function extractData($data = {}, { omitNull = true } = {}) {

      /**
       * Get the Model
       */
      const $extractor = _loadModel(self, $extractorName, {
        fn           : '$extract',
        isModel      : false,
        isExtractor  : true,
        isParser     : false
      });

      /**
       * Build the Source and a new
       * extracted data object
       */
      const $extracted = new FireDataObject();
      const $dataSource = $data instanceof FireDataObject
        ? $data
        : new FireDataObject($data);

      /**
       * If data is empty, then return an empty object
       */
      if ($dataSource.$isEmpty()) {
        return {};
      }

      /**
       * Loop each model key
       */
      $extractor._keys.$each(({
        path,
        value
      }) => {

        /**
         * Check if Options is required
         */
        const _isRequired = /^!/.test(value);

        /**
         * Remove ! and ? symbol from value
         * If value length === 0, substitute the value path
         * using original model path
         */
        value = value.replace(/!|\?/g, '') || path;

        /**
         * Get Source from Father
         */
        const $source = $dataSource.$get(value);

        /**
         * Chek if Source is defined
         */
        if ($source === undefined || $source === null) {
          /**
           * Throw error only if is required
           */
          if (_isRequired) {
            throw new FireDataError({
              $extractorName,
              error         : `${path}-missing`,
              functionName  : '$extract extractData',
              message       : `Value for '${path}' is required but got undefined`
            });
          }

          /**
           * Set key as null, only
           * if must not omit null value
           */
          if (!omitNull) {
            $extracted.$set(path, null);
          }

        }

        else {
          /**
           * Save the Property
           */
          $extracted.$set(path, $source);
        }

      });

      /**
       * Return the Extracted Data
       */
      return $extracted.$build();

    };
  }


  /**
   * @function $get
   * 
   * @param {String} $modelName The Model to Use
   * 
   * @description
   * Build a Getter for the requested Model
   * returning a Promise function that could be used
   * to get data from Database
   */
  $get($modelName) {
    /**
     * Save Context
     */
    const self = this;

    /**
     * Return an Async Function
     */
    return async function getDataFromFirebase($getID,
      { omitNull = true, rawData = false, newData, useCache = true } = {}) {

      /**
       * Load the Model
       */
      const $model = _loadModel(self, $modelName, { fn: '$get', isExtractor: true });

      /**
       * Get Father, if Exists
       */
      const $father = $model._extractor ? _loadModel(self, $model._extractor, { fn: '$get' }) : false;

      /**
       * Check if model is IDBased
       */
      const $hasID = $father ? $father.paths.hasID : $model.paths.hasID;

      /**
       * Check ID Parameters
       * if must have one
       */
      const $IDs = _getID($hasID, $getID, { $modelName, fn: '$get', couldBeArray: true });

      /**
       * Build loading Promises
       * array to load all data simultaneous
       */
      const _loadDataPromises = [];

      /**
       * For Each Getting ID
       * load data from database
       */
      $IDs.forEach(($id) => {
        _loadDataPromises.push(
          _loadFirebaseData(
            $father ? $father.paths.read : $model.paths.read,
            self,
            { $hasID, $id, $modelName, fn: '$get loadData', useCache }
          )
        );
      });

      /**
       * Wait for results
       */
      const $loadedData = await Promise.all(_loadDataPromises);

      /**
       * If must parse data
       * then build parsed
       */
      const $parser = self.$parse($modelName);
      const _parserPromises = [];

      $loadedData.forEach(($data) => {
        _parserPromises.push($parser($data, { omitNull, isGetter: true, rawData, newData }));
      });

      /**
       * Wait for parsed data
       */
      const $parsed = await Promise.all(_parserPromises);

      /**
       * Transform Parsed Array into Object
       * If is a single ID, return data only
       */
      const $result = $IDs.length > 1
        ? $parsed.reduce((object, data, index) => (
          { ...object, [$IDs[index]]: data }),
        {})
        : $parsed[0];

      /**
       * If rawData and newData don't exists
       * the $get function is called by user.
       * must execute hook functions
       */
      if (!rawData && !newData) {
        await _executeHook({
          $model   : $father || $model,
          hook     : 'onGet',
          params   : [$result, $IDs.length > 1 ? $IDs : $IDs[0] === '__tmpFireDataModelerID__' ? null : $IDs[0]],
          context  : self
        });
      }

      return $result;

    };

  }


  /**
   * @function $add
   * 
   * @param {String} $modelName The Model to Use
   * 
   * @description
   * Build an Adder function using a Model.
   * The returning function allow to add data to the
   * read path of the models
   * 
   */
  $add($modelName) {
    return _addOrSetData.bind(this)('add', $modelName);
  }


  /**
   * @function $set
   * 
   * @param {String} $modelName The Model to Use
   * 
   * @description
   * Build a Setter function using a Model
   * The returning function allow to set data on
   * the read path of the models
   * 
   */
  $set($modelName) {
    return _addOrSetData.bind(this)('set', $modelName);
  }


  /**
   * @function $update
   * 
   * @param {String} $modelName The Model to Use
   * 
   * @description
   * Build an Updater, a function that could be used
   * to update data on Database.
   * The Updater function could be invoked
   * using multiple params
   * 
   */
  $update($modelName) {
    /**
     * Save Context
     */
    const self = this;

    /**
     * Return the updater functions
     */
    return async function updateDatabaseData($id, $data, _oldLoadedData) {
      /**
       * Get the Model
       */
      const $model = _loadModel(self, $modelName, {
        fn           : '$update',
        isModel      : true,
        isExtractor  : false,
        isParser     : false
      });

      /**
       * Init variables
       */
      const $firebase = _firebaseAdmin.get(self);
      const $updater = new FireDataObject();

      /**
       * Get Model Properties and Init
       * Updating Data variables
       */
      const $hasID = $model.paths.hasID;
      const __tmpID__ = `__fdmID__${Math.floor(Math.random() * 100000)}`;
      let _IDs = [];
      let _allUpdatingData = {};
      let _isSingle;

      /**
       * Check the function params,
       * if model doesn't have ID,
       * then switch the function args
       */
      if (!$hasID) {
        _IDs = [__tmpID__];
        _isSingle = true;
        _allUpdatingData = { [__tmpID__]: $id };
        _oldLoadedData = { [__tmpID__]: $data };
        $id = undefined;
      }

      /**
       * Else, if the $id field is an Object, then its
       * multiple updating data, get all ids and updatingData
       */
      else if (isObject($id) && $hasID) {
        _IDs = Object.getOwnPropertyNames($id);
        _isSingle = false;
        _allUpdatingData = $id;
        /**
         * Delete old loaded data in
         * this case
         */
        _oldLoadedData = undefined;
      }

      /**
       * Else if $id field is a string, then is a single updating
       * data invoke
       */
      else if (typeof $id === 'string' && $hasID && isObject($data)) {
        _IDs = [$id];
        _isSingle = true;
        _allUpdatingData = { [$id]: $data };
      }

      /**
       * Else there is a problem with function parameters
       * and throw an error
       */
      else {
        throw new FireDataError({
          $modelName,
          error         : 'invalid-id',
          functionName  : '$update',
          message       : `Write path for Model '${$modelName}' requires an ID`
        });
      }

      /**
       * Phase 1
       * 
       * -- Get Old data from Database
       * 
       * Load old data and parse it
       * if model has no ID, or updater
       * is single ID, then could check
       * old loaded data variables exists
       */
      const _oldData = {};

      /**
       * Load all old data, using ID
       */
      const _invalidIDs = [];
      const _loadOldDataPromises = [];
      _IDs.forEach(_id => _loadOldDataPromises.push(new Promise(async (resolveLoadOldData) => {

        /**
         * Get Data
         */
        const _loadedData = _oldLoadedData && _oldLoadedData[_id]
          ? await self.$parse($modelName)(_oldLoadedData, { isGetter: true, newData: $data })
          : await self.$get($modelName)($hasID ? _id : null, { rawData: true, newData: $data });

        /**
         * If loaded data is null, then could not
         * update the data because doesn't exists
         */
        if (_loadedData === null) {
          _invalidIDs.push(_id);
          return resolveLoadOldData();
        }

        /**
         * Set Loaded Data
         */
        _oldData[_id] = _loadedData;

        /**
         * Resolve
         */
        return resolveLoadOldData();

      })));

      /**
       * Before continue, wait the data load
       */
      await Promise.all(_loadOldDataPromises);

      /**
       * Filter the IDs, removing all the invalid ids
       * that doesn't contain data
       */
      _IDs = _IDs.filter(_id => !_invalidIDs.includes(_id));

      /**
       * If there are no id to update,
       * return and exit function
       */
      if (!_IDs.length) {
        return true;
      }

      /**
       * Transform Data into FireDataObject
       */
      const _allDataSource = new FireDataObject(_allUpdatingData);
      const _allOldDataSource = new FireDataObject(_oldData);
      const _allParsedDataSource = new FireDataObject();

      /**
       * Loop each updating IDs
       */
      const _buildUpdaterPromises = [];
      _IDs.forEach(_id => _buildUpdaterPromises.push(new Promise(async (resolveBuildUpdater) => {

        /**
         * Init models container
         */
        const _buildedModels = [];
        const _parsedModels = {};
        const _oldModels = {};
        const _diffModels = {};

        /**
         * Get Old Data
         */
        const _newSingleData = _allDataSource.$get(_id);
        const _oldSingleData = _allOldDataSource.$get(_id);

        /**
         * Get old data source for this ID
         * transforming into a FireData Object
         */
        _oldModels[$modelName] = new FireDataObject(_oldSingleData);

        /**
         * Build the new Object
         */
        const _updatedSingleData = _oldModels[$modelName]
          .$clone()
          .$merge(_newSingleData);

        /**
         * Parse the new data
         */
        const $parsedUpdated = await self.$parse($modelName)(
          _updatedSingleData, {
            omitNull  : false,
            oldData   : _oldModels[$modelName],
            newData   : _newSingleData
          }
        );

        /**
         * Save the UpdatedData
         */
        _allParsedDataSource.$set(_id, $parsedUpdated);

        /**
         * Save the Parsed Data
         * and build the models
         */
        _parsedModels[$modelName] = new FireDataObject($parsedUpdated);
        _diffModels[$modelName] = _oldModels[$modelName]
          .$diff(_parsedModels[$modelName]);

        /**
         * Set the Model as Builded
         */
        _buildedModels.push($modelName);

        // console.log({
        //   _old      : _oldModels[$modelName].$keyMap(),
        //   _updated  : _parsedModels[$modelName].$keyMap(),
        //   _diff     : _diffModels[$modelName].$keyMap()
        // });

        /**
         * For Each paths, build the data model,
         * if path model doesn't exists, use the
         * original model
         */
        $model.paths.writes.forEach(({ model = $modelName }) => {
          /**
           * If model has been already builded
           * then exit function
           */
          if (_buildedModels.includes(model)) {
            return true;
          }

          /**
           * Update builded models
           */
          _buildedModels.includes(model);

          /**
           * Build Models
           */
          _oldModels[model] = new FireDataObject(self.$extract(model)(
            _oldSingleData,
            { omitNull: false }
          ));

          _parsedModels[model] = new FireDataObject(self.$extract(model)(
            $parsedUpdated,
            { omitNull: false }
          ));

          _diffModels[model] = _oldModels[model]
            .$diff(_parsedModels[model]);

          return true;
        });

        /**
         * Once all Diff Models are builded
         * create the $updater object to update
         * firebase database
         */
        const _updatedPaths = [];
        const _updatedPromises = [];

        /**
         * Update all Paths
         */
        clone($model.paths.writes)
          /**
           * Update the Path Reference
           * only if is not queried
           */
          .map(($path) => {
            $path.ref = _parsePath(
              self, $path.ref, { $hasID: $hasID && !$path.queryOn, $id: _id }
            );

            return $path;
          })
          /**
           * Loop each path to update
           * the updater object
           */
          .forEach(({ ref, model = $modelName, queryOn, writeChild, snapFilter }) => {
            /**
             * Skip path if is already updated
             */
            if (_updatedPaths.includes(ref)) {
              return true;
            }

            /**
             * Set path has updater
             */
            _updatedPaths.push(ref);

            /**
             * If Path is not queried then
             * save the updater key
             */
            if (!queryOn || !writeChild || !$hasID) {
              /**
               * Add the key to updater
               */
              $updater.$concat(`${ref}`, _diffModels[model]);

              /**
               * Exit Process
               */
              return true;

            }

            /**
             * Else, push a new Promises
             */
            _updatedPromises.push(new Promise(async (resolveQuery) => {
              /**
               * Wait for the snapshots
               */
              const _snapshots = await $firebase.ref(ref).orderByChild(queryOn).equalTo(_id).once('value');

              /**
               * For each snapshot, update the updater object
               */
              _snapshots.forEach((_snap) => {
                /**
                 * Check if must filter snapshot
                 */
                if (typeof snapFilter === 'function' && !snapFilter(_snap)) {
                  /**
                   * Must return false to let the
                   * forEach cycle continue
                   */
                  return false;
                }

                /**
                 * Create the Updater
                 * Path for this Snap
                 */
                $updater.$concat(`${ref}/${_snap.key}/${writeChild}`, _diffModels[model]);

                /**
                 * Must return false to let
                 * the forEach cycle continue
                 */
                return false;

              });

              return resolveQuery();

            }));

            return true;

          });

        /**
         * Wait the resolution
         * of all sub promises
         */
        await Promise.all(_updatedPromises);

        /**
         * Resolve the ID Updater
         * Build Promise
         */
        return resolveBuildUpdater();

      })));

      /**
       * Await the resolution of all
       * single ID updater promises
       */
      await Promise.all(_buildUpdaterPromises);

      /**
       * Check if the updater
       * is not empty
       */
      if ($updater.$isEmpty()) {
        return true;
      }

      /**
       * Build the Hook Functions params
       * and execute the onUpdate function
       */
      const _hookParams = [];

      if (_isSingle) {
        _hookParams.push(
          _allParsedDataSource.$get(_IDs[0]),
          _allOldDataSource.$get(_IDs[0]),
          _IDs[0] === __tmpID__ ? null : _IDs[0]
        );
      }

      else {
        _hookParams.push(
          _allParsedDataSource.$build(),
          _allOldDataSource.$build(),
          _IDs
        );
      }

      await _executeHook({
        $model,
        hook     : 'onUpdate',
        params   : _hookParams,
        context  : self
      });

      /**
       * Send the Updater to Firebase
       */
      await _sendFirebaseData(self, $updater.$keyMap(), {
        firebaseAdmin  : $firebase,
        cacheUpdater   : true
      });

      /**
       * Execute the Hook functions
       * after update
       */
      await _executeHook({
        $model,
        hook     : 'afterUpdate',
        params   : _hookParams,
        context  : self
      });

      /**
       * Return the updater
       */
      return $updater.$build();

    };
  }


  /**
   * @function $delete
   * 
   * @param {String} $modelName The Model to Use
   * 
   * @description
   * Build a Deleter function using a Model
   * The returning function allow to delete data
   * on the read path of the models, and on all
   * other linked paths.
   * ID passed to Deleter function could be an
   * array to delete multiple entries
   * 
   */
  $delete($modelName) {
    /**
     * Save the Context
     */
    const self = this;

    /**
     * Return the deleter function
     */
    return async function deleteDataOnDatabase($id) {

      /**
       * Get the Model
       */
      const $model = _loadModel(self, $modelName, {
        fn           : '$delete',
        isModel      : true,
        isParser     : false,
        isExtractor  : false
      });

      /**
       * Get if has ID
       * and build the ID array
       */
      const { hasID: $hasID, read: _mainReadPath } = $model.paths;
      const $ids = $hasID
        ? (typeof $id === 'string' ? [$id] : Array.isArray($id) ? $id.slice() : [])
        : [];

      /**
       * Check IDS
       */
      if ($hasID && !$ids.length) {
        throw new FireDataError({
          $modelName,
          error         : 'invalid-id',
          functionName  : '$delete',
          message       : `Write path for Model '${$modelName}' requires one or more IDs`
        });
      }

      /**
       * Load Firebase Instance and the Updater
       * to build
       */
      const _updaterPromises = [];
      const _updatedPaths = [];
      const $updater = {};
      const $firebase = _firebaseAdmin.get(self);

      /**
       * If IDS length is 1, or the models hasn't ID,
       * can load raw data to pass to hook functions,
       * else, to avoid multiple data load, skip this steps
       */
      let $deletingData = null;

      if (($hasID && $ids.length === 1) || !$hasID) {
        $deletingData = await _loadFirebaseData(
          _mainReadPath,
          $firebase,
          { $hasID, $id: $ids[0], $this: self, $modelName, useCache: true }
        );

        /**
         * If there are no deleting data
         * then can return immediatly null
         * to avoid unusefull other operations
         */
        if ($deletingData === null) {
          return null;
        }
      }

      /**
       * Clone the Model paths
       */
      clone($model.paths.writes)
        /**
         * Loop all paths
         */
        .forEach(({ ref, queryOn, writeChild, referenceModel, snapFilter }) => {
          /**
           * If path has already been updated
           * skip it
           */
          if (_updatedPaths.includes(ref)) {
            return true;
          }
          
          /**
           * If path has not to be queried, save
           * the key into the updater
           */
          if (!queryOn || !writeChild || !$hasID) {
            /**
             * Set path has updated
             */
            _updatedPaths.push(ref);

            /**
             * For Each ID generate the
             * updater key
             */
            $ids.forEach((_id) => {
              const _path = _parsePath(self, ref, { $hasID, $id: _id });
              $updater[_path] = null;
            });

            /**
             * Exit loop
             */
            return true;
          }

          /**
           * Else, build a query for
           * all the ids
           */
          $ids.forEach(_id => _updaterPromises.push(new Promise(async (resolveQuery) => {
            /**
             * Build the updated paths array
             */
            const _updateSubPaths = [ref];

            /**
             * If a reference model exists,
             * save all paths
             */
            if (typeof referenceModel === 'string') {
              try {
                /**
                 * Load the Model
                 */
                const { 
                  paths: { 
                    writes: _referenceWritePaths } } = _loadModel(self, referenceModel, {
                  fn           : '$delete getReferenceModel',
                  isModel      : true,
                  isExtractor  : false,
                  isParser     : false
                });
  
                _referenceWritePaths
                  .filter(_rPath => !_rPath.queryOn && !_updatedPaths.includes(_rPath.ref))
                  .forEach((_rPath) => {
                    _updateSubPaths.push(_parsePath(self, _rPath.ref));
                  });
              }
              catch (e) {} //eslint-disable-line
            }

            /**
             * Get Query Snapshot
             */
            const _snapshots = await $firebase.ref(_parsePath(self, ref)).orderByChild(queryOn).equalTo(_id).once('value');

            /**
             * For each snapshot build the updated
             * key, filtering using snapFilter function if
             * exists
             */
            _snapshots.forEach((_snap) => {
              /**
               * Check if must filter
               */
              if (typeof snapFilter === 'function' && !snapFilter(_snap)) {
                /**
                 * Must return false to let the
                 * forEach cycle continue
                 */
                return false;
              }

              /**
               * Create Updater Path for this Snap
               */
              _updateSubPaths.forEach((_updatePath) => {
                const _basePath = _parsePath(self, _updatePath);
                $updater[`${_basePath}/${_snap.key}/${writeChild}`] = null;
                $updater[`${_basePath}/${_snap.key}/${queryOn}`] = null;
              });

              /**
               * Must return false, to let the
               * forEach cycle continue
               */
              return false;
            });

            /**
             * Resolve Queried Results
             */
            return resolveQuery();

          })));

          /**
           * Exit Process
           */
          return true;

        });

      /**
       * Wait the resolution
       * of all _updater promises
       */
      await Promise.all(_updaterPromises);

      /**
       * Before sending the Updater
       * execute all hook functions
       */
      await _executeHook({
        $model,
        hook     : 'onDelete',
        params   : [$deletingData, $ids.length === 0 ? null : $ids],
        context  : self
      });

      /**
       * Send the Updater
       */
      await _sendFirebaseData(self, $updater, { firebaseAdmin: $firebase, cacheUpdater: true });

      /**
       * Execute Hook Functions
       * after delete
       */
      await _executeHook({
        $model,
        hook     : 'afterDelete',
        params   : [$deletingData, $ids.length === 0 ? null : $ids],
        context  : self
      });

      /**
       * Return the deleted data
       */
      return $deletingData;

    };
  }


  /**
   * @function $drop
   * 
   * @param {String} $modelName Model Name
   * 
   * @description
   * Drop entire data from Database
   * 
   */
  async $drop($modelName) {
    /**
     * Get the Model
     */
    const $model = _loadModel(this, $modelName, {
      fn           : '$drop',
      isModel      : true,
      isExtractor  : false,
      isParser     : false
    });

    /**
     * Build a new Empty Updater
     */
    const $updater = new FireDataObject();

    /**
     * Node will be dropped only if
     * is not queried. This is necessary
     * to avoid infinite query
     */
    clone($model.paths.writes)
      /**
       * Filter for not queried
       */
      .filter(({ queryOn }) => !queryOn)
      /**
       * Parse path and set into
       * updater
       */
      .forEach(({ ref }) => {
        $updater.$set(_parsePath(this, ref), null);
      });

    /**
     * If updater is empty, return
     */
    if ($updater.$isEmpty()) {
      return true;
    }

    /**
     * Else, send data to firebase
     */
    await _sendFirebaseData(this, $updater.$keyMap(), { cacheUpdater: true });

    /**
     * Exit Function
     */
    return true;

  }

}


function _addOrSetData($mode, $modelName) {
  /**
   * Save the Context
   */
  const self = this;

  /**
   * Return the Adder Functions
   */
  return async function addDataToDatabase($data, { id } = {}) {

    /**
     * Get the Model
     */
    const $model = _loadModel(self, $modelName, {
      fn           : `$${$mode}`,
      isModel      : true,
      isExtractor  : false,
      isParser     : false
    });

    /**
     * Check the function mode
     * and the model id to check if the
     * function is the right one for this model
     */
    if (($mode === 'set' && $model.paths.hasID) || ($mode === 'add' && !$model.paths.hasID)) {
      throw new FireDataError({
        $modelName,
        error         : 'invalid-function',
        functionName  : `$${$mode}`,
        message       : `Model '${$modelName}' is a ${$mode === 'set' ? 'ID' : 'non-ID'} based model. Use $${$mode === 'set' ? 'add' : 'set'} function to set data on Database instead of the $add function`
      });
    }

    /**
     * Get the Admin Instance
     * and a new ID if is not provided
     */
    const $firebase = _firebaseAdmin.get(self);
    const $id = $mode === 'add' ? id || $firebase.ref().push().key : null;

    /**
     * Build the Updater
     */
    const $updater = {};

    /**
     * Get the Parsed data
     */
    const $parsedData = await self.$parse($modelName)($data);

    /**
     * If parsed data is empty
     * then throw an error
     */
    if (!Object.keys($parsedData).length) {
      throw new FireDataError({
        $modelName,
        error         : 'invalid-data',
        functionName  : `$${$mode}`,
        message       : `You cannot ${$mode} empty data to Database`,
      });
    }

    /**
     * Build an All Data Source
     * to use to load data on firebase
     */
    const _updatedPaths = [];
    const _allDataSource = {
      [$modelName]: $parsedData
    };

    /**
     * Build Paths
     */
    clone($model.paths.writes)
      /**
       * Remove queried path
       */
      .filter(_path => !_path.queryOn)

      /**
       * Parse the path
       */
      .map(($path) => {
        $path.$id    = $id;
        $path.ref    = _parsePath(self, $path.ref, { $hasID: $mode === 'add', $id });
        $path.model  = $path.model || $modelName;
        return $path;
      })

      /**
       * For Each other, build the model
       * if is not already built, and add
       * the path to updater
       */
      .forEach(({ ref, model }) => {
        /**
         * Exit function if is already updated
         */
        if (_updatedPaths.includes(ref)) {
          return true;
        }

        _updatedPaths.push(ref);

        /**
         * Build data if is undefined
         */
        if (typeof _allDataSource[model] === 'undefined') {
          _allDataSource[model] = self.$extract(model)($parsedData);
        }

        /**
         * Update the Updater
         */
        $updater[ref] = _allDataSource[model];

        /**
         * Done
         */
        return true;

      });

    /**
     * Before sending the updater
     * execute hook function before add
     */
    await _executeHook({
      $model,
      hook     : $mode === 'add' ? 'onAdd'  : 'onSet',
      params   : [$parsedData, $id],
      context  : self
    });

    /**
     * Send the Updater
     */
    await _sendFirebaseData(self, $updater, {
      firebaseAdmin  : $firebase,
      cacheUpdater   : true
    });

    /**
     * Execute Hook Function after add data
     */
    await _executeHook({
      $model,
      hook     : $mode === 'add' ? 'afterAdd'  : 'afterSet',
      params   : [$parsedData, $id],
      context  : self
    });

    /**
     * Return the ID of added data
     */
    return $id;

  };

}


/**
 * @function _sendFirebaseData
 * 
 * @param {Object} $updater The Updater to Send
 * @param {Object} $this The this Context
 * @param {Object} [$configuration]
 * @param {String} [$configuration.basePath=''] The base reference Path
 * @param {Object} [$configuration.firebaseAdmin] The Allready loaded firebase instance
 * @param {Boolean} [$configuration.cacheUpdater=true] If must cache the updater
 * 
 */
function _sendFirebaseData($this, $updater, { basePath = '', firebaseAdmin = _firebaseAdmin.get($this), cacheUpdater = true } = {}) {
  return new Promise(async (resolveSendingData) => {
    /**
     * Check updater is a valid object
     */
    if (typeof $updater !== 'object' || $updater === null) {
      return resolveSendingData();
    }

    /**
     * Send Data to Firebase
     */
    await firebaseAdmin.ref(basePath || '/').update($updater);

    /**
     * If must cache the Updater
     * save it into cache data
     */
    if (cacheUpdater === true && isCachable($this)) {
      Object.getOwnPropertyNames($updater).forEach(($key) => {
        saveToCache($this, $key, $updater[$key]);
      });
    }

    return resolveSendingData();

  });
}


/**
 * @function _loadFirebaseData
 * 
 * @param {String} $rawPath Raw Path into Read Data
 * @param {Object} $context Function this Context
 * @param {Object} [$configuration]
 * @param {Boolean} [$configuration.$hasID=true] If Path has ID
 * @param {String} [$configuration.$id] The ID to Replace
 * @param {Object} [$configuration.$this] The Context (to use if $context was $firebase instance)
 * @param {String} [$configuration.$modelName] The Model Name
 * @param {String} [$configuration.fn] The Name of the Function who request the load Data
 * @param {Boolean} [$configuration.useCache=true] If must search for cache result before downloading data
 * 
 */
function _loadFirebaseData(
  $rawPath,
  $context,
  { $hasID = true, $id, $this = $context, $modelName, fn, useCache = true } = {}
) {

  const $firebase = $context instanceof FirebaseTalker
    ? _firebaseAdmin.get($context)
    : $context;

  const $path = _parsePath($this, $rawPath, { $hasID, $id });

  /**
   * Load result from cache,
   * set the callback to set cache if
   * doesn't exists
   */
  return new Promise((resolveFirebaseData, rejectFirebaseData) => getFromCache($this, $path,
    () => new Promise((resolveLoad, rejectLoad) => {
      $firebase.ref($path).once('value',
        $snapshot => resolveLoad($snapshot.exportVal()),
        original => rejectLoad(new FireDataError({
          $modelName,
          original,
          functionName  : fn,
          error         : 'load-data-error',
          message       : `An Error occured while loading data from Firebase Database on path ${$path}`
        })));
    }), useCache)
    .then(resolveFirebaseData)
    .catch(rejectFirebaseData));

}


/**
 * @function isCachable
 * 
 * @param {Object} $this Firebase Talker Instance
 * 
 * @description
 * Check if current instance is Cachable
 * 
 */
function isCachable($this) {
  return !!_options.get($this).cacheable;
}


function Cache($this) {
  const $cache = _cache.get(_dataModeler.get($this));

  return {
    get($key, $callback) {
      return $cache.get($key, $callback);
    },
    
    set($key, $value, $ttl, $callback) {
      return $cache.set($key, $value, $ttl, $callback);
    }
  };

}


/**
 * @function getFromCache
 * 
 * @param {Object} $this Context to Load Cache
 * @param {String} $key Cache Key
 * @param {Function} $cb Callback to Execute if cached doesn't exists, must be a Promise
 * 
 * @return {Promise}
 */
function getFromCache($this, $key, $cb, _useCache = true) {
  return new Promise((resolveCached, rejectCached) => {
    /**
     * If is not Cacheable, return the CB
     */
    if (!isCachable($this) || !_useCache) {
      return $cb()
        .then(resolveCached)
        .catch(rejectCached);
    }

    /**
     * Get the Value
     */
    const $cached = Cache($this).get($key);

    /**
     * If cached exists return value
     */
    if ($cached !== undefined) {
      return resolveCached($cached);
    }

    /**
     * Else, execute callback and cashe it
     */
    return $cb()
      .then(($result) => {
        Cache($this).set($key, $result);
        resolveCached($result);
      })
      .catch(rejectCached);
  
  });
}


function saveToCache($this, $key, $value) {
  /**
   * If is not cacheable,
   * return
   */
  if (!isCachable($this)) {
    return true;
  }

  /**
   * Set Value
   */
  Cache($this).set($key, $value);

  return true;

}


/**
 * @function loadFunction
 * 
 * @param {Object} $this The Firebase Talker Instance
 * @param {String} $name Model Nmae to Load
 * 
 * @description
 * Load a function by name
 */
function loadFunction($this, $name) {
  return _functions.get(_dataModeler.get($this))[$name];
}


/**
 * @function loadFilter
 * 
 * @param {Object} $this The Firebase Talker Instance
 * @param {String} $name Model Nmae to Load
 * 
 * @description
 * Load a filter by name
 */
function loadFilter($this, $name) {
  return _filters.get(_dataModeler.get($this))[$name];
}


/**
 * @function clone
 * 
 * @param {Object[]} $object Object to Clone
 * 
 * @description
 * Deep Clone an Object
 */
function clone($object = []) {
  return new FireDataObject($object).$clone().$build();
}

module.exports = FirebaseTalker;
