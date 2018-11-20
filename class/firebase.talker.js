
/**
 * Require External Modules
 */
const _dataReparse = new WeakMap();

/**
 * Load Utils
 */
const FireDataObject = require('../class/fire.data.object');
const FireDataError = require('../utils/fire.data.error');
const escapeRegExp = require('../utils/escape.regexp');

/**
 * Constant
 */
const CONST = {
  ID_REGEX: /(?:(?!\/)|^)(\$id)(?=\/|$)/
};

class FirebaseTalker {

  /**
   * 
   * @param {FireDataModeler} DataModeler The FireData Modeler Object
   * @param {Object} admin Firebase Admin Object
   * @param {Array} pathReplacers Replacers for Firebase Reference Path
   */
  constructor(DataModeler, admin, pathReplacers = [], forceReparse = false) {

    /**
     * Save the Data Modeler
     * and the Admin Instance
     */
    _dataModeler.set(this, DataModeler);
    _firebaseAdmin.set(this, admin);
    _pathReplacers.set(this, Array.isArray(pathReplacers) ? pathReplacers : []);
    _dataReparse.set(this, forceReparse);

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
    if (!/^([A-Z]|[a-z])+$/.test(find)) {
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
    return parseFirebaseReference(this, path);
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
    _dataReparse.delete(this);

  }


  /**
   * @function $parse
   * 
   * @param {String} $modelName Model to Use
   * 
   */
  $parse($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$parse',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Return a Function that accept an arguments
     * that has to be an Object.
     * The Parsing function will return a Promise
     * with the parsed data
     */
    return function parseDataWithModel(
      $data = {},
      { omitNull = true,
        isGetter = false,
        rawData = false,
        oldData,
        newData } = {}
    ) {

      const $dataSource = new FireDataObject($data);
      const $oldDataSource = new FireDataObject(oldData);
      const $newDataSource = new FireDataObject(newData);

      return new Promise((resolve, reject) => {
        /**
         * Check Data is Valid Data Object
         */
        if (typeof $data !== 'object' || $data === null) {
          $data = {};
        }

        new Promise((resolveFather, rejectFather) => {
          /**
           * If the Model is an Extractor, then
           * load the father model
           */
          if (!$model._extractor) {
            return resolveFather(false);
          }

          return self.$parse($model._extractor)(
            $data, { omitNull, rawData, isGetter, oldData, newData }
          )
            .then(resolveFather)
            .catch(original => rejectFather(new FireDataError({
              $modelName,
              error         : 'load-father-error',
              functionName  : '$parse',
              message       : `Error loading Father Model for ${$modelName}`,
              original
            })));

        })

          /**
           * Phase 2.
           * Get all data and build the Start Parsed model
           * before apply all formatters and validators
           */
          .then($father => new Promise((resolveParsing, rejectParsing) => {
  
            /**
             * If there is $father object
             * this Model is only an extractor
             * of the main model
             */
            if (typeof $father === 'object') {

              /**
               * Resolve Entire Parsing
               */
              return resolveParsing({
                $parsed         : self.$extract($modelName)($father),
                $functionField  : []
              });

            }

            /**
             * If no Father has been loaded, than
             * must use entire _keys data to load and
             * parse all the requested field
             */

            const $parsed = new FireDataObject();

            const $firebase = _firebaseAdmin.get(self);
            const $promises = [];
            const $functionField = [];
            const $filterField = [];

            /**
             * For each model key, parse and get the
             * correct value
             */
            $model._keys.$each(({ path, value }) => {

              /**
               * If the Field has a Filter
               * then append to Filters array
               */
              if (value.filters.length) {
                $filterField.push({ path, value });
              }

              /**
               * If request value isn't a Model value
               * must simply get and parse the value
               * from source data
               */
              if (!value.isModel && !value.isFunction) {
                /**
                 * Get the Source
                 */
                let correctType = false;
                let $source = $dataSource.$get(path);
                let $casted;
                let $isObject;
                let $isArray;

                /**
                 * Switch from all cases to evaluate
                 * if source for data is in the correct type
                 */
                switch (value.variable) {
                  case 'string':

                    $casted = ($source !== undefined && $source !== null) && $source.toString();

                    if (value.autoCast && $casted) {
                      $source = $casted;
                    }

                    correctType = typeof $source === 'string';

                    break;

                  case 'number':

                    $casted = +$source;

                    if (value.autoCast && !Number.isNaN($casted)) {
                      $source = $casted;
                    }

                    correctType = typeof $source === 'number';

                    break;

                  case 'boolean':

                    $casted = !!$source;

                    if (value.autoCast) {
                      $source = $casted;
                    }

                    correctType = typeof $source === 'boolean';

                    break;

                  case 'object':
                    $isObject = typeof $source === 'object' 
                      && !Array.isArray($source) 
                      && $source !== null;

                    if (value.autoCast && !$isObject) {
                      $source = { value: $source };
                      $isObject = true;
                    }

                    correctType = $isObject;

                    break;

                  case 'array':
                    $isArray = typeof $source === 'object'
                      && Array.isArray($source);

                    if (value.autoCast && !$isArray) {
                      $source = [$source];
                      $isArray = true;
                    }

                    correctType = $isArray;

                    break;

                  default:
                    correctType = false;
                }

                /**
                 * Validate Data
                 */
                if ($source === null && value.required) {
                  throw new FireDataError({
                    $modelName,
                    error         : `${path}-missing`,
                    functionName  : '$parse parseData',
                    message       : `Value for '${path}' is required but got undefined`
                  });
                }

                if (!correctType && value.required) {
                  throw new FireDataError({
                    $modelName,
                    error         : `${path}-error`,
                    functionName  : '$parse parseData',
                    message       : `Value for '${path}' is required as '${value.variable}' but got '${typeof $source}'`
                  });
                }

                /**
                 * Save data only if are correct
                 */
                if ($source !== null && correctType) {
                  $parsed.$set(path, $source);
                }

                else if (!omitNull) {
                  $parsed.$set(path, null);
                }

              }

              /**
               * Else, must load a Promise, to retreive correct
               * data from a Firebase ID Models and after
               * correctly loaded, put into the correct key
               */
              else if (value.isModel) {
                /**
                 * Check Parsed Model exists
                 */
                const $parsingModel = loadModel(self, value.variable);

                /**
                 * Check Model Exists
                 */
                if (!$parsingModel) {
                  throw new FireDataError({
                    $modelName    : value.variable,
                    error         : 'dont-exists',
                    functionName  : '$parse subParse',
                    message       : `Required Model ${value.variable} from ${$modelName} doesn't Exists`
                  });
                }

                /**
                 * Divide flow, if is a value referenced
                 * or binded, then must load the correct
                 * source from data
                 */
                if (value.reference || value.bind) {
  
                  /**
                   * Get Exchange Field
                   */
                  const $exchangeField = value.params[0];
  
                  /**
                   * Get the Source
                   */
                  let $source = $dataSource.$get($exchangeField);
  
                  /**
                   * Check exchange field consistency depending
                   * on isModelArray
                   */
                  const isString = typeof $source === 'string';
  
                  const isValid = (value.isModelArray && (isString
                      || (typeof $source === 'object' && $source !== null && Array.isArray($source))
                      || (Array.isArray($source) && $source.length))) || isString;
  
                  if (!value.isModelArray) {
                    if (!isString && value.required) {
                      throw new FireDataError({
                        $modelName,
                        error         : `${path}-invalid-exchange-field`,
                        functionName  : '$parse subParse',
                        message       : `Value for '${path}' require field '${$exchangeField}' to be a String but got ${typeof $source}`
                      });
                    }
                  }
  
                  /**
                   * If is a Model Array then data must be a String, an Array
                   * or an object with key: true structure
                   */
                  else {
  
                    if (!isValid && value.required) {
                      throw new FireDataError({
                        $modelName,
                        error         : `${path}-exchange-field-not-array`,
                        functionName  : '$parse subParse',
                        message       : `Value for '${path}' require field '${$exchangeField}' to be a valid Array Model but got ${$source}`
                      });
                    }
  
                    /**
                     * If is Valid, transform source
                     */
                    if (isValid) {
                      $source = buildSourceString($source);
                    }
                  }
  
                  /**
                   * If Source is Null
                   * then set null property of master key
                   * and of the exchange field
                   */
                  if ($source === null && !omitNull) {
                    $parsed.$set(path, null);
                    $parsed.$set($exchangeField, null);
                  }
  
                  const $oldSource = buildSourceString($oldDataSource.$get($exchangeField));
  
                  /**
                   * Check if data has changed
                   */
                  const $dataHasChanged = $source !== $oldSource;
                  const $existanceData = $dataSource.$get(path);
  
                  if (isValid 
                    && (value.bind 
                      || (value.reference && (!$existanceData || $dataHasChanged))) && !rawData) {
                    
                    /**
                     * Build a Getter and execute it
                     * only if value is bind type or if
                     * is referecens and data doesn't exists
                     */
                    const $getter = self.$get(value.variable);
  
                    $source.split(value.isModelArray ? ' ' : null).forEach(($sourceID) => {
                      $promises.push(
                        new Promise((resolveGetter, rejectGetter) => {
                          $getter($sourceID)
                            .then(($parsedSource) => {
                              /**
                               * If model doens't exists, but field is required
                               * then throw an Error
                               */
                              if ($parsedSource === null && value.required) {
                                return rejectGetter(new FireDataError({
                                  $modelName,
                                  error         : 'invalid-model-data',
                                  functionName  : '$parse loadFirebaseData',
                                  message       : `Value for '${path}' require valid data for model '${value.variable}'`,
                                  data          : { received: $parsedSource }
                                }));
                              }
  
                              /**
                               * If model exists, save into field
                               * if is a ModelArray save into an Object
                               */
                              $parsed.$set(value.isModelArray ? `${path}/${$sourceID}` : path, $parsedSource);
  
                              /**
                               * Save the ID Fields if data exists
                               */
                              if ($parsedSource !== null) {
                                if (value.isModelArray) {
                                  $parsed.$set(`${$exchangeField}/${$sourceID}`, true);
                                }
                                
                                else {
                                  $parsed.$set($exchangeField, $source);
                                }
                              }
                              /**
                               * Else, remove source ID Fields
                               */
                              else if (value.isModelArray) {
                                $parsed.$set(`${$exchangeField}/${$sourceID}`, null);
                              }
  
                              else {
                                $parsed.$set($exchangeField, null);
                              }
  
                              return resolveGetter();
                            })
                            .catch(original => rejectGetter(new FireDataError({
                              $modelName,
                              error         : 'firebase-loading-error',
                              functionName  : '$parse loadFirebaseData',
                              message       : `An error occured while loading data for '${path}'`,
                              original
                            })));
                        })
                      );
                    });
                  }
  
                  /**
                   * If Value is referenced and already exists
                   * copy data into parsed
                   */
                  else if ((isString && value.reference && $existanceData) || rawData) {
                    $parsed.$set(path, $existanceData);
                    $parsed.$set($exchangeField, $source);
                  }
                }

                /**
                 * Else if is a sub parser than
                 * must parse it use the model
                 * If is not an array, simply parse
                 * data and put the result into the $parsed object
                 */
                else {
                  /**
                   * Get the source
                   */
                  const $source = $dataSource.$get(path);

                  /**
                   * If source is null, then stop
                   */
                  if ($source === null && value.required) {
                    throw new FireDataError({
                      $modelName,
                      error         : `${path}-missing`,
                      functionName  : '$parse parseData',
                      message       : `Value for '${path}' is required but got undefined`
                    });
                  }

                  else if ($source === null && !omitNull) {
                    $parsed.$set(path, null);
                  }

                  /**
                   * If model is not an Array
                   * simply parse the source
                   */
                  else if ($source !== null && !value.isModelArray) {
                    $promises.push(
                      new Promise((resolveSubparsing, rejectSubparsing) => {
                        self.$parse(value.variable)($source)
                          .then(($parsedSource) => {
                            /**
                             * If object is empty set null
                             */
                            if (!Object.keys($parsedSource).length && !omitNull) {
                              $parsed.$set(path, null);
                            }

                            else if (Object.keys($parsedSource).length) {
                              $parsed.$concat(path, $parsedSource);
                            }

                            resolveSubparsing();

                          })
                          .catch(rejectSubparsing);
                      })
                    );
                  }
  
                  /**
                   * If is a Model Array then
                   * check source type
                   */
                  else if ($source !== null) {
                    /**
                     * If model is not a Getter then check source
                     * is an Array
                     */
                    if (!isGetter && !Array.isArray($source) && !oldData) {
                      throw new FireDataError({
                        $modelName,
                        error         : `${path}-error`,
                        functionName  : '$parse parseData',
                        message       : `Value for '${path}' is required as Array but got '${typeof $source}'`
                      });
                    }

                    /**
                     * If Model is a Getter then $source is an Array
                     * and must be converted into a key-id child
                     */
                    else if (!isGetter && Array.isArray($source)) {
                      const $subPromises = [];

                      $source.forEach(($arrayData) => {
                        /**
                         * For each get an ID
                         */
                        const $sourceID = $firebase.ref().push().key;

                        /**
                         * Parse each Child
                         */
                        $subPromises.push(
                          new Promise((resolveSubparsing, rejectSubparsing) => {
                            self.$parse(value.variable)($arrayData)
                              .then(($parsedSource) => {
                                /**
                                 * If object is empty set null
                                 */
                                if (!Object.keys($parsedSource).length && !omitNull) {
                                  $parsed.$set(`${path}/${$sourceID}`, null);
                                }

                                else if (Object.keys($parsedSource).length) {
                                  $parsed.$concat(`${path}/${$sourceID}`, $parsedSource);
                                }

                                resolveSubparsing();
                              })
                              .catch(rejectSubparsing);
                          })
                        );
                      });

                      /**
                       * Tell promise to wait the resolution of
                       * all subpromise
                       */
                      $promises.push(Promise.all($subPromises));
                    }

                    else if (isGetter || oldData) {
                      /**
                       * Get new Data if Exists
                       */
                      const $newSource = $newDataSource.$get(path);

                      /**
                       * If no New Data Exists, copy the
                       * source in toto
                       */
                      if ($newSource === null || !Array.isArray($newSource)) {
                        $parsed.$set(path, $source);
                      }

                      /**
                       * If new Data is an Array, then
                       * replace all items
                       */
                      else if (Array.isArray($newSource)) {
                        const $subPromises = [];

                        $newSource.forEach(($arrayData) => {
                          /**
                           * For each get an ID
                           */
                          const $sourceID = $firebase.ref().push().key;

                          /**
                           * Parse each Child
                           */
                          $subPromises.push(
                            new Promise((resolveSubparsing, rejectSubparsing) => {
                              self.$parse(value.variable)($arrayData)
                                .then(($parsedSource) => {
                                  /**
                                   * If object is empty set null
                                   */
                                  if (!Object.keys($parsedSource).length && !omitNull) {
                                    $parsed.$set(`${path}/${$sourceID}`, null);
                                  }

                                  else if (Object.keys($parsedSource).length) {
                                    $parsed.$concat(`${path}/${$sourceID}`, $parsedSource);
                                  }

                                  resolveSubparsing();
                                })
                                .catch(rejectSubparsing);
                            })
                          );
                        });

                        /**
                         * Tell promise to wait the resolution of
                         * all subpromise
                         */
                        $promises.push(Promise.all($subPromises));
                      }
                    }
                  }
                }
              }

              /**
               * Else if, field is a function
               * push into function field to evaluate them
               * after all other fields are parsed
               */
              else if (value.isFunction) {
                $functionField.push({ path, value });
              }

            });

            /**
             * Wait the resolution of all
             * promises before resolve
             */
            return Promise.all($promises)
              .then(() => resolveParsing({ $parsed, $functionField, $filterField }))
              .catch(rejectParsing);

          }))

          /**
           * Phase 3.
           * Evaluate the Functions fields
           */
          .then(({
            $parsed,
            $functionField = [],
            $filterField = []
          }) => new Promise((resolveFn, rejectFn) => {
            /**
             * To let user use promises function
             * must create a promises array
             */
            const $promises = [];

            /**
             * Build functions array to reoder it
             * using 'priority' fields
             */
            const $functions = [];

            $functionField.forEach(({ path, value }) => {
              /**
               * Get the Function
               */
              const $function = loadFunction(self, value.variable);

              /**
               * Check function exists
               */
              if (typeof $function.callback !== 'function') {
                return rejectFn(new FireDataError({
                  $modelName,
                  error         : 'invalid-function-name',
                  functionName  : '$parse compileFunctions',
                  message       : `Value for '${path}' require function '${value.variable}' but doens't exists`,
                  data          : { name: value._original }
                }));
              }

              /**
               * Push elements into array
               */
              $functions.push({
                path,
                value,
                callback  : $function.callback,
                priority  : $function.priority
              });

              return true;
            });

            /**
             * Loop and execute function
             * with priority order
             */
            $functions
              /** Sort by Priority */
              .sort(({ priority: pA }, { priority: pB }) => pB - pA)

              /** Evaluate Fields */
              .forEach(({ path, value, callback }) => {
                
                /**
                 * Get Source and check if is
                 * undefined or null
                 */
                const $source = $dataSource.$get(path);
                const sourceUndefined = $source === undefined || $source === null;

                /**
                 * If function is not executed in getter mode
                 * can compile it
                 */
                if (!isGetter) {

                  /**
                   * The function must be invoked only if
                   * the source is undefined or if
                   * the value is binded
                   */
                  if (sourceUndefined || value.bind) {
                    /**
                     * Build function arguments
                     */
                    const $args = [];
  
                    /**
                     * Get Args from parsed data
                     */
                    value.params.forEach(($param) => {
                      $args.push($parsed.$get($param));
                    });
  
                    /**
                     * Add Talker instance as last args
                     */
                    $args.push(self);
  
                    /**
                     * Execute the function
                     */
                    const $fnResult = callback.apply(
                      $parsed instanceof FireDataObject
                        ? $parsed.$build()
                        : $parsed,
                      $args
                    );
  
                    /**
                     * Check if $fnResult is a Promise
                     */
                    if (typeof $fnResult === 'object'
                      && $fnResult !== null
                      && typeof $fnResult.then === 'function'
                      && typeof $fnResult.catch === 'function') {
  
                      /**
                       * If is a Promise, wait for the
                       * resolution, and then
                       * place the result
                       */
                      $promises.push(
                        new Promise((resolveFnResult, rejectFnResult) => {
                          $fnResult
                            .then(($result) => {
                              setAndCheck($result, path, value);
                              resolveFnResult();
                            })
                            .catch(e => rejectFnResult(`${$modelName.toLowerCase()}/${e}`));
                        })
                      );
                    }
  
                    else {
                      setAndCheck($fnResult, path, value);
                    }
                  }

                  /**
                   * Else, if source is not undefined, must
                   * simply transport the value from source to parsed
                   */
                  else if (!sourceUndefined) {
                    $parsed.$set(path, $source);
                  }
                }

                /**
                 * Else, transport the field into model
                 */
                else if (!sourceUndefined) {
                  $parsed.$set(path, $source);
                }

                /**
                 * If source is undefined, set it
                 * only if we are not omitting null value
                 */
                else if (!omitNull) {
                  $parsed.$set(path, null);
                }
                
              });

            /**
             * @function setAndCheck
             * 
             * @param {*} $result The Function Result
             * @param {String} path Path to place result
             * @param {Object} value The path original value object
             * 
             */
            function setAndCheck($result, path, { required, _original }) {
              /**
               * Check if result if undefined
               */
              const isResultUndefined = $result === undefined || $result === null;

              /**
               * Check if Result is Required
               */
              if (isResultUndefined && required) {
                return rejectFn(new FireDataError({
                  $modelName,
                  error         : 'invalid-function-result',
                  functionName  : '$parse compileFunctions',
                  message       : `Value for '${path}' is required but got undefined`,
                  data          : { name: _original }
                }));
              }

              /**
               * Set Data
               */
              if (!isResultUndefined) {
                $parsed.$set(path, $result);
              }
      
              else if (!omitNull) {
                /**
                  * Save null value only if must not omit
                  */
                $parsed.$set(path, null);
              }

              return true;
            }

            /**
             * Resolve the Phase after all promises
             * have been resolved
             */
            return Promise.all($promises)
              .then(() => resolveFn({ $parsed, $filterField }))
              .catch(rejectFn);

          }))
          /**
           * Phase 4.
           * Evaluate Filters
           */
          .then(({ $parsed, $filterField = [] }) => new Promise((resolveFilters, rejectFilters) => {
            /**
             * Loop field that has to be filtered
             */
            $filterField.forEach(({ path, value }) => {
              /**
               * Loop all filters for the field
               */
              value.filters.forEach(($filter) => {
                /**
                 * Parse the filter
                 */
                const [filter, allParams] = $filter.split(':');
                const [...params] = typeof allParams === 'string'
                  ? allParams.replace(/,\s/g, ',').split(',')
                  : [];

                /**
                 * Get the Filter Function
                 */
                const $function = loadFilter(self, filter);

                /**
                 * Check function exists
                 */
                if (typeof $function !== 'function') {
                  return rejectFilters(new FireDataError({
                    $modelName,
                    error         : 'invalid-filter-name',
                    functionName  : '$parse compileFilter',
                    message       : `Value for '${path}' require filter '${filter}' but doens't exists`,
                    data          : { name: value._original }
                  }));
                }

                /**
                 * Build Args
                 */
                const $args = [$parsed.$get(path)];

                params.forEach($param => $args.push($param));

                /**
                 * Add Talker Instance
                 * to Arguments
                 */
                $args.push(self);

                /**
                 * Get filter result
                 */
                const $result = $function.apply(
                  $parsed instanceof FireDataObject
                    ? $parsed.$build()
                    : $parsed,
                  $args
                );

                /**
                 * Set the Result
                 */
                const isUndefined = $result === null || $result === undefined;

                /**
                 * Check if result is required
                 */
                if (isUndefined && value.required) {
                  return rejectFilters(new FireDataError({
                    $modelName,
                    error         : 'invalid-filter-result',
                    functionName  : '$parse compileFilters',
                    message       : `Value for '${path}' is required but got undefined`,
                    data          : { name: value._original }
                  }));
                }

                /**
                 * Set Data
                 */
                return $parsed.$set(path, isUndefined ? null : $result);

              });

            });

            /**
             * Resolve the Phase
             */
            return resolveFilters($parsed);

          }))

          /**
           * Phase 5.
           * Validate Data using validators array
           */
          .then($parsed => new Promise((resolveValidators, rejectValidators) => {

            /**
             * Validators must run only
             * if function is not in Getter mode
             * to avoid error on data rebuilding
             */
            if (isGetter) {
              return resolveValidators($parsed);
            }

            let $error;

            /**
             * Run each Validators, rejecting
             * the first one that will fails
             */
            $model.validators.forEach(($validator) => {
              if (!$error) {
                const $isValid = $validator.checker($data);
                if (!$isValid) {
                  $error = $validator.error;
                }
              }
            });

            /**
             * If an error was found, then reject
             * the validators promise
             */
            if ($error) {
              return rejectValidators(new FireDataError({
                $modelName,
                error         : $error,
                functionName  : '$parse validateModel',
                message       : 'Custom field error'
              }));
            }

            /**
             * If no error, could continue
             */
            return resolveValidators($parsed);

          }))

          /**
           * Phase 6.
           * Format data using formatters array
           */
          .then($parsed => new Promise((resolveFormatting) => {
            /**
             * Compile the Parsed Object
             */

            let $compiled = $parsed instanceof FireDataObject
              ? $parsed.$build()
              : $parsed;

            /**
             * Apply all formatters to the Models
             */
            $model.formatters.forEach(($formatter) => {
              $compiled = $formatter($compiled);
            });

            return resolveFormatting($compiled);

          }))

          /**
           * Resolve Parsed Data
           */
          .then(resolve)
          .catch(original => reject(new FireDataError({
            $modelName,
            error         : 'parsing-error',
            functionName  : '$parse',
            message       : `An Error occured while Parsing ${$modelName}`,
            data          : {
              parsingData  : $data,
              options      : { omitNull, rawData, isGetter, oldData } },
            original
          })));

      });
    };

  }


  /**
   * @function $extract
   * 
   * @param {String} $extractorName Name of the Extractor
   * @param {Object} $options
   * @param {Boolean} $options.omitNull Indicate if show null value
   * 
   */
  $extract($extractorName, { omitNull = true } = {}) {
    /**
     * Get the Model
     */
    const $model = loadModel(this, $extractorName);

    /**
     * Check Model is an Extractor
     */
    if (!$model._extractor) {
      return () => Promise.reject(new FireDataError({
        $extractorName,
        error         : 'invalid-extractor',
        functionName  : '$extract',
        message       : `Model '${$extractorName}' is not an Extractor and couldn't be used`
      }));
    }

    return function extractData($sourceData) {

      const $parsed = new FireDataObject();
      const $dataSource = new FireDataObject($sourceData);

      /**
       * Loop all Models Key
       */
      $model._keys.$each(({ path, value }) => {

        /**
         * Check if is Options or
         * required
         */
        const $required = /^!/.test(value);

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
          if ($required) {
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
            $parsed.$set(path, null);
          }

        }

        else {
          /**
           * Save the Property
           */
          $parsed.$set(path, $source);
        }

      });

      return $parsed.$build();

    };

  }


  /**
   * @function $get
   * 
   * @param {String} $modelName The Model to Use
   * 
   * @description
   * This function will return a function to call with ID (in ID-Based Model)
   * to get the data from Firebase
   * 
   */
  $get($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$get',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Check model is not a parser
     */
    if ($model._parser) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-getter',
        functionName  : '$get',
        message       : `Model '${$modelName}' is a Parser and cannot be used to get Data`
      }));
    }

    /**
     * If model is an extractor, then must load
     * the father model to get data from firebase
     */
    const $father = $model._extractor && loadModel(this, $model._extractor);

    return function getDataFromFirebase($id, { omitNull = true, rawData = false, newData } = {}) {
      return new Promise((resolveGetterFunction, rejectGetterFunction) => {
        /**
         * Get Data from Database
         */
        new Promise((resolveData, rejectData) => {
          /**
           * Load the Read Path
           */
          const $hasID = $father ? $father.paths.hasID : $model.paths.hasID;

          const $path = parseFirebaseReference(
            self, $father ? $father.paths.read : $model.paths.read,
            { $hasID, $id }
          );

          /**
           * If path has an ID, then check $id exists
           */
          if ($hasID && typeof $id !== 'string') {
            throw new FireDataError({
              $modelName,
              error         : 'invalid-id',
              functionName  : '$get',
              message       : `Read path for Model '${$modelName}' requires an ID`
            });
          }

          /**
           * Get the Firebase Client
           */
          const $firebase = _firebaseAdmin.get(self);

          /**
           * Load the reference
           */
          const $reference = $firebase.ref($path);

          /**
           * Load data from Database
           */
          $reference.once('value', ($snapshot) => {
            /**
             * If dataSnapshot doesn't exists
             * then return a null value
             */
            if (!$snapshot.exists()) {
              return resolveData(null);
            }

            /**
             * Else, must load a shallow copy of the data,
             * and must resolve the parsed model
             */
            return self.$parse($modelName)($snapshot.exportVal(), {
              omitNull, isGetter: true, rawData, newData
            })
              .then(resolveData)
              .catch(rejectData);

          },

          /**
           * On Firebase Error, must
           * reject the promise
           */
          original => rejectData(new FireDataError({
            $modelName,
            error         : 'database-load-error',
            functionName  : '$get',
            message       : `An error occured while downloading data from Database for '${$modelName}'`,
            original
          })));

        })
          .then(($data) => {
            /**
             * If rawData doesn't Exists and newData doesn't
             * exists, then the $get function is called by user.
             * In this case must search and execute functions
             */
            if (!rawData && !newData) {
              return executeHookFunctions({
                $model   : $father || $model,
                hook     : 'onGet',
                params   : [$data, $id],
                context  : self
              })
                /**
                 * Resolve Data
                 */
                .then(() => resolveGetterFunction($data))

                /**
                 * Catch error
                 */
                .catch(original => rejectGetterFunction(new FireDataError({
                  $modelName,
                  error         : 'get-hook-function-error',
                  functionName  : '$get onGetFunctions',
                  message       : `An error occured while executing Hooks functions for $get Method for '${$modelName}'`,
                  original
                })));
            }

            /**
             * Else, simply resolve the data
             */
            return resolveGetterFunction($data);

          })
          .catch(original => rejectGetterFunction(new FireDataError({
            $modelName,
            error         : 'get-data-error',
            functionName  : '$get',
            message       : `An error occured while getting data for '${$modelName}'`,
            original
          })));

      });

    };

  }


  $add($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$add',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Update function could not be used
     * with an extractor model or a parser
     */
    if ($model._extractor) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$add',
        message       : `Model '${$modelName}' is an Extractor and couldn't be used. Use '${$model._extractor}' to add data`
      }));
    }

    if ($model._parser) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$add',
        message       : `Model '${$modelName}' is a Parser and cannot be used to add new Data`
      }));
    }

    /**
     * If Model Path hasn't got an ID then
     * throw an error to encourage using $set function
     */
    if (!$model.paths.hasID) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-function',
        functionName  : '$add',
        message       : `Model '${$modelName}' is a non-ID based model. Use $set function to set data on Database instead of the $add function`
      }));
    }

    /**
     * Stop process if Path has the $id placeholder
     * to avoid object nesting
     * TODO: Get the possibility to set using $set function
     */
    if (CONST.ID_REGEX.test($model.paths.read)) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-path',
        functionName  : '$add',
        message       : `Model ${$modelName} is a ID-Based but it's read/write path is a child of the ID and cannot be used to $add data.`
      }));
    }


    /**
     * Return the Add Function
     */
    return function addFirebaseData($data, { id } = {}) {
      /**
       * Parse data to Add
       */
      return new Promise((resolveAdderFunction, rejectAdderFunction) => {
        /**
         * Parsed data will be pushed in the main
         * path first, to retreive an ID
         */
        const $mainPath = parseFirebaseReference(self, $model.paths.read);

        /**
         * Get Admin Instance
         */
        const $firebase = _firebaseAdmin.get(self);

        /**
         * Get a new Firebase ID
         */
        const $id = id || $firebase.ref($mainPath).push().key;
        const $updater = {};

        /**
         * Parse Data
         */
        self.$parse($modelName)($data)
          .then(($parsedData) => {

            const $addData = {
              [$modelName]: $parsedData
            };

            const $pathUpdated = [];

            /**
             * Parse path and filter removing all path
             * that contain query parameters
             */
            clonePathsArray($model.paths.writes)
              /**
               * Remove queried path
               */
              .filter($path => !$path.queryOn)
              /**
               * Parse firebase ref and append ID
               */
              .map(($path) => {
                $path.ref = `${parseFirebaseReference(self, $path.ref)}/${$id}`;
                $path.model = $path.model || $modelName;
                return $path;
              })
              /**
               * For Each Path build Data if doesn't exists
               * and set updater
               */
              .forEach(($path) => {
                if ($pathUpdated.indexOf($path.ref) === -1) {
                  /**
                   * Build data if doens't exists
                   */
                  if (typeof $addData[$path.model] === 'undefined') {
                    $addData[$path.model] = self.$extract($path.model)($parsedData);
                  }
  
                  /**
                   * Append to Updater
                   */
                  $updater[$path.ref] = $addData[$path.model];

                  /**
                   * Set Path as Updated
                   */
                  $pathUpdated.push($path.ref);
                }
              });

            /**
             * Before sending the Updater must
             * execute hook functions if exists
             */
            return executeHookFunctions({
              $model,
              hook     : 'onAdd',
              params   : [$parsedData, $id],
              context  : self
            });

          })

          .then(() => $firebase.ref().update($updater))

          /**
           * Before resolve the $add function must check if there are
           * some hook function to execute after adding
           */
          .then(() => executeHookFunctions({
            $model,
            hook     : 'afterAdd',
            params   : [$updater[Object.keys($updater)[0]], $id],
            context  : self
          }))

          /**
           * Resolve add Function
           */
          .then(() => resolveAdderFunction($id))

          /**
           * Catch function error
           */
          .catch(original => rejectAdderFunction(new FireDataError({
            $modelName,
            error         : 'database-add-error',
            functionName  : '$add',
            message       : `An error occurred while adding data to Database for '${$modelName}'`,
            data          : $data,
            original
          })));

      });
    };

  }


  $set($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$set',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Update function could not be used
     * with an extractor model
     */
    if ($model._extractor) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$set',
        message       : `Model '${$modelName}' is an Extractor and couldn't be used. Use '${$model._extractor}' to set data`
      }));
    }

    if ($model._parser) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$set',
        message       : `Model '${$modelName}' is a Parser and cannot be used to set Data`
      }));
    }

    /**
     * If Model Path hasn't got an ID then
     * throw an error to encourage using $set function
     */
    if ($model.paths.hasID) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-function',
        functionName  : '$set',
        message       : `Model '${$modelName}' is a ID based model. Use $add function to push data on Database instead of the $set function`
      }));
    }

    /**
     * Return the Set Function
     */
    return function setFirebaseData($data) {

      const $firebase = _firebaseAdmin.get(self);
      const $updater = {};

      /**
       * Parse data to Set
       */
      return new Promise((resolveSetterFunction, rejectSetterFunction) => {
        self.$parse($modelName)($data)
          .then(($parsedData) => {

            const $setData = {
              [$modelName]: $parsedData
            };

            const $pathUpdated = [];

            /**
             * Parse path and filter removing all path
             * that contain query parameters
             */
            clonePathsArray($model.paths.writes)
              /**
               * Remove queried path
               */
              .filter($path => !$path.queryOn)
              /**
               * Parse firebase ref and append ID
               */
              .map(($path) => {
                $path.ref = parseFirebaseReference(self, $path.ref);
                $path.model = $path.model || $modelName;
                return $path;
              })
              /**
               * For Each Path build Data if doesn't exists
               * and set updater
               */
              .forEach(($path) => {
                if ($pathUpdated.indexOf($path.ref) === -1) {
                  /**
                   * Build data if doens't exists
                   */
                  if (!$setData[$path.model]) {
                    $setData[$path.model] = self.$extract($path.model)($parsedData);
                  }
  
                  /**
                   * Append to Updater
                   */
                  $updater[$path.ref] = $setData[$path.model];

                  /**
                   * Set Path as Updated
                   */
                  $pathUpdated.push($path.ref);
                }
              });

            /**
             * Before sending the Updater must
             * execute hook functions if exists
             */
            return executeHookFunctions({
              $model,
              hook     : 'onSet',
              params   : [$parsedData],
              context  : self
            });

          })

          .then(() => $firebase.ref().update($updater))

          /**
           * Before resolve the $set function
           * must look and execute hook function
           */
          .then(() => executeHookFunctions({
            $model,
            hook     : 'afterSet',
            params   : [$updater[Object.keys($updater)[0]]],
            context  : self
          }))

          .then(() => resolveSetterFunction(null))

          .catch(original => rejectSetterFunction(new FireDataError({
            $modelName,
            error         : 'set-data-error',
            functionName  : '$set',
            message       : `An error occured while setting data to Database for ${$modelName}`,
            data          : $data,
            original
          })));

      });
    };

  }


  $update($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$update',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Update function could not be used
     * with an extractor model or a parser
     */
    if ($model._extractor) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$update',
        message       : `Model '${$modelName}' is an Extractor and couldn't be used. Use '${$model._extractor}' to update data`
      }));
    }

    if ($model._parser) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$update',
        message       : `Model '${$modelName}' is a Parser and cannot be used to update Data`
      }));
    }

    /**
     * Return the Update Function
     */
    return function updateFirebaseData($id, $data, $oldLoadedData) {

      /**
       * Return a Promise wrapping
       * the Updater Flow
       */
      return new Promise((resolveUpdaterFunction, rejectUpdaterFunction) => {

        /**
         * Check ID Fields
         */
        const $hasID = $model.paths.hasID;
        let $isSingle;
        let $allUpdatingData = {};

        /**
         * Check function params, if path
         * isn't ID Based, switch the
         * function arguments
         */
        if (!$hasID) {
          $oldLoadedData = $data;
          $data = $id;
          $allUpdatingData = $id;
          $id = undefined;
        }

        /**
         * Check ID exists and data exists
         */
        if ($hasID) {
          /**
           * If $id is a string, associate data
           */
          if (typeof $id === 'string') {
            $allUpdatingData = { [$id]: $data };
            $isSingle = true;
          }

          /**
           * Else change the updating data
           */
          else if (typeof $id === 'object' && $id !== null && !Array.isArray($id)) {
            $allUpdatingData = $id;
            $isSingle = false;
          }

          /**
           * Else, throw error
           */
          else {
            throw new FireDataError({
              $modelName,
              error         : 'invalid-id',
              functionName  : '$update',
              message       : `Write path for Model '${$modelName}' requires an ID`
            });
          }
        }

        /**
         * Init Variables
         */
        const $firebase = _firebaseAdmin.get(self);
        const $updater = new FireDataObject();

        /**
         * Phase 1.
         * Get oldLoadedData if is not proposed
         */
        new Promise((resolveLoadOldData, rejectLoadOldData) => {
          /**
           * Build Old Data Object
           */
          const $oldData = {};

          /**
           * Check if is Single
           */
          if ($isSingle && $oldLoadedData) {
            /**
             * Parse old Data
             */
            return self.$parse($modelName)($oldLoadedData, { isGetter: true, newData: $data })
              .then(($parsed) => {
                /**
                 * Save data
                 */
                $oldData[Object.getOwnPropertyNames($allUpdatingData)[0]] = $parsed;

                /**
                 * Resolve the loader
                 */
                return resolveLoadOldData($oldData);
              })
              .catch(original => rejectLoadOldData(new FireDataError({
                $modelName,
                original,
                error         : 'load-old-data-error',
                functionName  : '$update $parse',
                message       : `An error occured while parsing old data with Model '${$modelName}'`
              })));
          }

          /**
           * Else, skip old data, and get all new
           * data from database
           */
          const $loadOldDataPromises = [];

          /**
           * Loop through all ID
           */
          Object.getOwnPropertyNames($allUpdatingData).forEach(($updatingDataId) => {
            $loadOldDataPromises.push(
              new Promise((resolveDataIDLoading, rejectDataIDLoading) => {
                self.$get($modelName)($updatingDataId,
                  { rawData: true, newData: $allUpdatingData[$updatingDataId] })
                  .then(($parsed) => {
                    /**
                     * Save new Data
                     */
                    $oldData[$updatingDataId] = $parsed;

                    /**
                     * Resolve the Loader
                     */
                    return resolveDataIDLoading();
                  })
                  .catch(original => rejectDataIDLoading(original));
              })
            );
          });

          /**
           * Wait the Resolution of all promises
           */
          return Promise.all($loadOldDataPromises)
            .then(() => resolveLoadOldData($oldData))
            .catch(original => rejectLoadOldData(new FireDataError({
              $modelName,
              original,
              error         : 'get-old-data-error',
              functionName  : '$update $get',
              message       : `An error occured while getting old data with Model '${$modelName}'`
            })));

        })

          .then(($allOldData) => {
            /**
             * Build FireDataObject
             * for allUpdating and allOld data
             */
            const $allOldDataSource = new FireDataObject($allOldData);
            const $allUpdatingDataSource = new FireDataObject($allUpdatingData);

            /**
             * Build a Promises Array to Update all Data
             */
            const $buildUpdaterPromise = [];
            const $updatingIDs = [];

            /**
             * Init parsed data
             */
            const $parsedData = {};

            /**
             * Loop each updating data
             */
            $allUpdatingDataSource.$eachRoot(($updatingID, $dataSource) => {

              $updatingIDs.push($updatingID);

              /**
               * Build the Promise
               */
              $buildUpdaterPromise.push(
                new Promise((resolveBuildUpdater, rejectBuildUpdater) => {
                  /**
                   * Get the Old Data Source
                   */
                  const $oldData = $allOldDataSource.$get($updatingID);
                  const $oldDataSource = new FireDataObject($oldData);
    
                  /**
                   * Check Data Exists
                   */
                  if ($oldDataSource.$isEmpty()) {
                    return rejectBuildUpdater(new FireDataError({
                      $modelName,
                      error         : 'data-not-found',
                      functionName  : '$update $buildUpdater',
                      message       : `Data to update model '${$modelName}' for ID '${$updatingID}' was not found on Database`
                    }));
                  }

                  /**
                   * Build the new Object
                   */
                  const $updatedObject = $oldDataSource.$clone().$merge($dataSource);

                  /**
                   * Parse the new Data
                   */
                  return self.$parse($modelName)(
                    $updatedObject.$build(), { omitNull: false, oldData: $oldData }
                  )
                    .then(($parsed) => {
                      /**
                       * Build the Parsed Source
                       */
                      const $parsedSource = new FireDataObject($parsed);

                      /**
                       * Save the Parsed Data
                       */
                      $parsedData[$updatingID] = $parsedSource.$build();

                      /**
                       * Build the Model
                       */
                      const $oldDataModels = {
                        [$modelName]: $oldDataSource
                      };

                      const $newDataModels = {
                        [$modelName]: $parsedSource
                      };

                      const $diffModels = {
                        [$modelName]: $oldDataSource.$diff($parsedSource)
                      };

                      /**
                       * For Each path, build the diff model
                       * if doesn't exists
                       */
                      $model.paths.writes.forEach(($path) => {
                        /**
                         * Get the correct path model to use
                         */
                        const $pathModel = $path.model || $modelName;

                        /**
                         * If Model is not loaded, then build
                         * the diff object
                         */
                        if (!$oldDataModels[$pathModel] || !$newDataModels[$pathModel]) {
                          $oldDataModels[$pathModel] = new FireDataObject(self.$extract($pathModel)(
                            $oldDataSource.$build(),
                            { omitNull: false }
                          ));
                          $newDataModels[$pathModel] = new FireDataObject(self.$extract($pathModel)(
                            $parsedSource.$build(),
                            { omitNull: false }
                          ));
                        }

                        /**
                         * Generate Diff Key
                         */
                        if (!$diffModels[$pathModel]) {
                          $diffModels[$pathModel] = $oldDataModels[$pathModel].$diff(
                            $newDataModels[$pathModel]
                          );
                        }
                      });

                      /**
                       * Once all Diff Models are builded
                       * create the $updater object to update
                       * firebase database
                       */
                      const $updatedPath = [];
                      const $updatePromises = [];

                      /**
                       * Update all Paths
                       */
                      clonePathsArray($model.paths.writes)
                        .map(($path) => {
                          /**
                           * Update path reference to set the ID
                           * only if is not queried
                           */
                          $path.ref = parseFirebaseReference(
                            self, $path.ref, { $hasID: !$path.queryOn, $id: $updatingID }
                          );
              
                          return $path;
                        })
                        .forEach(($path) => {
                          /**
                           * Skip updated path
                           */
                          if ($updatedPath.indexOf($path.ref) === -1) {
                            /**
                             * Set the Path Model
                             */
                            const $pathModel = $path.model || $modelName;

                            /**
                             * Set Path as updated
                             */
                            $updatedPath.push($path.ref);

                            /**
                             * If ref must not be ordered, then save
                             * the updater key
                             */
                            if (typeof $path.queryOn !== 'string' || typeof $path.writeChild !== 'string' || !$hasID) {
                              /**
                               * Generate the updater key
                               */
                              $diffModels[$pathModel].$each(({ path, value }) => {
                                $updater.$set(`${$path.ref}/${path}`, value);
                              });
                            }

                            /**
                            * Else, must build a Query
                            */
                            else {
                              $updatePromises.push(
                                new Promise((resolveQuery, rejectQuery) => {
                                  $firebase.ref($path.ref)
                                    .orderByChild($path.queryOn).equalTo($updatingID).once('value', ($snapshots) => {
                                      /**
                                      * For each snapshot found, build the update key
                                      */
                                      $snapshots.forEach(($snap) => {
                                        /**
                                        * Check if must filter snapshot
                                        */
                                        if (typeof $path.snapFilter === 'function') {
                                          if (!$path.snapFilter($snap)) return;
                                        }

                                        /**
                                        * Create Updater Path for Snapshot
                                        */
                                        $diffModels[$pathModel].$each(({ path, value }) => {
                                          $updater.$set(`${$path.ref}/${$snap.key}/${$path.writeChild}/${path}`, value);
                                        });
                                      });

                                      /**
                                      * Resolve query Updater
                                      */
                                      return resolveQuery();

                                    },
                                    
                                    original => rejectQuery(new FireDataError({
                                      $modelName,
                                      original,
                                      error         : 'database-query-error',
                                      functionName  : '$parse evalQuery',
                                      message       : `Error on loading data for path '${$path.ref}' ordered by '${$path.queryOn}'`,
                                      data          : { path: $path }
                                    })));
                                })
                              );
                            }
                          }
                        });

                      /**
                       * Wait for the resolution of
                       * all updater promises before continue
                       */
                      return Promise.all($updatePromises)
                        .then(() => resolveBuildUpdater())
                        .catch(original => rejectBuildUpdater(original));

                    });

                })
              );

            }, self);

            /**
             * Wait the Resolution of all
             * updater promises
             */
            return Promise.all($buildUpdaterPromise)
              .then(() => {
                /**
                 * Build Hook Params
                 */
                const $hookParams = [];

                /**
                 * If was single update, return
                 * only the first data $id
                 */
                if ($isSingle) {
                  $hookParams.push(
                    $parsedData[$updatingIDs[0]],
                    $allOldDataSource.$get($updatingIDs[0]),
                    $updatingIDs[0]
                  );
                }

                else {
                  $hookParams.push(
                    $parsedData,
                    $allOldDataSource.$build(),
                    $updatingIDs
                  );
                }

                /**
                 * Return the Hooks Params
                 */
                return Promise.resolve($hookParams);

              })
              .catch(original => Promise.reject(original));

          })
    
          /**
           * Before sending the Updater must
           * execute hook functions if exists
           */
          .then($hookParams => executeHookFunctions({
            $model,
            hook     : 'onUpdate',
            params   : $hookParams,
            context  : self
          }))

          /**
           * Send the Updater to Firebase
           */
          .then($hookParams => $firebase.ref().update($updater.$keyMap())
            .then(() => Promise.resolve($hookParams))
            .catch(original => Promise.reject(original)))

          /**
           * Execute hook functions after update
           */
          .then($hookParams => executeHookFunctions({
            $model,
            hook     : 'afterUpdate',
            params   : $hookParams,
            context  : self
          }))

          /**
           * Resolve Updater Functions
           */
          .then(() => resolveUpdaterFunction($updater.$build()))

          /**
           * Catch Process Errors
           */
          .catch(original => rejectUpdaterFunction(new FireDataError({
            $modelName,
            original,
            error         : 'update-data-error',
            functionName  : '$update',
            message       : `An error occured while updating data for ${$modelName}`,
            data          : { updater: $updater.$keyMap() }
          })));

      });
    };

  }


  $delete($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$delete',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Update function could not be used
     * with an extractor model or a parser
     */
    if ($model._extractor) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$delete',
        message       : `Model '${$modelName}' is an Extractor and couldn't be used. Use '${$model._extractor}' to delete data`
      }));
    }

    if ($model._parser) {
      return () => Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$delete',
        message       : `Model '${$modelName}' is a Parser and cannot be used to delete Data`
      }));
    }

    /**
     * Return the DeleteFunction
     */
    return function deleteFirebaseData($id) {
      return new Promise((resolveDeleterFunction, rejectDeleterFunction) => {
        /**
         * Check ID Fields
         */
        const $hasID = $model.paths.hasID;

        const $ids = [];

        /**
         * If ID is a String then convert
         * into an Array
         */
        if (typeof $id === 'string') {
          $ids.push($id);
        }

        /**
         * Else if is an Array, place all ID
         * into the $ids array
         */
        else if (Array.isArray($id)) {
          $id.forEach($single => $ids.push($single));
        }

        /**
         * Check ID exists
         */
        if ($hasID && !Array.isArray($ids)) {
          throw new FireDataError({
            $modelName,
            error         : 'invalid-id',
            functionName  : '$delete',
            message       : `Write path for Model '${$modelName}' requires one or more IDs`
          });
        }

        /**
         * Load the Writes Path
         */
        const $paths = clonePathsArray($model.paths.writes).map(($path) => {
          $path.ref = parseFirebaseReference(self, $path.ref);
          return $path;
        });

        /**
         * Init an Updater Object
         */
        const $updater = {};

        /**
         * Init a variable
         * to save raw deleting data
         */
        let $deletingData = {};

        /**
         * Get Firebase instance
         */
        const $firebase = _firebaseAdmin.get(self);

        /**
         * Build an updating Promises
         * to resolve the queried data
         */
        const $updatePromises = [
          /**
           * The first promise to resolve is
           * to get raw deleting data to pass to hook functions
           */
          new Promise((resolveGetRawData, rejectGetRawData) => {
            /**
             * Get Read Path
             */
            const $path = parseFirebaseReference(
              self, $model.paths.read,
              { $hasID, $id }
            );
            $firebase.ref($path).once('value', ($snap) => {
              /**
               * Save old data
               */
              $deletingData = $snap.exists() ? $snap.exportVal() : {};
              return resolveGetRawData();

            }, e => rejectGetRawData(new FireDataError({
              $modelName,
              error         : 'raw-data-error',
              functionName  : '$delete getRawData',
              message       : `Error retreiving old raw data for Model '${$modelName}'`,
              original      : e
            })));
          })
        ];

        /**
         * Save updated Path
         */
        const $updatedPath = [];

        /**
         * Loop path to update data
         */
        $paths.forEach(($path) => {
          /**
           * Update Path, only if isn't updated yet
           */
          if ($updatedPath.indexOf($path.ref) === -1) {
            /**
             * Add Path to Updated
             */
            $updatedPath.push($path.ref);

            /**
             * If ref must not be ordered, then save
             * the updater key
             */
            if (typeof $path.queryOn !== 'string' || typeof $path.writeChild !== 'string' || !$hasID) {
              /**
               * Generate the updater key
               */
              $ids.forEach(($singleID) => {
                $updater[`${$path.ref}/${$singleID}`] = null;
              });

            }

            /**
             * Else, must build a query
             */
            else {
              $ids.forEach(($singleID) => {
                $updatePromises.push(
                  new Promise((resolveQuery, rejectQuery) => {
                    /**
                     * Get paths
                     */
                    const $updatePaths = [$path.ref];
  
                    /**
                     * Get reference model path, if exists
                     */
                    if (typeof $path.referenceModel === 'string') {
                      /**
                       * Load reference Model
                       */
                      const $referenceModel = loadModel(self, $path.referenceModel);
  
                      if ($referenceModel) {
                        $referenceModel.paths.writes.slice()
                          .filter(rPath => !rPath.queryOn && $updatedPath.indexOf(rPath.ref) === -1)
                          .forEach((rPath) => {
                            $updatePaths.push(parseFirebaseReference(self, rPath.ref));
                          });
                      }
                    }
  
                    $firebase.ref($path.ref).orderByChild($path.queryOn).equalTo($singleID).once('value', ($snapshots) => {
                      /**
                       * For Each Snapshots found, build the update key
                       */
                      $snapshots.forEach(($snap) => {
                        /**
                         * Check if must filter snapshot
                         */
                        if (typeof $path.snapFilter === 'function') {
                          if (!$path.snapFilter($snap)) return;
                        }
  
                        /**
                         * Create Updater Path for this Snapshot
                         */
                        $updatePaths.forEach(($updatePath) => {
                          $updater[`${$updatePath}/${$snap.key}/${$path.writeChild}`] = null;
                          $updater[`${$updatePath}/${$snap.key}/${$path.queryOn}`] = null;
                        });
                      });
  
                      /**
                       * Resolve query updater
                       */
                      return resolveQuery();
  
                    },
  
                    original => rejectQuery(new FireDataError({
                      $modelName,
                      original,
                      error         : 'database-query-error',
                      functionName  : '$parse evalQuery',
                      message       : `Error on loading data for path '${$path._original}' ordered by '${$path.queryOn}' for ID: ${$singleID}`,
                      data          : { path: $path }
                    })));
                  })
                );
              });
            }
          }
        });

        /**
         * Once updater has been created
         * and all Promises are resolved
         * send the Updater to Firebase
         */

        Promise.all($updatePromises)

          /**
           * Execute hook function for delete method
           */
          .then(() => executeHookFunctions({
            $model,
            hook     : 'onDelete',
            params   : [$deletingData, $id],
            context  : self
          }))

          /**
           * Send the Updater
           */
          .then(() => $firebase.ref().update($updater))

          /**
           * Before resolve $delete must execute hook function
           */
          .then(() => executeHookFunctions({
            $model,
            hook     : 'afterDelete',
            params   : [$deletingData, $id],
            context  : self
          }))

          /**
           * Resolve the $delete function
           */
          .then(() => resolveDeleterFunction())

          /**
           * Catch error
           */
          .catch(original => rejectDeleterFunction(new FireDataError({
            $modelName,
            original,
            error         : 'delete-data-error',
            functionName  : '$delete',
            message       : `An error occured while deleting data for ${$modelName}`,
            data          : { $id }
          })));

      });

    };

  }


  $drop($modelName) {

    const self = this;

    /**
     * Get Model
     */
    const $model = loadModel(this, $modelName);

    /**
     * Check Model Exists
     */
    if (!$model) {
      return Promise.reject(new FireDataError({
        $modelName,
        error         : 'dont-exists',
        functionName  : '$drop',
        message       : `Model '${$modelName}' doesn't exists`
      }));
    }

    /**
     * Update function could not be used
     * with an extractor model or a parser
     */
    if ($model._extractor) {
      return Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$drop',
        message       : `Model '${$modelName}' is an Extractor and couldn't be used. Use '${$model._extractor}' to drop data`
      }));
    }

    if ($model._parser) {
      return Promise.reject(new FireDataError({
        $modelName,
        error         : 'invalid-model',
        functionName  : '$drop',
        message       : `Model '${$modelName}' is a Parser and cannot be used to drop Data`
      }));
    }

    return new Promise((resolveDropFunction, rejectDropFunction) => {

      const $updater = new FireDataObject();

      /**
       * Node will be dropped only if
       * is not queried. This is necessary
       * to avoid infinite query
       */
      clonePathsArray($model.paths.writes)
        .filter(({ queryOn }) => !queryOn)
        .forEach(({ ref }) => {
          $updater.$set(parseFirebaseReference(self, ref), null);
        });

      /**
       * If updater is not empty, send to firebase
       */
      if ($updater.$isEmpty()) {
        return resolveDropFunction();
      }

      const $firebase = _firebaseAdmin.get(self);

      return $firebase.ref().update($updater.$keyMap())
        .then(() => resolveDropFunction())
        .catch(original => rejectDropFunction(new FireDataError({
          $modelName,
          original,
          error         : 'drop-data-error',
          functionName  : '$drop',
          message       : 'An error occured while dropping Database node'
        })));

    });

  }

}


/**
 * @function loadModel
 * 
 * @param {Object} $this The Firebase Talker Instance
 * @param {String} $name Model Nmae to Load
 * 
 */
function loadModel($this, $name) {
  return _models.get(_dataModeler.get($this))[$name];
}


function loadFunction($this, $name) {
  return _functions.get(_dataModeler.get($this))[$name];
}


function loadFilter($this, $name) {
  return _filters.get(_dataModeler.get($this))[$name];
}


function clonePathsArray($paths = []) {
  return new FireDataObject($paths).$clone().$build();
}


/**
 * @function buildSourceString
 * 
 * @param {String|Array|Object} $source Normalize Source
 * 
 * @return {String}
 */
function buildSourceString($source) {
  if (typeof $source === 'string') {
    return $source.split(' ').sort().join(' ');
  }

  if (typeof $source === 'object' && $source !== null && !Array.isArray($source)) {
    return Object.getOwnPropertyNames($source).filter($key => $source[$key]).sort().join(' ');
  }

  if (Array.isArray($source) && $source.length) {
    return $source.sort().join(' ');
  }

  return '';

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
function parseFirebaseReference($this, $path, { $hasID = false, $id } = {}) {
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


function executeHookFunctions({ $model, hook, params = [], context }) {
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


module.exports = FirebaseTalker;
