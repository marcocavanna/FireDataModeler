# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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