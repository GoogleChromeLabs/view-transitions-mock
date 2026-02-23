# View Transitions Mock

A non-visual polyfill for Same-Document View Transitions.

## Not a polyfill. Or is it?

`view-transitions-mock` a [spec-compliant](#tests) JavaScript implementation of Same-Document View Transitions, but without the animation bits. It polyfills the full JavaScript API surface of Same-Document View Transitions, including:

- `document.startViewTransition()`
- The `ViewTransition` class along with:
  - Its Promises _(`updateCallbackDone`, `ready`, and `finished`)_
  - `ViewTransition.transitionRoot`
- `document.activeViewTransition`
- View Transition Types

Not polyfilled are:

- The Pseudo Tree
- The CSS Properties and Selectors
- The animations

This allows you to safely trigger Same-Document View Transitions, handle promises, and manage View Transition Types as if the browser natively supported them – ergo the _mock_ in `view-transitions-mock`. The only difference with a native implementation is that you don’t get to see any visual View Transition happening.

Once [registered](#usage), you can stop cluttering your codebase with `if (document.startViewTransition)` guards. Instead, write View Transitions code that runs anywhere — even in browsers without native support.

- Without `view-transitions-mock`:

    ```javascript
    document.querySelector('button').addEventListener('click', async () => {

      if (document.startViewTransition && ("types" in ViewTransition?.prototype)) {
        document.querySelector('#thing').style.viewTransitionName = 'the-thing';

        const t = document.startViewTransition({
          update: updateTheDOM,
          types: ['slide', 'from-left']
        });

        await t.finished;
        document.querySelector('#thing').style.viewTransitionName = '';
      } else {
        updateTheDOM();
      }
    });

- With `view-transitions-mock`:

    ```javascript
    import { register } from "view-transitions-mock";
    register();

    // The code below works in _any_ browser, including those without Same-Document View Transitions or View Transition Types support.
    document.querySelector('button').addEventListener('click', async () => {
      document.querySelector('#thing').style.viewTransitionName = 'the-thing';

      const t = document.startViewTransition({
        update: updateTheDOM,
        types: ['slide', 'from-left']
      });

      await t.finished;
      document.querySelector('#thing').style.viewTransitionName = '';
    });
    ```

## Installation

```bash
npm i view-transitions-mock
```

## Usage

1. Import and register the mock before you make a call to `document.startViewTranstion`. For example:

    ```html
    <script type="module">
      import { register } from "view-transitions-mock";
      register();
    </script>
    ```

2. Done.

## Registration Configuration

By default, the registation of `view-transitions-mock` checks whether `document.startViewTransition` and View Transition Types are supported or not. When both are natively supported, it won’t register the mock.

You can tweak the registration by passing an object with the following properties into the `register` function:

- `requireTypes` _(`Boolean`, default value: `true`)_: Require support for View Transition Types.
- `forced` _(`Boolean`, default value: `false`)_: Force register the mock, regardless of support.

For example, if you are not relying on View Transition Types, call `register` as follows so that it does not register the mock in Firefox 144–146 (which does not have support for View Transition Types):

```javascript
import { register } from "view-transitions-mock";
register({ requireTypes: false });
```

Or if you want to disable native support for Same-Document View Transitions entirely – handy if you want to test how your site looks without View Transitions – call `register` as follows:

```javascript
import { register } from "view-transitions-mock";
register({ forced: true });
```

## Demo

A demo can found in the `./demo` subfolder. Use the buttons to control the registration/unregistration of the mock. You can try the demo online at [https://chrome.dev/view-transitions-mock](https://chrome.dev/view-transitions-mock).

## Tests

View Transitions Mock is tested with Playwright. It is tested in the following browsers:

- Chromium 110.0.5481.38 _(No native VT support)_
- Firefox 142.0.1 _(No native VT support)_
- Chromium 145.0.7632.6 _(Full native VT support)_
- Firefox 146.0.1 _(Partial native VT support (no View Transition Types))_
- WebKit 26.0 _(Full native VT support)_

## License

`view-transitions-mock` is released under the Apache 2.0 License. See the enclosed [`LICENSE`](./LICENSE) for details.

## Contributing

We'd love to accept your patches and contributions to this project. See the enclosed [`CONTRIBUTING`](./CONTRIBUTING) for details.

## Disclaimer

This is not an officially supported Google product. This project is not eligible for the [Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security).
