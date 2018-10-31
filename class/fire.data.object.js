class FireDataObject {

  constructor($starting) {
    this._keys = [..._mapObjectKeys($starting)];
  }

  /**
   * @function $set
   * 
   * @param {String} path Key Path
   * @param {*} value Key Value
   * 
   * @description
   * Add a new Key Path and value to the _keys array
   * If path allready exists, replace the existance value
   * 
   */
  $set(path, value) {

    /**
     * Purge Path
     */
    path = _purgePathString(path);

    /**
     * Check path is a String
     */
    if (typeof path !== 'string') {
      throw new Error('[ FireDataObject ] $set - Invalid path params, must be a String.');
    }

    /**
     * Check value is not undefined
     */
    if (value === undefined) {
      value = null;
    }

    /**
     * Build path array
     */
    const _path = path.split('/');

    /**
     * Purge conflict path
     */
    this._purgePaths(path);

    /**
     * Push the new key
     */
    this._keys.push({ path, value, _path });

    return this;

  }


  $concat(concatPath, $object) {

    /**
     * Purge Path
     */
    concatPath = _purgePathString(concatPath);

    const $concatening = $object instanceof FireDataObject
      ? $object = $object.$clone().$build()
      : $object;

    /**
     * Check path is a String
     */
    if (typeof concatPath !== 'string') {
      throw new Error('[ FireDataObject ] $concat - Invalid path params, must be a String.');
    }

    _mapObjectKeys($concatening, { $base: concatPath ? `${concatPath}/` : '' }).forEach(({ path, value }) => {
      this.$set(path, value);
    });

    return this;

  }


  $merge($object) {
    return this.$concat('', $object);
  }


  $isEmpty() {
    return !Object.keys(this._keys).length;
  }


  /**
   * @function $get
   * 
   * @param {String} keyPath Path to Return
   * 
   * @description
   * Get Value at Path
   * 
   */
  $get(keyPath, { plain = false } = {}) {

    keyPath = _purgePathString(keyPath);

    /**
     * Check path is a String
     */
    if (typeof keyPath !== 'string') {
      throw new Error('[ FireDataObject ] $get - Invalid path params, must be a String.');
    }

    /**
     * Filter keys that match the path pattern
     */
    const $regexp = new RegExp(`^${escapeRegExp(keyPath)}(?:/.*)*$`);

    /**
     * Filter Paths that match the regexp
     */
    const $keys = this._keys.filter(({ path }) => $regexp.test(path));
    const _keys = [];

    /**
     * Found key using regexp
     */
    $keys.forEach(({ path, value }) => {
      const _path = _purgePathString(path.replace(new RegExp(escapeRegExp(keyPath), 'g'), ''));
      _keys.push({
        path: _path,
        value,
        _path: _path.split('/')
      });
    });

    /**
     * Return a builded rapresentation of the object
     */
    if (_keys.length === 1 && !_keys[0].path) {
      return _keys[0].value !== undefined ? _keys[0].value : null;
    }

    /**
     * If no key, return null
     */
    if (!_keys.length) {
      return null;
    }

    /**
     * Return a 
     */
    return !plain ? this.$build({ _keys }) : this.$keyMap({ _keys });

  }


  /**
   * @function $remove
   * 
   * @param {String} path Key Path
   * 
   * @description
   * If exists, remove a Key Path from the _keys array
   * 
   */
  $remove(path) {

    path = _purgePathString(path);

    /**
     * Check path is a String
     */
    if (typeof path !== 'string') {
      throw new Error('[ FireDataObject ] $get - Invalid path params, must be a String.');
    }

    /**
     * Remove Path
     */
    this._purgePaths(path);

    return this;
  }


  /**
   * @function $add
   * 
   * @param {Object} $object Object to Map and Add
   * @param {Object} $options
   * @param {Boolean} $options.skipNested If must skip nesting object map
   * 
   */
  $add($object, { skipNested = false } = {}) {
    /**
     * Check $object params
     */
    if (typeof $object !== 'object' || $object === null || Array.isArray($object)) {
      throw new Error('[ FireDataObject ] $add - Invalid object params, must be an Object.');
    }

    this._keys.push(..._mapObjectKeys($object, { skipNested }));

    return this;
  }


  /**
   * @function $build
   * 
   * @description
   * Build an Object (or an Array) using the
   * actual defined key in the _keys array
   * 
   */
  $build({ avoidError = true, _keys = this._keys } = {}) {
    /**
     * If keys is empty, build and return
     * an empty Object
     */
    if (!_keys.length) {
      return {};
    }

    /**
     * Reduce all key to find if there is
     * no consistency of the starting object type.
     * If the first key start with a number, then
     * the starting object must be an array
     */
    const $isArray = /^\d+$|^\d+\//.test(_keys[0].path);

    /**
     * If avoidError is true, skip the check
     */
    if (!avoidError) {
      let $error = false;
  
      /**
       * Check all Keys have the same type origin
       */
      _keys.forEach(({ path }) => {

        path = _purgePathString(path);

        if ($error) return;

        if ($isArray && !/^\d+$|^\d+\//.test(path)) {
          $error = path;
        }
  
        else if (!$isArray && /^\d+$|^\d+\//.test(path)) {
          $error = path;
        }

      });

      if ($error) {
        throw new Error(`[ FireDataObject ] Found key incosistency for starting object : ${$error}`);
      }
    }

    /**
     * Create starting object
     */
    const $object = $isArray ? [] : {};

    /**
     * Loop all Keys
     */
    _keys.forEach(({ _path, value }) => {
      /**
       * Loop path to build the object
       */
      _path.reduce(($prev, $curr, $index, $array) => {
        /**
         * If this is last loop
         * set the value
         */
        if ($index === $array.length - 1) {
          $prev[$curr] = value;
          return true;
        }

        /**
         * Check if next is a digit.
         * In this case, nest object must be an array
         */
        const $nextIsDigit = typeof $array[$index + 1] === 'string' && /^\d+$/.test($array[$index + 1]);

        /**
         * Create nested object
         */
        if ($nextIsDigit && !Array.isArray($prev[$curr])) {
          $prev[$curr] = [];
        }

        else if (typeof $prev[$curr] !== 'object' || $prev[$curr] === null) {
          $prev[$curr] = {};
        }

        /**
         * Return the nested object
         */
        return $prev[$curr];

      }, $object);

    });


    /**
     * Return the builded object
     */
    return ($isArray && $object.length) || (!$isArray && Object.keys($object).length)
      ? $object
      : null;

  }


  /**
   * @function $diff
   * 
   * @param {FireDataObject} $object 
   */
  $diff($object, { doubleSide = true } = {}) {

    if (!($object instanceof FireDataObject)) {
      $object = new FireDataObject($object);
    }

    const $diffKey = [];
    const $addedKey = [];

    if (doubleSide) {
      this._keys
        .forEach(({ path, value, _path }) => {

          if ($addedKey.indexOf(path) !== -1) return;

          /**
           * Get A Value
           */
          const $AValue = $object.$get(path);
  
          /**
           * If two value are different, then
           * save the new value
           */
          if ($AValue !== value) {
            $diffKey.push({ path, value: $AValue, _path: _path.slice() });
            $addedKey.push(path);
          }
        });
    }

    $object._keys
      .forEach(({ path, value, _path }) => {
        /**
         * Skip added Key
         */
        if ($addedKey.indexOf(path) !== -1) return;

        /**
         * Get B Value
         */
        const $BValue = this.$get(path);

        /**
         * If the two value are different, then
         * must save the new value
         */
        if ($BValue !== value) {
          $diffKey.push({ path, value, _path: _path.slice() });
          $addedKey.push(path);
        }
      });

    /**
     * Build a new Instance
     */
    const $return = new FireDataObject();
    $return._keys = $diffKey;

    return $return;

  }


  /**
   * @function $keyMap
   * 
   * @description
   * Return a plain rapresentation of object keys
   * 
   */
  $keyMap({ _keys = this._keys } = {}) {
    return _keys.reduce(($prev, { path, value }) => {
      $prev[path] = value;
      return $prev;
    }, {});
  }


  /**
   * @function $each
   * 
   * @param {Function} $callback Callback Function
   * @param {*} $context Callback Function context
   * 
   */
  $each($callback, $context = this._keys) {
    /**
     * Check Callback
     */
    if (typeof $callback !== 'function') {
      throw new Error('[ FireDataObject ] $map - Callback function is not a valid function.');
    }

    this._keys.forEach($callback.bind($context));

    return this;

  }


  /**
   * @function $each
   * 
   * @param {Function} $callback Callback Function
   * @param {*} $context Callback Function context
   * 
   */
  $eachRoot($callback, $context = this._keys) {
    /**
     * Check Callback
     */
    if (typeof $callback !== 'function') {
      throw new Error('[ FireDataObject ] $map - Callback function is not a valid function.');
    }

    const $rootKeys = [];

    this._keys.forEach(({ _path }) => {
      if ($rootKeys.indexOf(_path[0]) === -1) {
        $rootKeys.push(_path[0]);
      }
    });

    $rootKeys
      .forEach($callback.bind($context));

    return this;

  }


  /**
   * @function $map
   * 
   * @param {Function} $callback Callback Function
   * @param {*} $context Callback function context
   * 
   */
  $map($callback, $context = this._keys) {
    /**
     * Check Callback
     */
    if (typeof $callback !== 'function') {
      throw new Error('[ FireDataObject ] $map - Callback function is not a valid function.');
    }

    this._keys = this._keys.map(($key, $index, $array) => {

      const $result = $callback.bind($context)(
        { path: $key.path, value: $key.value }, $index, $array
      );

      if (typeof $result !== 'object' || $result === null || Array.isArray($result)) {
        throw new Error('[ FireDataObject ] $map - Function must return an object with \'map\' and \'value\' key');
      }

      let { path, value } = $result;

      /**
       * Check Variables
       */
      if (typeof path !== 'string' || !path) {
        throw new Error('[ FireDataObject ] $map - Function must return a valid \'path\' String');
      }

      path = _purgePathString(path);

      const _path = path.split('/');

      /**
       * Check Value
       */
      if (value === undefined) {
        value = null;
      }

      return { path, value, _path };

    });

    return this;

  }


  /**
   * @function $clone
   * 
   * @description
   * Return a clone FireDataObject
   * 
   */
  $clone() {
    /**
     * Create a new Object
     */
    const $fireDataObject = new FireDataObject();

    this.$each(({ path, value, _path }) => {
      $fireDataObject._keys.push({ path, value, _path: _path.slice() });
    });

    return $fireDataObject;

  }


  /**
   * @function $filter
   * 
   * @param {Function} $callback Callback function
   * @param {*} $context Callback function context
   * 
   */
  $filter($callback, $context = this._keys) {
    /**
     * Check Callback
     */
    if (typeof $callback !== 'function') {
      throw new Error('[ FireDataObject ] $map - Callback function is not a valid function.');
    }

    this._keys = this._keys.filter($callback.bind($context));

    return this;

  }


  /**
   * @function _purgePaths
   * @private
   * 
   * @param {String} findPath Path to Find
   * 
   * @description
   * Purge all keys in conflict with findPath
   * 
   */
  _purgePaths(findPath) {

    findPath = _purgePathString(findPath);

    this._keys = this._keys.filter(({ path }) => !(new RegExp(`^${escapeRegExp(path)}(?:/.*)*$`).test(findPath)) && !(new RegExp(`^${escapeRegExp(findPath)}(?:/.*)*$`).test(path)));

  }

}

function _purgePathString($path = '') {
  return $path.replace(/\./g, '/').replace(/^\/|\/$/g, '');
}

function _mapObjectKeys($object, { skipNested = false, $base = '' } = {}) {
  /**
   * Init Properties array
   */
  const $properties = [];

  /**
   * Check object is an Array
   */
  const $isArray = Array.isArray($object);

  /**
   * Build object keys only if object is
   * an object or an Array
   */
  if (typeof $object === 'object' && $object !== null) {
    /**
     * Get object keys
     */
    Object.getOwnPropertyNames($object).forEach(($key) => {
      /**
       * If object is an Array, must skip
       * the 'lenght' key
       */
      if (!($key === 'length' && $isArray)) {
        /**
         * Add the value if is not an object or if
         * must skip nesting property building
         */
        if (skipNested || (typeof $object[$key] !== 'object' || $object[$key] === null)) {
          $properties.push({ path: `${$base}${$key}`, value: $object[$key], _path: `${$base}${$key}`.split('/') });
        }

        /**
         * Else map child
         */
        else {
          $properties.push(..._mapObjectKeys($object[$key], { skipNested, $base: `${$base}${$key}/` }));
        }
      }
    });
  }

  return $properties;
}

/* eslint-disable */
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}
/* eslint-enable */

module.exports = FireDataObject;
