/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ViewTransitionTypeSet as ViewTransitionTypeSetInterface } from "../types";

class ViewTransitionTypeSet
  extends Set<string>
  implements ViewTransitionTypeSetInterface
{
  constructor() {
    super();
  }
}
export { ViewTransitionTypeSet };
