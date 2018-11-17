# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## `1.2.4` - 2018-11-17
### `Added`
- ['<4e1899f>'](https://github.com/marcocavanna/FireDataModeler/commit/4e1899fd254da0e8767310e342c554834bf30ad6) Added 4 new Hook function `afterAdd`, `afterUpdate`, `afterSet`, `afterDelete` that are executed in the same way of the `on` Hook functon, but after data changed on Database. They could be Async function and the main `Talker` function will wait for the resolution of Hooks before resolve itself.

### `Changed`
- ['<4e1899f>'](https://github.com/marcocavanna/FireDataModeler/commit/4e1899fd254da0e8767310e342c554834bf30ad6) The `onDelete` Hook function now receive as first argument a copy of the raw data on the Database for the deleting element.
- ['<1ba121c>'](https://github.com/marcocavanna/FireDataModeler/commit/1ba121c8b000e84470ba8424ec339edbba5ad507) The `onUpdate` Hook function now receive as second argument the old data
  ```js
  {
    ...
    onDelete: [
      function (newData, oldData, $id) {
        /**
         * newData is the new parsed object
         * oldData is the old parsed object
         */
      }
    ]
  }
  ```

## `1.2.3` - 2018-11-17
### `Changed`
- ['<ca90232>'](https://github.com/marcocavanna/FireDataModeler/commit/ca9023283602889ab9f396710a030c4782c2a6de) The `this` keyword in Hook Functions (onAdd, onGet, onSet, onUpdate, onDelete) now referr to the current instance of `Talker`

### `Fixed`
- ['<eadd1b3>'](https://github.com/marcocavanna/FireDataModeler/commit/eadd1b322de015031015ecb7ca058f28810bdb71) `$delete` function now will convert correctly a String type $id in an Array to delete multiple data

## `1.2.2` - 2018-11-16
### `Added`
- [`<95f4816>`](https://github.com/marcocavanna/FireDataModeler/commit/95f481687da564b66428499b07187a30ac77ea8e) Writed and added the ReadMe file

### `Changed`
- [`<10b56f1>`](https://github.com/marcocavanna/FireDataModeler/commit/10b56f1882df2e312de700b0920f55ff2aec1f50) $update function now return only the key updated
- [`<62d83d4>`](https://github.com/marcocavanna/FireDataModeler/commit/62d83d46ed02a7479c3d9b1ee018c8c134c17289) Changed the execution of validators function. Now are not while getting data
- 
### `Fixed`
- [`<404d99c>`](https://github.com/marcocavanna/FireDataModeler/commit/404d99cdec4dedc4b3ecef5a736af8fa247374ba) Fixed an Issue with Add Data ID parameters
- [`<c5d8d5d>`](https://github.com/marcocavanna/FireDataModeler/commit/c5d8d5d7d4d57111954363fcffc6d9d2a8db618d) Fixed an Issue while using $id placeholder into `Paths` inf $update function

## `1.2.1` - 2018-11-13
### `Changed`
- [`<06f667e>`](https://github.com/marcocavanna/FireDataModeler/commit/06f667e61d47fee4b51d527e710a7ec831e67add) Delete function now accept an Array of IDS to delete multiple data from database

## `1.2.0` - 2018-11-06
### `Added`
- [`<e2981b4>`](https://github.com/marcocavanna/FireDataModeler/commit/e2981b4ab86cf72efa2ae12af7f20e1e3040c57f) Added the possibility to set some Hook function (sync/async), like __onAdd__, __onSet__, __onUpdate__, __onDelete__ and __orGet__ that will be executed before database operation. This function have to be inserted into the Model declaration, have to be an Array of Function and all are executed at the same time.
If one of the function is a Promise than the database action will wait untill promise will be resolved. If promise will be rejected no database action will be performed.<br><br>
```js
  Modeler.$model('Me', {
    model: {
      name: '?String|toUpperCase',
      surname: '?String|toUpperCase'
    },
    paths: {
      hasID: true,
      read: 'team/$team/contact'
    },
    onAdd: [
      ($data, $id) => {
        console.log(`I'm adding Data with ID ${$id}`, $data)
      }
    ]
  })
```

### `Changed`
- [`<849c8c3>`](https://github.com/marcocavanna/FireDataModeler/commit/849c8c3649a73c17f46734205e55d331f8250e7c) Functions Fields could now be asyncronous. Parsing data will wait for function resolution before continue process

### `Fixed`
- [`<0234ab0>`](https://github.com/marcocavanna/FireDataModeler/commit/0234ab01547bdb92e01e9bd571a6560075ba4e64) Fixed an error showing Error stack functions
- [`<739a490>`](https://github.com/marcocavanna/FireDataModeler/commit/739a490af6fd72c3905039197eb49706076f40aa) Fixed an error occured using `error.original` getter that sometimes returned `undefined` value

## `1.1.0` - 2018-11-03
### `Added`
- [`<ae5344c>`](https://github.com/marcocavanna/FireDataModeler/commit/ae5344cba46063e21ee62f8910a11d4f249f9582) `$filter`: Can now use filters to change Model key<br><br>
  ```js
  Modeler.$model('Me', {
    model: {
      name: '?String|toUpperCase',
      surname: '?String|toUpperCase'
    }
  })

  Modeler.$filter('toUpperCase', $str => $str.toUpperCase());
  ```

### `Fixed`
- [`<38d8a26>`](https://github.com/marcocavanna/FireDataModeler/commit/38d8a26bcc605aaaabdd4ed6e80fc73e71e20bcb) `this` keyword of Function Fields now refer correctly to the Model Parsed

## `1.0.2` - 2018-11-02
### `Added`
- [`<e530e0f>`](https://github.com/marcocavanna/FireDataModeler/commit/e530e0f89ee4083e0ea5186b78f6a0d672ed6047)  This CHANGELOG file to keep change updated
- [`<580ce11>`](https://github.com/marcocavanna/FireDataModeler/commit/580ce115856bbd02df29f512d1576320606c969e) `$id` can be added in path to get and parse child data, a this moment, id placeholder inside path string can be used in `$get` functions only and will produce an error while `$add` or `$set` data<br><br>
  ```js
  Modeler.$model('UserDetail', {
    model: {
      name: '?String',
      surname: '?String',
      email: '?String'
    },
    paths: {
      hasID: true,
      read: 'users/$id/detail'
    }
  });
  ```

### `Fixed`
- [`<7afb36f>`](https://github.com/marcocavanna/FireDataModeler/commit/7afb36fe54f523f387bbab71d3f24279f2fb80a8) Fixed an error when loading an existance Firebase Admin object during Talker initialization

## `1.0.1` - 2018-11-01
### `Added`
- [`<4969ad4>`](https://github.com/marcocavanna/FireDataModeler/commit/d969ad49c040ba5a9e5db4445460395a25928fa8) `Talker` instance appendend to Function evaluated fields Arguments<br><br>
  ```js
  // Talker instance is always the last arguments
  Modeler.$function('UID', Talker => Talker.$path('uid').get() )
  ```
- [`<802f0c2>`](https://github.com/marcocavanna/FireDataModeler/commit/802f0c27fd883484d990946ab892a7af3cb4e25e) `Talker.$path(<placeholder>).get()` : Return replacer for a path placeholder<br><br>
  ```js
  Talker.$path('uid').replace(userUID);

  // Later on your code
  const $uid = Talker.$path('uid').get();
  ```

## [`1.0.0`](https://github.com/marcocavanna/FireDataModeler/commit/0db0fce2d16eb4cfe1bd274edf49272de5914e79) - 2018-10-31
### First Package Publish