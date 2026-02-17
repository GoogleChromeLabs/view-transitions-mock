# View Transitions Mock

Mock support for Same-Document View Transitions in browsers with no support.

## Overview

View Transitions Mock is a robust JavaScript implementation of Same-Document View Transitions and View Transition Types.

It is not a polyfill, as it doesn't replicate the VT pseudo-tree nor the VT animations. Instead, it mocks support for `document.startViewTransition`, `Document.activeViewTransition`, `ViewTransition.transitionRoot` and Types.

With the mock [registered](#usage), you can write modern standard-compliant Same-Document View Transitions code for _any_ browser, including those without support for `document.startViewTransition` or VT Types.

Stop sprinkling `if (document.startViewTransition)` guards across your codebase. Instead, safely call the API, handle its promises, and manage VT Types as if they were natively supported!

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
