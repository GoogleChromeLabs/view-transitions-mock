# View Transitions Mock

Mock support for `document.startViewTransition` in browsers with no support.

## Overview

This library mocks `document.startViewTransition` along with `document.activeViewTransition`. With the mock installed, you can safely call `document.startViewTransition()` – and rely on its promises and what not – without it throwing an error in browsers that have no support for it.

This way, you don’t need to sprinkle the `if (document.startViewTransition) …` check throughout your code.

## Installation

```bash
npm i view-transitions-mock
```

## Usage

1. Import and register the mock from within a blocking script.

    ```html
    <script type="module" blocking="render">
      import { register } from "view-transitions-mock";
      register();
    </script>
    ```

2. Done.

TIP: To force the registration, call `register(true)` instead of `register()`. Doing so will override the native implementation of View Transitions.

## License

`view-transitions-mock` is released under the Apache 2.0 License. See the enclosed [`LICENSE`](./LICENSE) for details.

## Contributing

We'd love to accept your patches and contributions to this project. See the enclosed [`CONTRIBUTING`](./CONTRIBUTING) for details.

## Disclaimer

This is not an officially supported Google product. This project is not eligible for the [Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security).
